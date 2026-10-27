-- Runs once after the seed. Hard-fails only on real CRS/geometry errors; hierarchy issues are warnings.
DO $$
DECLARE r record; errs int := 0; warns int := 0;
BEGIN
  FOR r IN SELECT * FROM pris_geo_audit() WHERE severity <> 'ok' LOOP
    IF r.severity = 'error' THEN errs := errs + 1; RAISE WARNING '[GEO ERROR] %.% -> % rows (%)', r.table_name, r.check_name, r.n, r.detail;
    ELSE warns := warns + 1; RAISE WARNING '[GEO WARN ] %.% -> % rows (%)', r.table_name, r.check_name, r.n, r.detail; END IF;
  END LOOP;
  RAISE NOTICE 'PRIS geo audit: % error(s), % warning(s). CRS = EPSG:4326 (lon, lat).', errs, warns;
  IF errs > 0 THEN RAISE EXCEPTION 'PRIS geo audit failed - fix the errors above (see docs/CRS_AND_GEOTAGGING.md)'; END IF;
END $$;
