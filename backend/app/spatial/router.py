"""Spatial API. CRS: every geometry is EPSG:4326 (WGS84); coordinates are [longitude, latitude] in degrees.

Layer endpoints accept either `district` (name) or `unit_id` (any admin unit: district, block or village).
`unit_id` filters by geometry (ST_Intersects with the unit polygon), which is what "focus mode" in the UI uses.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter()
CRS = "EPSG:4326"
LEVELS = ("state", "district", "block", "village", "suburb")
CHILD_LEVEL = {"state": "district", "district": "block", "block": "village"}


def _uid(unit_id: Optional[str]) -> Optional[str]:
    """Validate a UUID query/path value (400 instead of a database 500)."""
    if unit_id in (None, ""):
        return None
    try:
        return str(uuid.UUID(str(unit_id)))
    except ValueError:
        raise HTTPException(status_code=400, detail="unit_id must be a UUID")


def _in_unit(geom_expr: str) -> str:
    return (f" AND (CAST(:uid AS uuid) IS NULL OR ST_Intersects({geom_expr}, "
            f"(SELECT geom FROM admin_boundaries WHERE id = CAST(:uid AS uuid))))")


async def _features(db: AsyncSession, sql: str, params: dict) -> dict:
    result = await db.execute(text(sql), params)
    features = []
    for r in result.mappings():
        props = dict(r)
        geom = props.pop("geometry", None)
        if geom:
            features.append({"type": "Feature", "geometry": geom, "properties": props})
    return {"type": "FeatureCollection", "features": features, "crs": CRS}


# ---------------------------------------------------------------- lists

@router.get("/districts")
async def list_districts(db: AsyncSession = Depends(get_db)):
    """All districts in the database (geometry included)."""
    result = await db.execute(text("""
        SELECT id, name, name_hi, district_code, ST_AsGeoJSON(geom)::json AS geometry
        FROM admin_boundaries WHERE level = 'district' ORDER BY name
    """))
    return {"districts": [dict(r) for r in result.mappings().all()], "crs": CRS}


@router.get("/villages")
async def list_villages(district: Optional[str] = Query(None, description="District name (required: there are 100k villages)"),
                        limit: int = Query(500, ge=1, le=2000), db: AsyncSession = Depends(get_db)):
    """Villages of one district (names + centroid only, no polygons)."""
    if not district:
        raise HTTPException(status_code=400, detail="district is required (the state has ~100,000 villages)")
    result = await db.execute(text("""
        SELECT v.id, v.name, v.name_hi, d.name AS district_name, ST_X(v.centroid) AS lon, ST_Y(v.centroid) AS lat
        FROM admin_boundaries d JOIN admin_boundaries v ON v.district_code = d.district_code AND v.level = 'village'
        WHERE d.level = 'district' AND d.name ILIKE :district ORDER BY v.name LIMIT :lim"""), {"district": district, "lim": limit})
    return {"villages": [dict(r) for r in result.mappings().all()], "crs": CRS}


# ---------------------------------------------------------------- data layers (GeoJSON FeatureCollections)

@router.get("/layers/opportunities")
async def layer_opportunities(district: Optional[str] = None, unit_id: Optional[str] = None,
                              db: AsyncSession = Depends(get_db)):
    sql = """
        SELECT id, title, title_hi, category, description, score, score_factors, image_url,
               district_name, source, confidence, review_status, ST_AsGeoJSON(geom)::json AS geometry
        FROM opportunities WHERE review_status = 'verified'
          AND (CAST(:district AS text) IS NULL OR district_name ILIKE :district)""" + _in_unit("geom") + " ORDER BY score DESC"
    return await _features(db, sql, {"district": district, "uid": _uid(unit_id)})


@router.get("/layers/flora-fauna")
async def layer_flora_fauna(district: Optional[str] = None, unit_id: Optional[str] = None,
                            db: AsyncSession = Depends(get_db)):
    sql = """
        SELECT id, species_name, common_name, common_name_hi, type, description,
               district_name, source, confidence, ST_AsGeoJSON(geom)::json AS geometry
        FROM flora_fauna WHERE review_status = 'verified'
          AND (CAST(:district AS text) IS NULL OR district_name ILIKE :district)""" + _in_unit("geom")
    return await _features(db, sql, {"district": district, "uid": _uid(unit_id)})


@router.get("/layers/water-soil")
async def layer_water_soil(district: Optional[str] = None, unit_id: Optional[str] = None,
                           db: AsyncSession = Depends(get_db)):
    sql = """
        SELECT id, indicator_type, value, unit, quality_label, notes, district_name, source, confidence,
               collected_at, valid_until, ST_AsGeoJSON(geom)::json AS geometry
        FROM water_soil WHERE review_status = 'verified'
          AND (CAST(:district AS text) IS NULL OR district_name ILIKE :district)""" + _in_unit("geom")
    return await _features(db, sql, {"district": district, "uid": _uid(unit_id)})


@router.get("/layers/industrial")
async def layer_industrial(district: Optional[str] = None, unit_id: Optional[str] = None,
                           db: AsyncSession = Depends(get_db)):
    sql = """
        SELECT id, name, asset_type, sector, description, employment_est, district_name, source, confidence,
               ST_AsGeoJSON(geom)::json AS geometry
        FROM industrial_assets WHERE review_status = 'verified'
          AND (CAST(:district AS text) IS NULL OR district_name ILIKE :district)""" + _in_unit("geom")
    return await _features(db, sql, {"district": district, "uid": _uid(unit_id)})


@router.get("/layers/sustainable")
async def layer_sustainable(district: Optional[str] = None, unit_id: Optional[str] = None,
                            db: AsyncSession = Depends(get_db)):
    sql = """
        SELECT id, name, project_type, status, description, capacity_info, score, district_name, source, confidence,
               ST_AsGeoJSON(ST_PointOnSurface(geom))::json AS geometry
        FROM sustainable_projects WHERE review_status = 'verified'
          AND (CAST(:district AS text) IS NULL OR district_name ILIKE :district)""" + _in_unit("geom")
    return await _features(db, sql, {"district": district, "uid": _uid(unit_id)})


@router.get("/layers/conservation")
async def layer_conservation(district: Optional[str] = None, unit_id: Optional[str] = None,
                             db: AsyncSession = Depends(get_db)):
    sql = """
        SELECT id, name, name_hi, zone_type, description, district_name, source, confidence,
               ST_AsGeoJSON(geom)::json AS geometry
        FROM conservation_zones WHERE review_status = 'verified'
          AND (CAST(:district AS text) IS NULL OR district_name ILIKE :district)""" + _in_unit("geom")
    return await _features(db, sql, {"district": district, "uid": _uid(unit_id)})


@router.get("/layers/infrastructure")
async def layer_infrastructure(district: Optional[str] = None, unit_id: Optional[str] = None,
                               db: AsyncSession = Depends(get_db)):
    """District-level infrastructure summary markers derived from unit_profiles (until a point table exists)."""
    sql = """
        SELECT d.id, d.name AS title, d.district_code, d.level, p.infrastructure AS infra_json,
               ST_AsGeoJSON(d.centroid)::json AS geometry
        FROM admin_boundaries d JOIN unit_profiles p ON p.unit_id = d.id
        WHERE d.level = 'district' AND d.centroid IS NOT NULL AND p.infrastructure IS NOT NULL
          AND (CAST(:district AS text) IS NULL OR d.name ILIKE :district)""" + _in_unit("d.centroid")
    return await _features(db, sql, {"district": district, "uid": _uid(unit_id)})


@router.get("/layers/air")
async def layer_air(district: Optional[str] = None, unit_id: Optional[str] = None,
                    db: AsyncSession = Depends(get_db)):
    sql = """
        SELECT a.id, a.unit_id, a.airspace_class, a.max_usable_height_m, a.drone_corridor_score,
               a.solar_irradiance_avg, a.heritage_sensitivity, a.agrivoltaic_suitability, a.source, a.confidence,
               ST_AsGeoJSON(COALESCE(ST_PointOnSurface(a.geom), d.centroid))::json AS geometry, d.name AS district_name
        FROM air_resource a LEFT JOIN admin_boundaries d ON d.id = a.unit_id
        WHERE a.review_status = 'verified'
          AND (CAST(:district AS text) IS NULL OR d.name ILIKE :district)""" + _in_unit("COALESCE(a.geom, d.centroid)")
    return await _features(db, sql, {"district": district, "uid": _uid(unit_id)})


@router.get("/near")
async def features_near(lat: float = Query(..., ge=-90, le=90, description="Latitude (EPSG:4326)"),
                        lon: float = Query(..., ge=-180, le=180, description="Longitude (EPSG:4326)"),
                        radius_m: float = Query(5000, ge=1, le=200000, description="Search radius in metres"),
                        db: AsyncSession = Depends(get_db)):
    """Opportunities and flora/fauna within a radius of a point."""
    _guard_lonlat(lon, lat)
    point = f"SRID=4326;POINT({lon} {lat})"
    opp = await db.execute(text("""
        SELECT id, title, category, score, district_name,
               ST_Distance(geom::geography, ST_GeogFromText(:pt)) AS distance_m, ST_AsGeoJSON(geom)::json AS geometry
        FROM opportunities
        WHERE review_status = 'verified' AND ST_DWithin(geom::geography, ST_GeogFromText(:pt), :radius)
        ORDER BY distance_m LIMIT 20"""), {"pt": point, "radius": radius_m})
    ff = await db.execute(text("""
        SELECT id, species_name, common_name, type, district_name,
               ST_Distance(geom::geography, ST_GeogFromText(:pt)) AS distance_m, ST_AsGeoJSON(geom)::json AS geometry
        FROM flora_fauna
        WHERE review_status = 'verified' AND ST_DWithin(geom::geography, ST_GeogFromText(:pt), :radius)
        ORDER BY distance_m LIMIT 20"""), {"pt": point, "radius": radius_m})
    return {"opportunities": [dict(r) for r in opp.mappings()], "flora_fauna": [dict(r) for r in ff.mappings()], "crs": CRS}


# ---------------------------------------------------------------- boundaries & units

@router.get("/layers/boundaries")
async def layer_boundaries(
    level: Optional[str] = Query(None, description="state|district|block|village — omit for districts"),
    parent_id: Optional[str] = Query(None, description="Only direct children of this unit"),
    bbox: Optional[str] = Query(None, description="minx,miny,maxx,maxy in EPSG:4326"),
    db: AsyncSession = Depends(get_db),
):
    """Admin polygons from OUR database. Source of truth for the map."""
    clauses, params = ["geom IS NOT NULL"], {}
    if level:
        if level not in LEVELS:
            raise HTTPException(status_code=400, detail=f"level must be one of {', '.join(LEVELS)}")
        clauses.append("level = :lvl")
        params["lvl"] = level
    elif not parent_id:
        clauses.append("level = 'district'")
    if parent_id:
        clauses.append("parent_id = CAST(:pid AS uuid)")
        params["pid"] = _uid(parent_id)
    if bbox:
        try:
            minx, miny, maxx, maxy = [float(x) for x in bbox.split(",")]
        except ValueError:
            raise HTTPException(status_code=400, detail="bbox must be minx,miny,maxx,maxy (EPSG:4326 degrees)")
        clauses.append("geom && ST_MakeEnvelope(:minx,:miny,:maxx,:maxy, 4326)")
        params.update(minx=minx, miny=miny, maxx=maxx, maxy=maxy)
    result = await db.execute(text(f"""
        SELECT id, name, name_hi, level, district_code, parent_id, population, area_sqkm,
               ST_AsGeoJSON(CASE WHEN level IN ('state','district','block') THEN COALESCE(geom_simple, geom) ELSE geom END, 5)::json AS geometry, ST_X(centroid) AS lon, ST_Y(centroid) AS lat
        FROM admin_boundaries WHERE {' AND '.join(clauses)} ORDER BY level, name LIMIT 3000"""), params)
    features = []
    for r in result.mappings():
        props = dict(r)
        geom = props.pop("geometry", None)
        lon, lat = props.pop("lon", None), props.pop("lat", None)
        props["centroid"] = [lon, lat] if lon is not None else None
        props["crs"] = CRS
        if geom:
            features.append({"type": "Feature", "geometry": geom, "properties": props})
    return {"type": "FeatureCollection", "features": features, "crs": CRS}


_UNIT_SQL = """
    SELECT id, level, name, name_hi, parent_id, district_code, block_code, village_code, state_code,
           population, area_sqkm, properties, ST_AsGeoJSON(CASE WHEN level IN ('state','district','block') THEN COALESCE(geom_simple, geom) ELSE geom END, 5)::json AS geometry,
           ST_X(centroid) AS lon, ST_Y(centroid) AS lat,
           ST_XMin(geom) AS minx, ST_YMin(geom) AS miny, ST_XMax(geom) AS maxx, ST_YMax(geom) AS maxy
    FROM admin_boundaries WHERE id = CAST(:id AS uuid)"""


def _unit_dict(row) -> dict:
    d = dict(row)
    lon, lat = d.pop("lon", None), d.pop("lat", None)
    minx, miny, maxx, maxy = (d.pop(k, None) for k in ("minx", "miny", "maxx", "maxy"))
    d["centroid"] = [lon, lat] if lon is not None and lat is not None else None
    d["bbox"] = [minx, miny, maxx, maxy] if minx is not None else None
    d["crs"] = CRS
    d["geotag"] = {"lon": lon, "lat": lat, "crs": CRS} if lon is not None else None
    return d


@router.get("/unit/{unit_id}")
async def get_unit(unit_id: str, db: AsyncSession = Depends(get_db)):
    """One admin unit with polygon, centroid [lon,lat], bbox and geotag (EPSG:4326)."""
    row = (await db.execute(text(_UNIT_SQL), {"id": _uid(unit_id)})).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Unit not found")
    return _unit_dict(row)


@router.get("/unit/{unit_id}/children")
async def unit_children(unit_id: str, level: Optional[str] = Query(None, description="Filter child level: block|village"),
                        db: AsyncSession = Depends(get_db)):
    """Direct children (blocks under a district, villages under a block) as GeoJSON."""
    params = {"id": _uid(unit_id)}
    flt = ""
    if level:
        flt, params["level"] = " AND level = :level", level
    fc = await _features(db, f"""
        SELECT id, level, name, name_hi, parent_id, district_code, population, area_sqkm,
               ST_AsGeoJSON(CASE WHEN level IN ('state','district','block') THEN COALESCE(geom_simple, geom) ELSE geom END, 5)::json AS geometry
        FROM admin_boundaries WHERE parent_id = CAST(:id AS uuid){flt} AND geom IS NOT NULL
        ORDER BY name LIMIT 1500""", params)
    fc["parent_id"] = unit_id
    return fc


# Map-layer id (frontend) -> count query. Used for the per-unit feature counts in /focus.
_IN = "ST_Intersects({g}, (SELECT geom FROM admin_boundaries WHERE id = CAST(:id AS uuid)))"
_COUNT_SQL = {
    "opportunities": "SELECT count(*) FROM opportunities WHERE review_status='verified' AND " + _IN.format(g="geom"),
    "flora-fauna": "SELECT count(*) FROM flora_fauna WHERE review_status='verified' AND " + _IN.format(g="geom"),
    "water-soil": "SELECT count(*) FROM water_soil WHERE review_status='verified' AND " + _IN.format(g="geom"),
    "industrial": "SELECT count(*) FROM industrial_assets WHERE review_status='verified' AND " + _IN.format(g="geom"),
    "sustainable": "SELECT count(*) FROM sustainable_projects WHERE review_status='verified' AND " + _IN.format(g="geom"),
    "conservation": "SELECT count(*) FROM conservation_zones WHERE review_status='verified' AND " + _IN.format(g="geom"),
    "air": "SELECT count(*) FROM air_resource a LEFT JOIN admin_boundaries d ON d.id=a.unit_id WHERE a.review_status='verified' AND " + _IN.format(g="COALESCE(a.geom, d.centroid)"),
    "infrastructure": "SELECT count(*) FROM admin_boundaries d JOIN unit_profiles p ON p.unit_id=d.id WHERE d.level='district' AND p.infrastructure IS NOT NULL AND " + _IN.format(g="d.centroid"),
}


@router.get("/focus/{unit_id}")
async def focus_unit(unit_id: str, db: AsyncSession = Depends(get_db)):
    """Everything the map needs to show ONE place on its own, in a single call:
    the unit polygon + bbox, breadcrumb chain, its children as GeoJSON, and per-layer feature counts."""
    uid = _uid(unit_id)
    row = (await db.execute(text(_UNIT_SQL), {"id": uid})).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Unit not found")
    unit = _unit_dict(row)

    chain = await db.execute(text("""
        WITH RECURSIVE up AS (
            SELECT id, parent_id, level, name, name_hi, 0 AS depth FROM admin_boundaries WHERE id = CAST(:id AS uuid)
            UNION ALL
            SELECT a.id, a.parent_id, a.level, a.name, a.name_hi, up.depth + 1
            FROM admin_boundaries a JOIN up ON a.id = up.parent_id WHERE up.depth < 6)
        SELECT id, parent_id, level, name, name_hi FROM up ORDER BY depth DESC"""), {"id": uid})
    hierarchy = [dict(r) for r in chain.mappings()]

    children = await _features(db, """
        SELECT id, level, name, name_hi, parent_id, district_code, block_code, village_code, population, area_sqkm,
               ST_AsGeoJSON(CASE WHEN level IN ('state','district','block') THEN COALESCE(geom_simple, geom) ELSE geom END, 5)::json AS geometry
        FROM admin_boundaries WHERE parent_id = CAST(:id AS uuid) AND geom IS NOT NULL ORDER BY name LIMIT 1500""", {"id": uid})

    counts = {}
    for key, sql in _COUNT_SQL.items():
        try:
            counts[key] = int((await db.execute(text(sql), {"id": uid})).scalar() or 0)
        except Exception:  # table missing in an older database volume -> report 0, never break the page
            await db.rollback()
            counts[key] = 0
    return {"unit": unit, "hierarchy": hierarchy, "children": children,
            "child_level": CHILD_LEVEL.get(unit["level"]), "counts": counts, "crs": CRS}


# ---------------------------------------------------------------- geotagging & CRS

def _guard_lonlat(lon: float, lat: float) -> None:
    """Reject the two classic geotag mistakes: swapped axes and values outside India."""
    if 6 <= lon <= 38 and 68 <= lat <= 98:
        raise HTTPException(status_code=400, detail=f"lon/lat look swapped. EPSG:4326 order is longitude,latitude "
                                                    f"(e.g. Ayodhya lon=82.12, lat=26.80). Got lon={lon}, lat={lat}.")
    if not (68 <= lon <= 98 and 6 <= lat <= 38):
        raise HTTPException(status_code=400, detail=f"lon={lon}, lat={lat} is outside India (lon 68-98, lat 6-38). "
                                                    "Coordinates must be EPSG:4326 decimal degrees, not projected metres.")


@router.get("/at")
async def unit_at_point(lon: float = Query(..., description="Longitude, EPSG:4326 degrees"),
                        lat: float = Query(..., description="Latitude, EPSG:4326 degrees"),
                        db: AsyncSession = Depends(get_db)):
    """Geotag lookup: which village / block / district contains this GPS point?"""
    _guard_lonlat(lon, lat)
    result = await db.execute(text("""
        SELECT id, level, name, name_hi, parent_id FROM admin_boundaries
        WHERE geom IS NOT NULL AND ST_Covers(geom, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326))
        ORDER BY CASE level WHEN 'state' THEN 0 WHEN 'district' THEN 1 WHEN 'block' THEN 2 ELSE 3 END"""),
        {"lon": lon, "lat": lat})
    chain = [dict(r) for r in result.mappings()]
    return {"geotag": {"lon": lon, "lat": lat, "crs": CRS}, "found": bool(chain), "chain": chain,
            "unit": chain[-1] if chain else None,
            "message": None if chain else "Point is inside India but not inside any unit loaded in the database yet."}


@router.get("/crs-check")
async def crs_check(deep: bool = Query(False, description="check every row (slow on 100k villages)"), db: AsyncSession = Depends(get_db)):
    """Live CRS / geometry audit of the whole database (see database/02_geo_integrity.sql)."""
    try:
        rows = [dict(r) for r in (await db.execute(text("SELECT * FROM pris_geo_audit(:deep)"), {"deep": deep})).mappings()]
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=503, detail="pris_geo_audit() is missing. Run database/02_geo_integrity.sql "
                                                    "(or recreate the volume: docker compose down -v && docker compose up --build).")
    counts = (await db.execute(text("SELECT level, count(*) AS n FROM admin_boundaries GROUP BY level"))).mappings().all()
    errors = sum(1 for r in rows if r["severity"] == "error" and r["n"])
    warnings = sum(1 for r in rows if r["severity"] == "warning" and r["n"])
    return {"crs": CRS, "axis_order": "longitude,latitude", "ok": errors == 0, "errors": errors, "warnings": warnings,
            "units_by_level": {c["level"]: c["n"] for c in counts}, "checks": rows}
