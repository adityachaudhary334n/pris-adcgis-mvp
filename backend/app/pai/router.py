from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import httpx
from app.core.database import get_db
from app.core.config import get_settings

router = APIRouter()
settings = get_settings()


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    lat: Optional[float] = None
    lon: Optional[float] = None
    district: Optional[str] = None
    village: Optional[str] = None
    language: str = "en"  # en | hi


class ChatResponse(BaseModel):
    answer: str
    sources_used: List[dict] = []
    data_available: bool = True
    nearest_hint: Optional[str] = None
    structured: Optional[dict] = None


async def retrieve_context(
    db: AsyncSession,
    message: str,
    lat: Optional[float],
    lon: Optional[float],
    district: Optional[str],
) -> dict:
    """Spatial RAG retrieval – only return real rows."""
    context = {
        "opportunities": [],
        "flora_fauna": [],
        "water_soil": [],
        "has_data": False,
    }

    # Simple intent keywords
    msg = message.lower()
    want_opp = any(k in msg for k in ["opportunit", "enterprise", "livelihood", "business", "start", "grow", "cultivat", "farm", "उद्यम", "अवसर", "कमाई", "खेती"])
    want_flora = any(k in msg for k in ["flora", "fauna", "plant", "tree", "species", "biodiversity", "वनस्पति", "पौधा", "पेड़"])
    want_soil = any(k in msg for k in ["soil", "water", "ph", "groundwater", "मिट्टी", "पानी"])

    params = {}
    location_filter = ""
    if district:
        location_filter = " AND district_name ILIKE :district"
        params["district"] = district

    if want_opp or (not want_flora and not want_soil):
        sql = f"""
            SELECT id, title, category, score, score_factors, description, district_name, source, confidence
            FROM opportunities
            WHERE review_status = 'verified' {location_filter}
            ORDER BY score DESC
            LIMIT 8
        """
        result = await db.execute(text(sql), params)
        context["opportunities"] = [dict(r) for r in result.mappings()]

    if want_flora:
        sql = f"""
            SELECT id, species_name, common_name, type, description, district_name, source, confidence
            FROM flora_fauna
            WHERE review_status = 'verified' {location_filter}
            LIMIT 8
        """
        result = await db.execute(text(sql), params)
        context["flora_fauna"] = [dict(r) for r in result.mappings()]

    if want_soil:
        sql = f"""
            SELECT indicator_type, value, unit, quality_label, notes, district_name, source, confidence
            FROM water_soil
            WHERE review_status = 'verified' {location_filter}
            LIMIT 8
        """
        result = await db.execute(text(sql), params)
        context["water_soil"] = [dict(r) for r in result.mappings()]

    # If user gave coordinates, also pull near features
    if lat is not None and lon is not None:
        point = f"SRID=4326;POINT({lon} {lat})"
        near = await db.execute(text("""
            SELECT id, title, category, score, district_name,
                   ST_Distance(geom::geography, ST_GeogFromText(:pt)) AS distance_m
            FROM opportunities
            WHERE review_status = 'verified'
              AND ST_DWithin(geom::geography, ST_GeogFromText(:pt), 15000)
            ORDER BY score DESC
            LIMIT 5
        """), {"pt": point})
        near_rows = [dict(r) for r in near.mappings()]
        if near_rows:
            context["opportunities"] = near_rows

    context["has_data"] = bool(
        context["opportunities"] or context["flora_fauna"] or context["water_soil"]
    )
    return context


def build_system_prompt(language: str) -> str:
    base = (
        "You are PAI (Prajna AI), the spatial intelligence assistant of the PRIS platform. "
        "You answer ONLY from the data provided in the context. "
        "If the context contains no relevant records for the user's location or question, "
        "you MUST clearly say that verified data is not yet available for that exact place "
        "and, if possible, mention the nearest available information. "
        "Never invent soil values, species presence, opportunity scores, or market claims. "
        "Be clear, practical, and encouraging for rural users and community researchers. "
        "When opportunities are present, highlight the score and the main factors. "
        "When setup steps exist, summarise them helpfully."
    )
    if language == "hi":
        base += " Respond in simple Hindi."
    else:
        base += " Respond in clear, simple English."
    return base


async def call_llm(system: str, user_message: str, context: dict) -> str:
    """Call configured LLM. Falls back to deterministic response if no key."""
    if not settings.llm_api_key:
        # Deterministic fallback for offline / no-key demos
        if not context["has_data"]:
            return (
                "I do not yet have verified field or public data for this exact location. "
                "Please try a nearby village or district (Ayodhya, Kaushambi or Agra) "
                "or check back later as we expand coverage."
            )
        parts = []
        if context["opportunities"]:
            parts.append("Here are the ranked livelihood / enterprise opportunities I found:")
            for o in context["opportunities"][:5]:
                score = o.get("score", "N/A")
                parts.append(f"• {o.get('title')} (Score: {score}) – {o.get('category')} in {o.get('district_name')}")
        if context["flora_fauna"]:
            parts.append("\nFlora / fauna records:")
            for f in context["flora_fauna"][:5]:
                parts.append(f"• {f.get('common_name') or f.get('species_name')} ({f.get('type')})")
        if context["water_soil"]:
            parts.append("\nWater / soil indicators:")
            for w in context["water_soil"][:5]:
                parts.append(f"• {w.get('indicator_type')}: {w.get('value')} {w.get('unit')} ({w.get('quality_label')})")
        parts.append("\nAll answers are based only on records currently held in the PRIS system.")
        return "\n".join(parts)

    # Real LLM call
    context_text = (
        f"Opportunities: {context['opportunities']}\n"
        f"Flora/Fauna: {context['flora_fauna']}\n"
        f"Water/Soil: {context['water_soil']}"
    )
    payload = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": f"Context data:\n{context_text}\n\nUser question: {user_message}"},
        ],
        "temperature": 0.3,
        "max_tokens": 800,
    }
    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(f"{settings.llm_base_url}/chat/completions", json=payload, headers=headers)
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"LLM error: {resp.text}")
        data = resp.json()
        return data["choices"][0]["message"]["content"]


@router.post("/chat", response_model=ChatResponse)
async def pai_chat(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    """
    PAI-lite chat endpoint.
    Strict Spatial RAG: answers only from retrieved PostGIS records.
    """
    context = await retrieve_context(
        db, body.message, body.lat, body.lon, body.district
    )

    system = build_system_prompt(body.language)
    answer = await call_llm(system, body.message, context)

    sources = []
    for o in context["opportunities"][:5]:
        sources.append({"type": "opportunity", "id": str(o.get("id")), "title": o.get("title"), "source": o.get("source")})
    for f in context["flora_fauna"][:3]:
        sources.append({"type": "flora_fauna", "id": str(f.get("id")), "title": f.get("common_name") or f.get("species_name")})

    nearest_hint = None
    if not context["has_data"]:
        nearest_hint = "Try Ayodhya, Kaushambi or Agra districts where pilot data currently exists."

    structured = None
    if context["opportunities"]:
        structured = {
            "opportunities": context["opportunities"][:5],
        }

    return ChatResponse(
        answer=answer,
        sources_used=sources,
        data_available=context["has_data"],
        nearest_hint=nearest_hint,
        structured=structured,
    )
