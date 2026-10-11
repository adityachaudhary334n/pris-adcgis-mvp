from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional
from uuid import UUID
from app.core.database import get_db

router = APIRouter()


@router.get("/")
async def list_opportunities(
    district: Optional[str] = None,
    category: Optional[str] = None,
    min_score: Optional[float] = None,
    db: AsyncSession = Depends(get_db),
):
    """Ranked list of opportunities with optional filters."""
    sql = """
        SELECT id, title, title_hi, category, description, description_hi,
               score, score_factors, image_url, district_name,
               source, confidence, review_status,
               ST_AsGeoJSON(geom)::json AS geometry
        FROM opportunities
        WHERE review_status = 'verified'
    """
    params = {}
    if district:
        sql += " AND district_name ILIKE :district"
        params["district"] = district
    if category:
        sql += " AND category ILIKE :category"
        params["category"] = category
    if min_score is not None:
        sql += " AND score >= :min_score"
        params["min_score"] = min_score
    sql += " ORDER BY score DESC"

    result = await db.execute(text(sql), params)
    return {"opportunities": [dict(r) for r in result.mappings()]}


@router.get("/{opportunity_id}")
async def get_opportunity(opportunity_id: UUID, db: AsyncSession = Depends(get_db)):
    """Single opportunity with full setup steps."""
    opp = await db.execute(text("""
        SELECT id, title, title_hi, category, description, description_hi,
               score, score_factors, image_url, district_name,
               source, collection_method, collected_at, valid_until,
               confidence, review_status,
               ST_AsGeoJSON(geom)::json AS geometry
        FROM opportunities
        WHERE id = :id
    """), {"id": str(opportunity_id)})
    row = opp.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Opportunity not found")

    steps = await db.execute(text("""
        SELECT step_number, title, title_hi, description, description_hi,
               estimated_days, estimated_cost
        FROM opportunity_setup_steps
        WHERE opportunity_id = :id
        ORDER BY step_number
    """), {"id": str(opportunity_id)})

    data = dict(row)
    data["setup_steps"] = [dict(s) for s in steps.mappings()]
    return data


@router.get("/near/point")
async def opportunities_near_point(
    lat: float = Query(...),
    lon: float = Query(...),
    radius_m: float = Query(10000),
    db: AsyncSession = Depends(get_db),
):
    """Opportunities ranked by score within radius of a location."""
    point = f"SRID=4326;POINT({lon} {lat})"
    result = await db.execute(text("""
        SELECT id, title, category, score, score_factors, district_name,
               ST_Distance(geom::geography, ST_GeogFromText(:pt)) AS distance_m,
               ST_AsGeoJSON(geom)::json AS geometry,
               source, confidence
        FROM opportunities
        WHERE review_status = 'verified'
          AND ST_DWithin(geom::geography, ST_GeogFromText(:pt), :radius)
        ORDER BY score DESC, distance_m
        LIMIT 15
    """), {"pt": point, "radius": radius_m})
    return {"opportunities": [dict(r) for r in result.mappings()]}
