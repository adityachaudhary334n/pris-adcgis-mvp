# Data

| File | Role |
|------|------|
| `up_villages.geojson` | **Raw input** (Survey of India + LGD, ~101k village polygons). Not needed to run the app — only to rebuild. Put it here if you want to regenerate. |
| `clean/up_admin_load.sql.gz` | **Generated, loaded automatically** by Postgres on first start: state → 75 districts → 830 blocks → 101,533 villages (EPSG:4326). |
| `clean/up_hierarchy.json` | Light tree (ids, names, counts, bboxes) — no polygons. |
| `clean/quality_report.json` | What the cleaning fixed/merged/dropped. |

Rebuild: `pip install shapely pyproj` then `python3 scripts/build_up_admin.py`, then `docker compose down -v && docker compose up --build`.
