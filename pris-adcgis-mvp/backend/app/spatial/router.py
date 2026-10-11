from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional
from app.core.database import get_db

router = APIRouter()


@router.get("/districts")
async def list_districts(db: AsyncSession = Depends(get_db)):
    """Return all pilot districts."""
    result = await db.execute(text("""
        SELECT id, name, name_hi, district_code,
               ST_AsGeoJSON(geom)::json AS geometry
        FROM admin_boundaries
        WHERE level = 'district'
        ORDER BY name
    """))
    rows = result.mappings().all()
    return {"districts": [dict(r) for r in rows]}


@router.get("/villages")
async def list_villages(
    district: Optional[str] = Query(None, description="District name filter"),
    db: AsyncSession = Depends(get_db),
):
    """Return villages, optionally filtered by district name."""
    if district:
        result = await db.execute(text("""
            SELECT v.id, v.name, v.name_hi, d.name AS district_name,
                   ST_AsGeoJSON(v.geom)::json AS geometry
            FROM admin_boundaries v
            JOIN admin_boundaries d ON v.parent_id = d.id
            WHERE v.level = 'village' AND d.name ILIKE :district
            ORDER BY v.name
        """), {"district": district})
    else:
        result = await db.execute(text("""
            SELECT v.id, v.name, v.name_hi, d.name AS district_name,
                   ST_AsGeoJSON(v.geom)::json AS geometry
            FROM admin_boundaries v
            JOIN admin_boundaries d ON v.parent_id = d.id
            WHERE v.level = 'village'
            ORDER BY d.name, v.name
        """))
    rows = result.mappings().all()
    return {"villages": [dict(r) for r in rows]}


@router.get("/layers/opportunities")
async def layer_opportunities(
    district: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """GeoJSON-ready opportunity points."""
    sql = """
        SELECT id, title, title_hi, category, description, score, score_factors,
               image_url, district_name, source, confidence, review_status,
               ST_AsGeoJSON(geom)::json AS geometry
        FROM opportunities
        WHERE review_status = 'verified'
    """
    params = {}
    if district:
        sql += " AND district_name ILIKE :district"
        params["district"] = district
    sql += " ORDER BY score DESC"

    result = await db.execute(text(sql), params)
    features = []
    for r in result.mappings():
        props = dict(r)
        geom = props.pop("geometry")
        features.append({
            "type": "Feature",
            "geometry": geom,
            "properties": props,
        })
    return {"type": "FeatureCollection", "features": features}


@router.get("/layers/flora-fauna")
async def layer_flora_fauna(
    district: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    sql = """
        SELECT id, species_name, common_name, common_name_hi, type, description,
               district_name, source, confidence,
               ST_AsGeoJSON(geom)::json AS geometry
        FROM flora_fauna
        WHERE review_status = 'verified'
    """
    params = {}
    if district:
        sql += " AND district_name ILIKE :district"
        params["district"] = district

    result = await db.execute(text(sql), params)
    features = []
    for r in result.mappings():
        props = dict(r)
        geom = props.pop("geometry")
        features.append({
            "type": "Feature",
            "geometry": geom,
            "properties": props,
        })
    return {"type": "FeatureCollection", "features": features}


@router.get("/layers/water-soil")
async def layer_water_soil(
    district: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    sql = """
        SELECT id, indicator_type, value, unit, quality_label, notes,
               district_name, source, confidence, collected_at, valid_until,
               ST_AsGeoJSON(geom)::json AS geometry
        FROM water_soil
        WHERE review_status = 'verified'
    """
    params = {}
    if district:
        sql += " AND district_name ILIKE :district"
        params["district"] = district

    result = await db.execute(text(sql), params)
    features = []
    for r in result.mappings():
        props = dict(r)
        geom = props.pop("geometry")
        features.append({
            "type": "Feature",
            "geometry": geom,
            "properties": props,
        })
    return {"type": "FeatureCollection", "features": features}


@router.get("/near")
async def features_near(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    radius_m: float = Query(5000, description="Search radius in metres"),
    db: AsyncSession = Depends(get_db),
):
    """Return opportunities and flora/fauna within radius of a point."""
    point = f"SRID=4326;POINT({lon} {lat})"

    opp = await db.execute(text("""
        SELECT id, title, category, score, district_name,
               ST_Distance(geom::geography, ST_GeogFromText(:pt)) AS distance_m,
               ST_AsGeoJSON(geom)::json AS geometry
        FROM opportunities
        WHERE review_status = 'verified'
          AND ST_DWithin(geom::geography, ST_GeogFromText(:pt), :radius)
        ORDER BY distance_m
        LIMIT 20
    """), {"pt": point, "radius": radius_m})

    ff = await db.execute(text("""
        SELECT id, species_name, common_name, type, district_name,
               ST_Distance(geom::geography, ST_GeogFromText(:pt)) AS distance_m,
               ST_AsGeoJSON(geom)::json AS geometry
        FROM flora_fauna
        WHERE review_status = 'verified'
          AND ST_DWithin(geom::geography, ST_GeogFromText(:pt), :radius)
        ORDER BY distance_m
        LIMIT 20
    """), {"pt": point, "radius": radius_m})

    return {
        "opportunities": [dict(r) for r in opp.mappings()],
        "flora_fauna": [dict(r) for r in ff.mappings()],
    }
