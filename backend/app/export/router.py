"""
Intelligence Pack exports: PDF briefing, GeoJSON, CSV.
Generates downloadable assets for any administrative unit.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional
from io import BytesIO, StringIO
import csv
import json
from datetime import datetime

from app.core.database import get_db

router = APIRouter()


async def _load_unit_bundle(db: AsyncSession, unit_id: str) -> dict:
    unit = await db.execute(text("""
        SELECT id, level, name, name_hi, district_code, population, area_sqkm,
               ST_AsGeoJSON(geom)::json AS geometry,
               ST_AsGeoJSON(centroid)::json AS centroid
        FROM admin_boundaries WHERE id = :id
    """), {"id": unit_id})
    u = unit.mappings().first()
    if not u:
        raise HTTPException(status_code=404, detail="Unit not found")

    prof = await db.execute(text("SELECT * FROM unit_profiles WHERE unit_id = :id"), {"id": unit_id})
    p = prof.mappings().first()

    air = await db.execute(text("SELECT * FROM air_resource WHERE unit_id = :id LIMIT 1"), {"id": unit_id})
    a = air.mappings().first()

    opps = await db.execute(text("""
        SELECT id, title, category, score, description, district_name, source, confidence
        FROM opportunities
        WHERE (unit_id = :id OR district_name ILIKE :dname) AND review_status = 'verified'
        ORDER BY score DESC LIMIT 15
    """), {"id": unit_id, "dname": u["name"]})

    return {
        "unit": dict(u),
        "profiles": dict(p) if p else {},
        "air_volume": dict(a) if a else {},
        "opportunities": [dict(o) for o in opps.mappings()],
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }


@router.get("/{unit_id}/geojson")
async def export_geojson(unit_id: str, db: AsyncSession = Depends(get_db)):
    """Download unit boundary + key layers as GeoJSON FeatureCollection."""
    bundle = await _load_unit_bundle(db, unit_id)
    features = []

    if bundle["unit"].get("geometry"):
        features.append({
            "type": "Feature",
            "geometry": bundle["unit"]["geometry"],
            "properties": {
                "layer": "admin_boundary",
                "name": bundle["unit"]["name"],
                "level": bundle["unit"]["level"],
                "id": bundle["unit"]["id"],
            },
        })

    # Attach opportunity points if any
    for o in bundle["opportunities"]:
        # geometry may not be in this lightweight select; skip if absent
        pass

    fc = {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "title": f"PRIS Intelligence Pack – {bundle['unit']['name']}",
            "generated_at": bundle["generated_at"],
            "source": "PRIS + adcGIS",
        },
    }
    filename = f"pris_{bundle['unit']['name'].replace(' ', '_').lower()}_{unit_id[:8]}.geojson"
    return JSONResponse(
        content=fc,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{unit_id}/csv")
async def export_csv(unit_id: str, db: AsyncSession = Depends(get_db)):
    """Download tabular summary + opportunities as CSV."""
    bundle = await _load_unit_bundle(db, unit_id)
    u = bundle["unit"]
    p = bundle["profiles"]
    a = bundle["air_volume"]

    output = StringIO()
    writer = csv.writer(output)

    writer.writerow(["PRIS + adcGIS Intelligence Pack"])
    writer.writerow(["Unit", u.get("name"), u.get("name_hi")])
    writer.writerow(["Level", u.get("level")])
    writer.writerow(["District Code", u.get("district_code")])
    writer.writerow(["Population", u.get("population")])
    writer.writerow(["Area sqkm", u.get("area_sqkm")])
    writer.writerow([])
    writer.writerow(["Composite Indices"])
    writer.writerow(["Entrepreneurship Index", p.get("entrepreneurship_index")])
    writer.writerow(["Industrial Suitability", p.get("industrial_suitability")])
    writer.writerow(["Sustainability Index", p.get("sustainability_index")])
    writer.writerow(["Conservation Value", p.get("conservation_value")])
    writer.writerow(["Overall Opportunity", p.get("overall_opportunity")])
    writer.writerow([])
    writer.writerow(["Air Volume Asset"])
    writer.writerow(["Airspace Class", a.get("airspace_class")])
    writer.writerow(["Max Usable Height (m)", a.get("max_usable_height_m")])
    writer.writerow(["Solar Irradiance (kWh/m²/day)", a.get("solar_irradiance_avg")])
    writer.writerow(["Drone Corridor Score", a.get("drone_corridor_score")])
    writer.writerow(["Heritage Sensitivity", a.get("heritage_sensitivity")])
    writer.writerow(["Agrivoltaic Suitability", a.get("agrivoltaic_suitability")])
    writer.writerow([])
    writer.writerow(["Top Opportunities"])
    writer.writerow(["Title", "Category", "Score", "District", "Source"])
    for o in bundle["opportunities"]:
        writer.writerow([o.get("title"), o.get("category"), o.get("score"), o.get("district_name"), o.get("source")])

    output.seek(0)
    filename = f"pris_{u['name'].replace(' ', '_').lower()}_{unit_id[:8]}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{unit_id}/pdf")
async def export_pdf(unit_id: str, db: AsyncSession = Depends(get_db)):
    """
    Generate a professional PDF Intelligence Briefing for the unit.
    Uses reportlab (already planned in requirements).
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.lib.colors import HexColor, white
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="PDF engine not available. Install reportlab or use /csv and /geojson exports.",
        )

    bundle = await _load_unit_bundle(db, unit_id)
    u = bundle["unit"]
    p = bundle["profiles"]
    a = bundle["air_volume"]

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=16*mm, bottomMargin=16*mm)
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="TitleUP", fontName="Helvetica-Bold", fontSize=16, alignment=TA_CENTER, spaceAfter=6, textColor=HexColor("#0F172A")))
    styles.add(ParagraphStyle(name="SubUP", fontName="Helvetica", fontSize=10, alignment=TA_CENTER, textColor=HexColor("#334155"), spaceAfter=8))
    styles.add(ParagraphStyle(name="H2", fontName="Helvetica-Bold", fontSize=11, textColor=HexColor("#0284C7"), spaceBefore=10, spaceAfter=4))
    styles.add(ParagraphStyle(name="BodyUP", fontName="Helvetica", fontSize=9, leading=12, alignment=TA_JUSTIFY, spaceAfter=4))
    styles.add(ParagraphStyle(name="Small", fontName="Helvetica", fontSize=8, textColor=HexColor("#64748B")))

    story = []
    story.append(Paragraph("PRIS + adcGIS", styles["TitleUP"]))
    story.append(Paragraph("Spatial Intelligence Briefing · Uttar Pradesh", styles["SubUP"]))
    story.append(HRFlowable(width="100%", thickness=1.5, color=HexColor("#0284C7"), spaceAfter=8))
    story.append(Paragraph(f"<b>{u.get('name')}</b> ({u.get('name_hi') or ''})", styles["TitleUP"]))
    story.append(Paragraph(f"Level: {u.get('level')} · District code: {u.get('district_code') or '—'} · Generated: {bundle['generated_at'][:10]}", styles["Small"]))
    story.append(Spacer(1, 6))

    story.append(Paragraph("1. Unit Snapshot", styles["H2"]))
    story.append(Paragraph(
        f"Population: {u.get('population') or '—'} · Area: {u.get('area_sqkm') or '—'} km². "
        "This briefing combines land, water, human capital, infrastructure, industrial suitability, "
        "sustainable project potential and the air volume above the unit as a structured asset.",
        styles["BodyUP"],
    ))

    story.append(Paragraph("2. Composite Opportunity Indices (0–100)", styles["H2"]))
    idx_data = [
        ["Entrepreneurship", str(p.get("entrepreneurship_index") or "—")],
        ["Industrial Suitability", str(p.get("industrial_suitability") or "—")],
        ["Sustainability", str(p.get("sustainability_index") or "—")],
        ["Conservation Value", str(p.get("conservation_value") or "—")],
        ["Overall Opportunity", str(p.get("overall_opportunity") or "—")],
    ]
    t = Table(idx_data, colWidths=[90*mm, 60*mm])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#F1F5F9")),
        ("GRID", (0, 0), (-1, -1), 0.4, HexColor("#E2E8F0")),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(t)

    story.append(Paragraph("3. Air Volume Asset", styles["H2"]))
    story.append(Paragraph(
        f"Airspace class: <b>{a.get('airspace_class') or '—'}</b> · "
        f"Max usable height: {a.get('max_usable_height_m') or '—'} m · "
        f"Solar irradiance: {a.get('solar_irradiance_avg') or '—'} kWh/m²/day · "
        f"Drone corridor score: {a.get('drone_corridor_score') or '—'} · "
        f"Heritage sensitivity: {a.get('heritage_sensitivity') or '—'} · "
        f"Agrivoltaic suitability: {a.get('agrivoltaic_suitability') or '—'}. "
        "The column of air above this unit is treated as a first-class spatial asset for energy, logistics and monitoring.",
        styles["BodyUP"],
    ))

    story.append(Paragraph("4. Top Livelihood & Enterprise Opportunities", styles["H2"]))
    if bundle["opportunities"]:
        for o in bundle["opportunities"][:8]:
            story.append(Paragraph(
                f"• <b>{o.get('title')}</b> ({o.get('category')}) — Score {o.get('score')} — Source: {o.get('source')}",
                styles["BodyUP"],
            ))
    else:
        story.append(Paragraph("No verified opportunity records currently linked to this unit. Coverage is expanding.", styles["BodyUP"]))

    story.append(Paragraph("5. Profile Modules Present", styles["H2"]))
    modules = ["soil_profile", "flora_fauna_profile", "human_capital", "infrastructure",
               "water_profile", "climate_air", "land_livelihood", "industrial", "sustainable", "conservation_risk"]
    present = [m for m in modules if p.get(m)]
    story.append(Paragraph(
        "Available profile blocks: " + (", ".join(present) if present else "None computed yet — framework ready for statewide data load."),
        styles["BodyUP"],
    ))

    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=0.8, color=HexColor("#CBD5E1"), spaceAfter=4))
    story.append(Paragraph(
        "PRIS + adcGIS · MCESP Initiative · Data is provenance-tagged. Absence of a value means not yet verified, not zero. "
        "This document is generated for decision support and community research.",
        styles["Small"],
    ))

    doc.build(story)
    buffer.seek(0)
    filename = f"pris_brief_{u['name'].replace(' ', '_').lower()}_{unit_id[:8]}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{unit_id}/pack")
async def intelligence_pack_info(unit_id: str, db: AsyncSession = Depends(get_db)):
    """Describe available download formats for this unit."""
    bundle = await _load_unit_bundle(db, unit_id)
    return {
        "unit": {"id": bundle["unit"]["id"], "name": bundle["unit"]["name"], "level": bundle["unit"]["level"]},
        "available_formats": [
            {"format": "pdf", "endpoint": f"/api/export/{unit_id}/pdf", "description": "Professional intelligence briefing PDF"},
            {"format": "csv", "endpoint": f"/api/export/{unit_id}/csv", "description": "Tabular indices, air volume & opportunities"},
            {"format": "geojson", "endpoint": f"/api/export/{unit_id}/geojson", "description": "Boundary and spatial package"},
        ],
        "generated_at": bundle["generated_at"],
    }
