# Sample Data & Test Cases — PRIS + adcGIS

Use this document for demos, judging, and regression checks after install.

---

## 1. Sample data included in the repo

| Asset | Location | What it is |
|-------|----------|------------|
| Pilot districts + layers | `database/02_seed_data.sql` | 6 districts (Ayodhya, Agra, Lucknow, Varanasi, Gorakhpur, Kaushambi), sample village, 12 opportunities, flora/water/industrial/sustainable/conservation points |
| District full profiles | `data/district_profiles.json` | Geography, demographics, history with **per-field sources** for the same six districts |
| Village hierarchy (optional) | `data/up_villages_structured.geojson` | ~75 districts, ~97k villages (large file; used by full import) |
| Official district outlines | `data/official_up_districts.geojson` | Reference polygons for map alignment |

### Seed profile districts (open these in the UI)

| District | Why useful in demo |
|----------|-------------------|
| **Lucknow** | Capital, strong services story, full profile + sources |
| **Agra** | Heritage (Taj/Fort), tourism + industry |
| **Varanasi** | Pilgrimage, Ganga, conservation context |
| **Ayodhya** | Cultural heritage + recent development narrative |
| **Gorakhpur** | Flood-prone eastern plain, agrarian base |
| **Kaushambi** | Predominantly rural district profile |

### Example field with source (Lucknow literacy)

```json
"literacy_rate": {
  "value": 77.3,
  "unit": "%",
  "year": 2011,
  "source": "Census of India 2011 – District Census Handbook",
  "confidence": 0.95
}
```

Primary citation families: **Census of India 2011**, **CGWB**, **IMD**, **ASI/UNESCO**, **District Gazetteers**, **NHAI/MoRTH**, **UP SDMA/NDMA**.

---

## 2. How to load sample data

```bash
# Fresh stack (runs init.sql + 02_seed_data.sql once)
docker compose down -v
docker compose up --build

# Full district profiles (required for "View full district profile")
docker compose exec api python /scripts/seed_district_profiles.py

# Optional statewide hierarchy
docker compose exec api python /scripts/import_up_villages.py
```

---

## 3. Manual test cases

Mark **Pass / Fail**. Expected results assume seed + `seed_district_profiles.py` completed.

### A. Platform health

| ID | Steps | Expected |
|----|--------|----------|
| A1 | Open `http://localhost:8000/health` | JSON `status: ok` |
| A2 | Open `http://localhost:8000/docs` | Swagger UI loads |
| A3 | Open `http://localhost:3000` | Map UI loads (hard refresh if needed) |

### B. Search & selection

| ID | Steps | Expected |
|----|--------|----------|
| B1 | Search **Lucknow** | Result appears; selecting it focuses map / opens unit panel |
| B2 | Search **Ayodhya** | Same behaviour |
| B3 | Search nonsense string `zzzznotaplace` | Honest empty / no results message |

### C. District full profile (core feature)

| ID | Steps | Expected |
|----|--------|----------|
| C1 | Select **Lucknow** | Scores section visible; area/population strip if present |
| C2 | Click **View full district profile** | Full profile view opens |
| C3 | Open **Geography** tab | Topography / hydrography / climate (or nested fields) with text under each field |
| C4 | Check a field source line | Text like `Source: Census…` or CGWB / IMD appears under values |
| C5 | Open **Demographics** | Population, literacy, sex ratio, etc. |
| C6 | Open **History** | Foundation, heritage, milestones |
| C7 | Open **All sources cited** | Numbered list of unique sources |
| C8 | **Back to scores** | Returns to main profile panel |
| C9 | Repeat C1–C4 for **Agra** or **Varanasi** | Same structure; different content |

### D. Map layers & opportunities

| ID | Steps | Expected |
|----|--------|----------|
| D1 | Toggle **Enterprise opportunities** | Points visible (seed has 12) |
| D2 | Open opportunities list for selected district | Cards or empty state (never silent crash) |
| D3 | Toggle water/soil or flora if available | Features or “No data yet” — toggles stay usable |

### E. API profile contract

| ID | Steps | Expected |
|----|--------|----------|
| E1 | After selecting Lucknow, note `unit_id` from network tab **or** list profiles: `GET /api/profiles/?level=district` | JSON list includes districts |
| E2 | `GET /api/profiles/{unit_id}` for Lucknow | Body includes `district_profile.geography`, `.demographics`, `.history`, and `sources` array |
| E3 | Confirm a `sources[].source` string is non-empty | Citations present |

Example:

```bash
curl -s "http://localhost:8000/api/profiles/?level=district&limit=10" | head -c 500
```

### F. Honesty / empty states

| ID | Steps | Expected |
|----|--------|----------|
| F1 | Select a unit with no full pack (if any after seed-only) | No crash; message that profile is not fully computed or CTA absent |
| F2 | Domain tab with no data | “No data in this section yet” (or equivalent) |

### G. Downloads (if unit is verified)

| ID | Steps | Expected |
|----|--------|----------|
| G1 | With a selected verified unit, use PDF / CSV / GeoJSON actions | Download starts or endpoint returns a file (not 500) |

### H. PAI-lite (optional)

| ID | Steps | Expected |
|----|--------|----------|
| H1 | Ask “What can I start here?” with a district selected | Answer or clear “no data” style response; no invented census numbers |
| H2 | Without `LLM_API_KEY` | Deterministic fallback still responds |

---

## 4. Suggested 5-minute judge path

1. `docker compose up --build` → health OK  
2. `seed_district_profiles.py`  
3. Open UI → **Lucknow** → **View full district profile** → show **Sources** tab  
4. Toggle opportunities layer  
5. Open `http://localhost:8000/docs` briefly  

---

## 5. Known limitations (honest scope)

- Full narrative packs currently cover **six** districts; remaining districts have index/seed profiles only until data is expanded.  
- Census figures in the pack are **2011**-anchored with explicit year; production use should refresh from the latest official releases.  
- Large village GeoJSON import is optional and can take 10–30 minutes.  

---

*For architecture and data model, see `docs/TECHNICAL_DESIGN.md`. For install and environment variables, see the project README.*
