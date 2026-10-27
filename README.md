# PRIS + adcGIS Community Engine

**Prajna Regional Intelligence System** — statewide spatial intelligence for **Uttar Pradesh**.

Land **and the air volume above it** as structured assets. Multi-profile intelligence, **cited district profiles** (geography · demographics · history), livelihood opportunities, PAI-lite, and downloadable briefing packs (PDF / CSV / GeoJSON).

Built for social impact: community members, planners, and social enterprises get honest, source-backed place intelligence — and where data is missing, the system says so.

| | |
|---|---|
| **License** | MIT (see `LICENSE`) |
| **Stack** | Next.js · FastAPI · PostgreSQL 16 + PostGIS · Martin |
| **Docs** | [Technical Design](docs/TECHNICAL_DESIGN.md) · [Sample data & tests](docs/SAMPLE_DATA_AND_TEST_CASES.md) |

---

## Architecture (ports)

| Service    | Port (host) | Role |
|------------|-------------|------|
| frontend   | **3000**    | Next.js + MapLibre UI |
| api        | **8000**    | FastAPI (profiles, search, PAI, exports) |
| martin     | **3001**    | Vector tiles from PostGIS |
| db         | **5432**    | PostgreSQL 16 + PostGIS |

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose v2)
- ~4 GB RAM free for first build
- Optional: OpenAI-compatible API key for richer PAI-lite answers (works without it)

---

## Quick start

```bash
# From the folder that contains docker-compose.yml
docker compose down -v
docker compose up --build
```

Wait until `pris_api` is healthy (first build may take several minutes).

```bash
# District full profiles (geography / demographics / history + sources)
docker compose exec api python /scripts/seed_district_profiles.py

# Optional: full UP hierarchy (~97k villages, real district polygons)
docker compose exec api python /scripts/import_up_villages.py
```

Open **http://localhost:3000** (hard refresh: Ctrl+Shift+R).

| URL | What |
|-----|------|
| http://localhost:3000 | Frontend UI |
| http://localhost:8000/docs | API Swagger |
| http://localhost:8000/health | API health |
| http://localhost:3001 | Martin tiles (optional) |

**Demo path:** Search **Lucknow** (or Agra, Varanasi, Ayodhya) → **View full district profile** → check Geography / Demographics / History / **All sources cited**.

Stop:

```bash
docker compose down
```

Full database reset:

```bash
docker compose down -v
docker compose up --build
```

More verification steps: `RESET_AND_RUN.txt`.

---

## Environment variables

### Project root `.env` (optional LLM for PAI-lite)

Copy from `.env.example`:

```env
LLM_API_KEY=
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

| Variable | Required | Description |
|----------|----------|-------------|
| `LLM_API_KEY` | No | If empty, PAI-lite uses a deterministic grounded fallback (good for demos) |
| `LLM_BASE_URL` | No | OpenAI-compatible API base URL |
| `LLM_MODEL` | No | Model name (default `gpt-4o-mini`) |

These are passed into the `api` service via `docker-compose.yml`.

### Compose defaults (local demo only)

| Variable / setting | Default | Notes |
|--------------------|---------|--------|
| Postgres user | `pris` | Set in `docker-compose.yml` |
| Postgres password | `pris_password` | **Change for any shared/production host** |
| Postgres DB | `pris_db` | |
| `DATABASE_URL` (api) | `postgresql+asyncpg://pris:pris_password@db:5432/pris_db` | Internal Docker network |
| `NEXT_PUBLIC_API_BASE` | `http://localhost:8000` | Browser calls host-mapped API |
| `MARTIN_URL` | `http://martin:3000` | Internal |

### Frontend local hybrid (optional)

If you run the UI with `npm run dev` instead of the frontend container:

```bash
cd frontend
cp .env.example .env.local   # if present
# ensure NEXT_PUBLIC_API_BASE=http://localhost:8000
npm install
npm run dev
```

---

## What you get after seed

- **6 pilot districts** + sample layers (opportunities, flora, water, industrial, sustainable, conservation)
- **Full profiles** for Lucknow, Agra, Varanasi, Ayodhya, Gorakhpur, Kaushambi via `data/district_profiles.json` (Census / CGWB / IMD / ASI / gazetteers — each field cites a source)
- Domain indices and air-volume asset rows for districts

Full import rebuilds district/block polygons from village unions (no bbox “boxes” on the map) and re-applies the profile pack.

---

## Project layout (short)

```
├── backend/app/          # FastAPI routers (profiles, spatial, PAI, export, …)
├── frontend/src/         # Next.js UI (map, ProfilePanel, opportunities, chat)
├── database/             # init.sql schema, 02_seed_data.sql
├── data/                 # district_profiles.json, GeoJSON inputs
├── scripts/              # import_up_villages.py, seed_district_profiles.py
├── docs/                 # TECHNICAL_DESIGN.md, SAMPLE_DATA_AND_TEST_CASES.md
├── docker-compose.yml
├── LICENSE
└── README.md
```

---

## License

MIT — see [`LICENSE`](LICENSE).

---

## Further reading

- [Technical Design Document](docs/TECHNICAL_DESIGN.md) — architecture diagrams, data model, API  
- [Sample Data & Test Cases](docs/SAMPLE_DATA_AND_TEST_CASES.md) — demos and Pass/Fail checklist  
- `RESET_AND_RUN.txt` — recovery and verification commands  
