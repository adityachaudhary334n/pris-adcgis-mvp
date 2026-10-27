# District profiles

`up_75_districts_profile.json` — one object per district: `district`, `division`, `metadata_source`, and any number of
sections (currently `geography`, `demography`, `history`), each a flat `{field: value}` object.

## Adding more information (no code changes)
1. Put more data in `extra/<anything>.json` using the SAME shape, e.g.
   `{"Agra": {"economy": {"major_crops": "wheat, potato, mustard", "gdp_note": "..."}}, "Lucknow": {...}}`
   New sections and new fields are picked up automatically; an existing field is overwritten by the later file (files merge in name order).
2. `python3 scripts/build_district_info.py`
3. Apply to the RUNNING database (no volume reset): `docker compose exec -T db psql -U pris -d pris_db < data/clean/district_info_load.sql`

The build reports which fields are still **generic** (same text in >= 10 districts) in `data/clean/district_info_report.json`;
the app labels those "General note — not specific to this district yet". Replace them with district-specific values to clear the label.
