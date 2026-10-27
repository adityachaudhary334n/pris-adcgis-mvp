import uuid
"""Multi-profile intelligence for any administrative unit in Uttar Pradesh."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional, Any
from app.core.database import get_db

router = APIRouter()

PROFILE_KEYS = {
    "soil": "soil_profile",
    "flora_fauna": "flora_fauna_profile",
    "human_capital": "human_capital",
    "infrastructure": "infrastructure",
    "water": "water_profile",
    "climate_air": "climate_air",
    "land_livelihood": "land_livelihood",
    "industrial": "industrial",
    "sustainable": "sustainable",
    "conservation": "conservation_risk",
}


def _reshape_profiles(row: dict) -> dict:
    """Map DB JSONB columns to the frontend tab keys."""
    out = {}
    for fe_key, db_key in PROFILE_KEYS.items():
        val = row.get(db_key)
        if isinstance(val, dict):
            out[fe_key] = val
        elif val is not None:
            out[fe_key] = {"value": val}
    return out


def _normalize_air(air: Optional[dict]) -> Optional[dict]:
    if not air:
        return None
    a = dict(air)
    # Frontend AirVolumeAsset uses solar_irradiance
    if "solar_irradiance" not in a and "solar_irradiance_avg" in a:
        a["solar_irradiance"] = a.get("solar_irradiance_avg")
    return a


async def _admin_summary(db: AsyncSession, unit_id: str) -> dict:
    """Facts derived from the boundary hierarchy itself, so EVERY unit has real data even without a computed profile."""
    u = (await db.execute(text("""
        SELECT id, level, name, district_code, block_code, village_code, area_sqkm, population, properties
        FROM admin_boundaries WHERE id = :id"""), {"id": unit_id})).mappings().first()
    out: dict = {"level": u["level"], "area_sqkm": float(u["area_sqkm"]) if u["area_sqkm"] is not None else None,
                 "population": u["population"], "crs": "EPSG:4326"}
    props = u["properties"] or {}
    if u["level"] == "state":
        rows = (await db.execute(text("SELECT level, count(*) n FROM admin_boundaries GROUP BY level"))).mappings().all()
        c = {r["level"]: r["n"] for r in rows}
        out["counts"] = {"districts": c.get("district", 0), "blocks": c.get("block", 0), "villages": c.get("village", 0)}
    elif u["level"] == "district":
        r = (await db.execute(text("""
            SELECT count(*) FILTER (WHERE level='block') AS blocks, count(*) FILTER (WHERE level='village') AS villages,
                   count(DISTINCT properties->>'gp_code') FILTER (WHERE level='village') AS gps
            FROM admin_boundaries WHERE district_code = :dc"""), {"dc": u["district_code"]})).mappings().first()
        out["counts"] = {"blocks": r["blocks"], "villages": r["villages"], "gram_panchayats": r["gps"]}
        out["codes"] = {"lgd_district": props.get("lgd")}
    elif u["level"] == "block":
        r = (await db.execute(text("""
            SELECT count(*) AS villages, count(DISTINCT properties->>'gp_code') AS gps,
                   array_agg(DISTINCT properties->>'tehsil') FILTER (WHERE properties->>'tehsil' IS NOT NULL) AS tehsils
            FROM admin_boundaries WHERE parent_id = :id"""), {"id": unit_id})).mappings().first()
        out["counts"] = {"villages": r["villages"], "gram_panchayats": r["gps"]}
        out["tehsils"] = r["tehsils"]
        out["codes"] = {"lgd_block": props.get("lgd")}
    else:
        out["gram_panchayat"] = props.get("gp")
        out["tehsil"] = props.get("tehsil")
        out["assembly_constituency_no"] = props.get("ac_no")
        out["name_in_survey_records"] = props.get("name_soi")
        out["codes"] = {"lgd_village": props.get("lgd"), "census_2011": props.get("census_code")}
        out["lgd_code_missing"] = bool(props.get("lgd_missing"))
        p = (await db.execute(text("""
            SELECT b.name AS block, d.name AS district FROM admin_boundaries v
            LEFT JOIN admin_boundaries b ON b.id = v.parent_id LEFT JOIN admin_boundaries d ON d.id = b.parent_id WHERE v.id = :id"""),
            {"id": unit_id})).mappings().first()
        if p:
            out["block"], out["district"] = p["block"], p["district"]
    out["source"] = props.get("source")
    return {k: v for k, v in out.items() if v is not None}


@router.get("/district-info/{unit_id}")
async def district_info(unit_id: str, db: AsyncSession = Depends(get_db)):
    """Descriptive profile (geography / demography / history / any extra sections) of a district.
    Pass a district id, or ANY unit id (block, village) to get the profile of the district that contains it."""
    try:
        uuid.UUID(unit_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="unit_id must be a UUID")
    try:
        row = (await db.execute(text("""
            SELECT i.unit_id, i.district, i.division, i.source, i.sections, i.generic, i.updated_at, d.area_sqkm
            FROM admin_boundaries u
            JOIN admin_boundaries d ON d.level = 'district' AND d.district_code = u.district_code
            JOIN district_info i ON i.unit_id = d.id
            WHERE u.id = :id"""), {"id": unit_id})).mappings().first()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=503, detail="district_info table is missing. Run: docker compose exec -T db psql -U pris -d pris_db < data/clean/district_info_load.sql")
    if not row:
        raise HTTPException(status_code=404, detail="No district profile for this unit yet")
    return {"unit_id": row["unit_id"], "district": row["district"], "division": row["division"], "source": row["source"],
            "sections": row["sections"], "generic_fields": row["generic"], "boundary_area_sqkm": float(row["area_sqkm"]) if row["area_sqkm"] is not None else None,
            "updated_at": row["updated_at"]}


@router.get("/{unit_id}")
async def get_full_profile(unit_id: str, db: AsyncSession = Depends(get_db)):
    unit = await db.execute(text("""
        SELECT id, level, name, name_hi, district_code, population, area_sqkm,
               ST_AsGeoJSON(CASE WHEN level IN ('state','district','block') THEN COALESCE(geom_simple, geom) ELSE geom END, 5)::json AS geometry,
               ST_AsGeoJSON(centroid)::json AS centroid
        FROM admin_boundaries WHERE id = :id
    """), {"id": unit_id})
    u = unit.mappings().first()
    if not u:
        raise HTTPException(status_code=404, detail="Administrative unit not found")

    prof = await db.execute(text("SELECT * FROM unit_profiles WHERE unit_id = :id"), {"id": unit_id})
    p = prof.mappings().first()
    pdict = dict(p) if p else {}

    air = await db.execute(text("""
        SELECT airspace_class, max_usable_height_m, drone_corridor_score,
               solar_irradiance_avg, wind_class, wind_speed_avg_ms,
               pollution_load_index, carbon_potential, heritage_sensitivity,
               agrivoltaic_suitability, monitoring_priority, notes,
               source, confidence
        FROM air_resource WHERE unit_id = :id
        LIMIT 1
    """), {"id": unit_id})
    air_row = air.mappings().first()

    profiles = _reshape_profiles(pdict) if pdict else {}
    indices = {
        "entrepreneurship": pdict.get("entrepreneurship_index"),
        "industrial_suitability": pdict.get("industrial_suitability"),
        "sustainability": pdict.get("sustainability_index"),
        "conservation_value": pdict.get("conservation_value"),
        "overall_opportunity": pdict.get("overall_opportunity"),
    } if pdict else {}

    return {
        "unit_id": str(u["id"]),
        "name": u["name"],
        "level": u["level"],
        "unit": dict(u),
        "admin_summary": await _admin_summary(db, unit_id),
        "computed": bool(pdict),
        "profiles": profiles,
        "air_volume_asset": _normalize_air(dict(air_row) if air_row else None),
        "indices": indices,
        "provenance": {
            "source": pdict.get("profile_source"),
            "measured_at": str(pdict.get("computed_at")) if pdict.get("computed_at") else None,
            "method": pdict.get("profile_version"),
        } if pdict else None,
        "data_available": bool(pdict),
        "message": None if pdict else (
            "Full multi-profile not yet computed for this unit. "
            "Basic boundary is available; profiles are being expanded statewide."
        ),
    }


@router.get("/")
async def list_profiles(
    level: str = Query("district", description="district|block|village"),
    min_opportunity: Optional[float] = None,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    params = {"lvl": level, "lim": limit}
    score_filter = ""
    if min_opportunity is not None:
        score_filter = " AND p.overall_opportunity >= :min_opp"
        params["min_opp"] = min_opportunity

    result = await db.execute(text(f"""
        SELECT d.id, d.name, d.name_hi, d.level, d.district_code,
               d.population, d.area_sqkm,
               p.entrepreneurship_index, p.industrial_suitability,
               p.sustainability_index, p.conservation_value, p.overall_opportunity,
               p.confidence, p.review_status,
               ST_AsGeoJSON(d.centroid)::json AS centroid
        FROM admin_boundaries d
        JOIN unit_profiles p ON p.unit_id = d.id
        WHERE d.level = :lvl {score_filter}
        ORDER BY p.overall_opportunity DESC NULLS LAST
        LIMIT :lim
    """), params)
    return {"level": level, "units": [dict(r) for r in result.mappings()]}


@router.get("/{unit_id}/summary")
async def profile_summary(unit_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT d.id, d.name, d.name_hi, d.level, d.district_code,
               p.entrepreneurship_index, p.industrial_suitability,
               p.sustainability_index, p.conservation_value, p.overall_opportunity,
               a.solar_irradiance_avg, a.drone_corridor_score, a.heritage_sensitivity,
               a.airspace_class
        FROM admin_boundaries d
        LEFT JOIN unit_profiles p ON p.unit_id = d.id
        LEFT JOIN air_resource a ON a.unit_id = d.id
        WHERE d.id = :id
    """), {"id": unit_id})
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Unit not found")
    return dict(row)
