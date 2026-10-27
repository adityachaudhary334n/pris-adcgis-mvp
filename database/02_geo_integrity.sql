-- ============================================================
-- PRIS + adcGIS  |  Geo-integrity layer
-- CRS: EPSG:4326 (WGS84). Coordinates are ALWAYS (longitude, latitude) in decimal degrees.
-- Runs after init.sql and BEFORE the seed so every row (seed or later user inserts) is checked.
--   * pris_point(lon, lat)        safe geotag constructor (rejects swapped / out-of-range values)
--   * pris_to_4326(geom)          normalise any geometry to EPSG:4326 (SRID 0 is treated as lon/lat)
--   * pris_locate(lon, lat)       smallest admin unit containing a GPS point
--   * pris_geo_audit()            full audit report (also served by GET /api/spatial/crs-check)
--   * triggers                    validity, India-bounds, parent-level and auto geotag->unit linking
-- ============================================================

-- India envelope used for sanity checks (generous): lon 68..98, lat 6..38
CREATE OR REPLACE FUNCTION pris_point(lon double precision, lat double precision)
RETURNS geometry LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF lon IS NULL OR lat IS NULL THEN RAISE EXCEPTION 'pris_point: lon/lat must not be NULL'; END IF;
  IF lat BETWEEN 68 AND 98 AND lon BETWEEN 6 AND 38 THEN
    RAISE EXCEPTION 'pris_point(%, %): looks like latitude/longitude are swapped. EPSG:4326 order is (longitude, latitude); India is lon 68-98, lat 6-38.', lon, lat;
  END IF;
  IF lon NOT BETWEEN 68 AND 98 OR lat NOT BETWEEN 6 AND 38 THEN
    RAISE EXCEPTION 'pris_point(%, %): outside India (lon 68-98, lat 6-38). Are these projected metres (UTM/EPSG:3857)? Convert to EPSG:4326 first.', lon, lat;
  END IF;
  RETURN ST_SetSRID(ST_MakePoint(lon, lat), 4326);
END $$;

CREATE OR REPLACE FUNCTION pris_to_4326(g geometry)
RETURNS geometry LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN g IS NULL THEN NULL
              WHEN ST_SRID(g) = 4326 THEN g
              WHEN ST_SRID(g) = 0 THEN ST_SetSRID(g, 4326)
              ELSE ST_Transform(g, 4326) END
$$;

CREATE OR REPLACE FUNCTION pris_level_rank(l text) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE l WHEN 'state' THEN 0 WHEN 'district' THEN 1 WHEN 'block' THEN 2 WHEN 'village' THEN 3 WHEN 'suburb' THEN 3 END
$$;

-- Smallest administrative unit that contains a GPS point (the "geotag -> place" lookup)
CREATE OR REPLACE FUNCTION pris_locate(lon double precision, lat double precision)
RETURNS TABLE(id uuid, level text, name text, parent_id uuid) LANGUAGE sql STABLE AS $$
  SELECT a.id, a.level::text, a.name::text, a.parent_id
  FROM admin_boundaries a
  WHERE a.geom IS NOT NULL AND ST_Covers(a.geom, ST_SetSRID(ST_MakePoint(lon, lat), 4326))
  ORDER BY pris_level_rank(a.level) DESC
$$;

-- ---------- admin_boundaries guard ----------
CREATE OR REPLACE FUNCTION pris_admin_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pg geometry; plevel text;
BEGIN
  IF NEW.geom IS NOT NULL THEN
    IF NOT ST_IsValid(NEW.geom) THEN
      NEW.geom := ST_Multi(ST_CollectionExtract(ST_MakeValid(NEW.geom), 3));
    END IF;
    IF ST_IsEmpty(NEW.geom) THEN RAISE EXCEPTION 'admin_boundaries "%": empty geometry', NEW.name; END IF;
    IF ST_XMin(NEW.geom) < 68 OR ST_XMax(NEW.geom) > 98 OR ST_YMin(NEW.geom) < 6 OR ST_YMax(NEW.geom) > 38 THEN
      RAISE EXCEPTION 'admin_boundaries "%": geometry lies outside India (lon 68-98, lat 6-38). EPSG:4326 expects (longitude, latitude) degrees - swapped axes or projected metres?', NEW.name;
    END IF;
    IF NEW.centroid IS NULL THEN NEW.centroid := ST_PointOnSurface(NEW.geom); END IF;
    IF NEW.area_sqkm IS NULL THEN NEW.area_sqkm := ROUND((ST_Area(NEW.geom::geography) / 1e6)::numeric, 4); END IF;
  END IF;
  IF NEW.centroid IS NOT NULL AND (ST_X(NEW.centroid) NOT BETWEEN 68 AND 98 OR ST_Y(NEW.centroid) NOT BETWEEN 6 AND 38) THEN
    RAISE EXCEPTION 'admin_boundaries "%": centroid (%, %) is outside India - lon/lat swapped?', NEW.name, ST_X(NEW.centroid), ST_Y(NEW.centroid);
  END IF;
  IF NEW.parent_id IS NOT NULL THEN
    SELECT a.geom, a.level INTO pg, plevel FROM admin_boundaries a WHERE a.id = NEW.parent_id;
    IF plevel IS NULL THEN RAISE EXCEPTION 'admin_boundaries "%": parent % does not exist', NEW.name, NEW.parent_id; END IF;
    IF pris_level_rank(plevel) >= pris_level_rank(NEW.level) THEN
      RAISE EXCEPTION 'admin_boundaries "%": a % cannot sit under a % (hierarchy is state > district > block > village)', NEW.name, NEW.level, plevel;
    END IF;
    IF pg IS NOT NULL AND NEW.geom IS NOT NULL AND NOT ST_Intersects(pg, ST_PointOnSurface(NEW.geom)) THEN
      RAISE WARNING 'admin_boundaries "%": its representative point is not inside the parent polygon. Check parent_id or boundary vintage.', NEW.name;
    END IF;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_admin_geoguard ON admin_boundaries;
