# Opportunity Engine → PRIS + adcGIS integration

## User flow
1. Select a district on the map (or search / quick chips).
2. Information panel shows:
   - **District information**
   - **Open Opportunity Engine** (district already chosen)
3. Engine panel loads diagnostics + ranked startups for that district only.

## Backend
- Module: `backend/app/diagnostics/`
- Data: Prajna Phase_1 / Phase_2 / Phase_3 CSVs under `diagnostics/data/`
- Endpoints:
  - `GET /api/diagnostics/districts`
  - `GET /api/diagnostics/{district}`
- Static images: `GET /api/diagnostics/static/startup_images/<file>`
- Fuzzy district matching + aliases (e.g. Gautam Buddha Nagar → Noida)

Pilot sample districts: Ayodhya, Bahraich, Banda, Gorakhpur, Jhansi, Lucknow, Noida, Saharanpur, Siddharthnagar, Varanasi.

## Frontend
- `components/diagnostics/OpportunityEngine.tsx`
  - Index rings, radar, bars, need-vs-readiness quadrant
  - Capability snapshot, top potentials
  - Ranked startup ideas **with images** (never blank)
- Entry button in `app/page.tsx` when a district is focused

## Startup images (no blank cards)
| Location | Purpose |
|----------|---------|
| `frontend/public/startup_images/` | Served as `/startup_images/...` (primary) |
| `backend/app/diagnostics/static/startup_images/` | Served as `/api/diagnostics/static/startup_images/...` (fallback) |

Drop real photos using the **exact basename** from `startup_ideas.csv` → `image_path`.
Until then, sector-colored SVG placeholders fill the space.

Regenerate placeholders:
```bash
python scripts/generate_startup_placeholders.py
```

## Why not Streamlit
One app, one district selection path, charts matched to the dark PRIS theme.
