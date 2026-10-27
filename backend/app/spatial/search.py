"""Statewide name search across districts, blocks, villages, suburbs (English or Hindi)."""
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter()

LEVELS = ("state", "district", "block", "village", "suburb")
# Fallback when pris_level_rank() (02_geo_integrity.sql) is not installed.
RANK_SQL = "CASE a.level WHEN 'state' THEN 0 WHEN 'district' THEN 1 WHEN 'block' THEN 2 ELSE 3 END"


def _point_xy(geom: Any):
    """GeoJSON Point -> [lon, lat] or None (EPSG:4326)."""
    if not geom:
        return None
    if isinstance(geom, (list, tuple)) and len(geom) >= 2:
        return [float(geom[0]), float(geom[1])]
    if isinstance(geom, dict):
        c = geom.get("coordinates")
        if isinstance(c, (list, tuple)) and len(c) >= 2:
            return [float(c[0]), float(c[1])]
    return None


def _like(q: str) -> str:
    """Escape LIKE wildcards so a user typing % or _ cannot widen the match."""
    return "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


@router.get("/search")
async def search_places(
    q: str = Query(..., min_length=2, max_length=100, description="Place name (English or Hindi)"),
    level: Optional[str] = Query(None, description="state|district|block|village|suburb"),
    parent_id: Optional[str] = Query(None, description="Only search inside this unit (any depth)"),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Search any administrative unit. Each hit carries its district/block names, centroid [lon,lat]
    and bbox [minx,miny,maxx,maxy] (EPSG:4326) so the map can fly straight to it."""
    if level and level not in LEVELS:
        raise HTTPException(status_code=400, detail=f"level must be one of {', '.join(LEVELS)}")
    scope = ""
    params: dict = {"q": q.strip(), "pat": _like(q.strip()), "lim": limit}
    if level:
        scope += " AND a.level = :level"
        params["level"] = level
    if parent_id:
        try:
            uuid.UUID(parent_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="parent_id must be a UUID")
        # descendants of parent_id at any depth
        scope += """ AND a.id IN (
            WITH RECURSIVE d AS (SELECT id FROM admin_boundaries WHERE parent_id = CAST(:pid AS uuid)
                                 UNION ALL SELECT c.id FROM admin_boundaries c JOIN d ON c.parent_id = d.id)
            SELECT id FROM d)"""
        params["pid"] = parent_id

    sql = f"""
        SELECT a.id, a.level, a.name, a.name_hi, a.district_code, a.parent_id, a.population, a.area_sqkm,
               CASE WHEN a.level = 'district' THEN a.name WHEN p.level = 'district' THEN p.name
                    WHEN pp.level = 'district' THEN pp.name END AS district,
               CASE WHEN a.level = 'block' THEN a.name WHEN p.level = 'block' THEN p.name END AS block,
               a.village_code, a.block_code, ST_AsGeoJSON(COALESCE(a.centroid, ST_PointOnSurface(a.geom)))::json AS centroid_g,
               ST_XMin(a.geom) AS minx, ST_YMin(a.geom) AS miny, ST_XMax(a.geom) AS maxx, ST_YMax(a.geom) AS maxy,
               GREATEST(similarity(a.name, :q), similarity(COALESCE(a.name_hi, ''), :q)) AS score
        FROM admin_boundaries a
        LEFT JOIN admin_boundaries p  ON p.id  = a.parent_id
        LEFT JOIN admin_boundaries pp ON pp.id = p.parent_id
        WHERE (a.name ILIKE :pat OR a.name_hi ILIKE :pat OR (a.properties->>'name_soi') ILIKE :pat
               OR similarity(a.name, :q) > 0.3 OR similarity(COALESCE(a.name_hi, ''), :q) > 0.3)
          {scope}
        ORDER BY
            CASE WHEN lower(a.name) = lower(:q) OR a.name_hi = :q OR lower(a.properties->>'name_soi') = lower(:q) THEN 0
                 WHEN a.name ILIKE :q || '%' OR (a.properties->>'name_soi') ILIKE :q || '%' THEN 1 ELSE 2 END,
            {RANK_SQL},
            score DESC,
            a.population DESC NULLS LAST,
            a.name
        LIMIT :lim
    """
    result = await db.execute(text(sql), params)
    rows = []
    for r in result.mappings():
        d = dict(r)
        d["centroid"] = _point_xy(d.pop("centroid_g", None))
        minx, miny, maxx, maxy = (d.pop(k, None) for k in ("minx", "miny", "maxx", "maxy"))
        d["bbox"] = [minx, miny, maxx, maxy] if minx is not None else None
        d["crs"] = "EPSG:4326"
        d["path"] = ", ".join(x for x in (d["name"], d.get("block") if d["level"] == "village" else None,
                                          d.get("district") if d["level"] != "district" else None) if x)
        rows.append(d)
    return {"query": q, "count": len(rows), "results": rows, "crs": "EPSG:4326"}


@router.get("/hierarchy/{unit_id}")
async def get_hierarchy(unit_id: str, db: AsyncSession = Depends(get_db)):
    """Parent chain (state > district > block > village), the unit itself and its direct children."""
    try:
        uuid.UUID(unit_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="unit_id must be a UUID")
    unit = await db.execute(text("""
        SELECT id, level, name, name_hi, parent_id, district_code, population, area_sqkm,
               ST_AsGeoJSON(centroid)::json AS centroid
        FROM admin_boundaries WHERE id = :id
    """), {"id": unit_id})
    u = unit.mappings().first()
    if not u:
        raise HTTPException(status_code=404, detail="Unit not found")
    unit_dict = dict(u)
    unit_dict["centroid"] = _point_xy(unit_dict.get("centroid"))

    chain = await db.execute(text("""
        WITH RECURSIVE up AS (
            SELECT id, parent_id, level, name, name_hi, 0 AS depth FROM admin_boundaries WHERE id = :id
            UNION ALL
            SELECT a.id, a.parent_id, a.level, a.name, a.name_hi, up.depth + 1
            FROM admin_boundaries a JOIN up ON a.id = up.parent_id WHERE up.depth < 6)
        SELECT id, parent_id, level, name, name_hi FROM up ORDER BY depth DESC
    """), {"id": unit_id})
    hierarchy = [dict(r) for r in chain.mappings()]
    parents = hierarchy[:-1]

    kids = await db.execute(text("""
        SELECT id, level, name, name_hi, population, area_sqkm,
               ST_AsGeoJSON(centroid)::json AS centroid
        FROM admin_boundaries WHERE parent_id = :id ORDER BY name LIMIT 300
    """), {"id": unit_id})
    children = []
    for c in kids.mappings():
        d = dict(c)
        d["centroid"] = _point_xy(d.get("centroid"))
        children.append(d)
    return {"unit": unit_dict, "parents": parents, "children": children, "hierarchy": hierarchy, "crs": "EPSG:4326"}