CREATE TRIGGER trg_admin_geoguard BEFORE INSERT OR UPDATE ON admin_boundaries
  FOR EACH ROW EXECUTE FUNCTION pris_admin_guard();

-- ---------- geotagged observation tables guard ----------
-- Rejects swapped / out-of-India coordinates and auto-links the point to the smallest admin unit
-- (and district_name) that contains it when the caller did not provide them.
CREATE OR REPLACE FUNCTION pris_point_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p geometry; x double precision; y double precision; uid uuid; dname text; j jsonb;
BEGIN
  IF NEW.geom IS NULL THEN RETURN NEW; END IF;
  IF NOT ST_IsValid(NEW.geom) THEN NEW.geom := ST_MakeValid(NEW.geom); END IF;
  p := ST_PointOnSurface(NEW.geom); x := ST_X(p); y := ST_Y(p);
  IF y BETWEEN 68 AND 98 AND x BETWEEN 6 AND 38 THEN
    RAISE EXCEPTION '%: geotag (%, %) looks swapped. Use (longitude, latitude) e.g. Ayodhya = 82.12, 26.80', TG_TABLE_NAME, x, y;
  END IF;
  IF x NOT BETWEEN 68 AND 98 OR y NOT BETWEEN 6 AND 38 THEN
    RAISE EXCEPTION '%: geotag (%, %) is outside India. Expected EPSG:4326 degrees (lon 68-98, lat 6-38).', TG_TABLE_NAME, x, y;
  END IF;
  j := to_jsonb(NEW);
  IF j ? 'unit_id' AND (j->>'unit_id') IS NULL THEN
    SELECT a.id INTO uid FROM admin_boundaries a
      WHERE a.geom IS NOT NULL AND ST_Covers(a.geom, p) ORDER BY pris_level_rank(a.level) DESC LIMIT 1;
    IF uid IS NOT NULL THEN NEW := jsonb_populate_record(NEW, jsonb_build_object('unit_id', uid)); END IF;
  END IF;
  IF j ? 'district_name' AND (j->>'district_name') IS NULL THEN
    SELECT d.name INTO dname FROM admin_boundaries d WHERE d.level = 'district' AND d.geom IS NOT NULL AND ST_Covers(d.geom, p) LIMIT 1;
    IF dname IS NOT NULL THEN NEW := jsonb_populate_record(NEW, jsonb_build_object('district_name', dname)); END IF;
  END IF;
  RETURN NEW;
