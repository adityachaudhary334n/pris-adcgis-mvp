# CRS & geotagging rules

* Everything is **EPSG:4326 (WGS84)**. Coordinate order is **(longitude, latitude)** in degrees. India: lon 68–98, lat 6–38.
* The database enforces it (`database/02_geo_integrity.sql`): swapped or projected (metre) coordinates are rejected with a clear message;
  invalid polygons are repaired; hierarchy must be state > district > block > village.
* **Geotagging**: insert a point into `opportunities`, `flora_fauna`, `water_soil`, `industrial_assets`, `sustainable_projects` using
  `pris_point(lon, lat)`; `unit_id` and `district_name` are filled automatically from the village/block/district that contains it.
  ```sql
  INSERT INTO flora_fauna (species_name, common_name, type, geom, source)
  VALUES ('Mangifera indica','Mango','flora', pris_point(82.12, 26.80), 'field survey');
  ```
* Other CRS (UTM, EPSG:3857, shapefiles): `ogr2ogr -t_srs EPSG:4326 out.geojson in.shp`, or `ST_Transform(geom, 4326)`.
* Check anytime: `GET /api/spatial/crs-check` (add `?deep=true` for every row), and `GET /api/spatial/at?lon=..&lat=..` (which village is this GPS point in?).