END $$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['opportunities','flora_fauna','water_soil','industrial_assets','sustainable_projects','conservation_zones'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_geoguard ON %I', t, t);
      EXECUTE format('CREATE TRIGGER trg_%s_geoguard BEFORE INSERT OR UPDATE OF geom ON %I FOR EACH ROW EXECUTE FUNCTION pris_point_guard()', t, t);
    END IF;
  END LOOP;
END $$;

-- ---------- audit ----------
-- severity: ok | warning | error. n = number of offending rows (0 = healthy).
CREATE OR REPLACE FUNCTION pris_geo_audit(deep boolean DEFAULT false)
RETURNS TABLE(check_name text, table_name text, severity text, n bigint, detail text) LANGUAGE plpgsql STABLE AS $$
DECLARE t text; cnt bigint; r record;
BEGIN
  -- 1. every geometry column must be EPSG:4326
  FOR r IN SELECT f_table_name AS tn, f_geometry_column AS col, srid FROM geometry_columns WHERE f_table_schema = 'public' LOOP
    check_name := 'column_srid_4326'; table_name := r.tn; n := CASE WHEN r.srid = 4326 THEN 0 ELSE 1 END;
    severity := CASE WHEN r.srid = 4326 THEN 'ok' ELSE 'error' END;
    detail := format('%s.%s declared SRID %s', r.tn, r.col, r.srid); RETURN NEXT;
  END LOOP;

  table_name := 'admin_boundaries';
  SELECT count(*) INTO cnt FROM admin_boundaries WHERE geom IS NULL;
  check_name := 'missing_geometry'; n := cnt; severity := CASE WHEN cnt = 0 THEN 'ok' ELSE 'warning' END; detail := 'units without polygon'; RETURN NEXT;
  SELECT count(*) INTO cnt FROM admin_boundaries WHERE geom IS NOT NULL AND NOT ST_IsValid(geom);
  check_name := 'invalid_geometry'; n := cnt; severity := CASE WHEN cnt = 0 THEN 'ok' ELSE 'error' END; detail := 'self-intersections etc. (fix with ST_MakeValid)'; RETURN NEXT;
  SELECT count(*) INTO cnt FROM admin_boundaries WHERE geom IS NOT NULL AND (ST_XMin(geom) < 68 OR ST_XMax(geom) > 98 OR ST_YMin(geom) < 6 OR ST_YMax(geom) > 38);
  check_name := 'outside_india_bbox'; n := cnt; severity := CASE WHEN cnt = 0 THEN 'ok' ELSE 'error' END; detail := 'swapped lon/lat or projected metres'; RETURN NEXT;
  SELECT count(*) INTO cnt FROM admin_boundaries WHERE geom IS NOT NULL AND centroid IS NOT NULL AND NOT ST_Intersects(geom, centroid);
  check_name := 'centroid_outside_polygon'; n := cnt; severity := CASE WHEN cnt = 0 THEN 'ok' ELSE 'warning' END; detail := 'centroid not inside its own polygon'; RETURN NEXT;
  -- representative point of the child must lie inside the parent (index-friendly). deep=true tests every row, else a 3% sample.
  IF deep THEN
    SELECT count(*) INTO cnt FROM admin_boundaries c JOIN admin_boundaries p ON p.id = c.parent_id
      WHERE c.geom IS NOT NULL AND p.geom IS NOT NULL AND NOT ST_Intersects(p.geom, ST_PointOnSurface(c.geom));
  ELSE
    SELECT count(*) INTO cnt FROM admin_boundaries c TABLESAMPLE BERNOULLI (3) JOIN admin_boundaries p ON p.id = c.parent_id
      WHERE c.geom IS NOT NULL AND p.geom IS NOT NULL AND NOT ST_Intersects(p.geom, ST_PointOnSurface(c.geom));
  END IF;
  check_name := 'child_outside_parent'; n := cnt; severity := CASE WHEN cnt = 0 THEN 'ok' ELSE 'warning' END; detail := CASE WHEN deep THEN 'all rows checked' ELSE '3% sample checked (use ?deep=true for all)' END; RETURN NEXT;
  SELECT count(*) INTO cnt FROM admin_boundaries c JOIN admin_boundaries p ON p.id = c.parent_id WHERE pris_level_rank(p.level) >= pris_level_rank(c.level);
  check_name := 'bad_parent_level'; n := cnt; severity := CASE WHEN cnt = 0 THEN 'ok' ELSE 'error' END; detail := 'state > district > block > village order violated'; RETURN NEXT;
  SELECT count(*) INTO cnt FROM admin_boundaries WHERE parent_id IS NULL AND level <> 'state';
  check_name := 'orphan_unit'; n := cnt; severity := CASE WHEN cnt = 0 THEN 'ok' ELSE 'warning' END; detail := 'non-state unit without parent'; RETURN NEXT;

  FOREACH t IN ARRAY ARRAY['opportunities','flora_fauna','water_soil','industrial_assets','sustainable_projects','conservation_zones'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    table_name := t;
    EXECUTE format('SELECT count(*) FROM %I WHERE geom IS NOT NULL AND (ST_X(ST_PointOnSurface(geom)) NOT BETWEEN 68 AND 98 OR ST_Y(ST_PointOnSurface(geom)) NOT BETWEEN 6 AND 38)', t) INTO cnt;
    check_name := 'geotag_outside_india'; n := cnt; severity := CASE WHEN cnt = 0 THEN 'ok' ELSE 'error' END; detail := 'lon/lat swapped or wrong CRS'; RETURN NEXT;
    IF EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = t AND c.column_name = 'unit_id') THEN
      EXECUTE format('SELECT count(*) FROM %I x JOIN admin_boundaries u ON u.id = x.unit_id WHERE x.geom IS NOT NULL AND u.geom IS NOT NULL AND NOT ST_Intersects(ST_Buffer(u.geom, 0.0005), x.geom)', t) INTO cnt;
      check_name := 'geotag_outside_its_unit'; n := cnt; severity := CASE WHEN cnt = 0 THEN 'ok' ELSE 'warning' END; detail := 'point lies outside the unit it is linked to'; RETURN NEXT;
    END IF;
  END LOOP;
END $$;
