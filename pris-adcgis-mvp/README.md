# PRIS + adcGIS Community Engine MVP

**Prajna Regional Intelligence System** – Community-rooted spatial intelligence for Uttar Pradesh.

Pilot districts: **Ayodhya · Kaushambi · Agra**

This repository contains the **backend + database foundation**.  
Frontend (Next.js + MapLibre) is developed separately by the frontend track.

---

## What this engine does

- Select a district / village → see spatial layers (opportunities, flora & fauna, water/soil)
- Ask PAI-lite in natural language about livelihood opportunities, flora, fauna or soil
- Receive **ranked enterprise opportunities** with scores, transparent factors and setup procedures
- Upload / name a plant → get cultivation guidance + spatial observations (when available)
- Strict honesty: if data is missing, the system says so and points to the nearest available information

---

## Tech Stack (Backend)

| Layer              | Technology                          |
|--------------------|-------------------------------------|
| Database           | PostgreSQL 16 + PostGIS 3.4         |
| Vector tiles       | Martin                              |
| API                | FastAPI (Python 3.12)               |
| Spatial RAG / PAI  | Retrieval from PostGIS + configurable LLM |
| Orchestration      | Docker Compose                      |

---

## Quick Start (Recommended)

### Prerequisites
- Docker Desktop running
- Git

### 1. Clone your repository
```bash
git clone https://github.com/YOUR_USERNAME/pris-adcgis-mvp.git
cd pris-adcgis-mvp
```

### 2. (Optional) Set LLM key
Create a `.env` file in the project root:
```env
LLM_API_KEY=sk-your-key-here
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```
If no key is provided, PAI-lite falls back to a deterministic response (still useful for demos).

### 3. Start everything
```bash
docker compose up --build
```

First run takes 1–3 minutes (downloads images + builds).

### 4. Verify
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health
- Martin tiles: http://localhost:3000

### 5. Stop
```bash
docker compose down
```

---

## Database Access (pgAdmin or any client)

| Setting    | Value              |
|------------|--------------------|
| Host       | localhost          |
| Port       | 5432               |
| Database   | pris_db            |
| User       | pris               |
| Password   | pris_password      |

---

## Main API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Service health |
| GET | `/api/spatial/districts` | List pilot districts |
| GET | `/api/spatial/villages?district=Ayodhya` | Villages in a district |
| GET | `/api/spatial/layers/opportunities` | Opportunity points (GeoJSON) |
| GET | `/api/spatial/layers/flora-fauna` | Flora & fauna points |
| GET | `/api/spatial/layers/water-soil` | Water & soil indicators |
| GET | `/api/opportunities/` | Ranked opportunities |
| GET | `/api/opportunities/{id}` | Single opportunity + setup steps |
| POST | `/api/pai/chat` | PAI-lite Spatial RAG chat |
| GET | `/api/plant/species` | Plant knowledge base |
| POST | `/api/plant/identify` | Plant match + cultivation advice |

Full interactive docs: http://localhost:8000/docs

---

## Project Structure

```
pris-adcgis-mvp/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── core/          # config, database
│       ├── spatial/       # boundaries & layers
│       ├── opportunities/ # ranking + setup steps
│       ├── pai/           # Spatial RAG chat
│       └── plant/         # species + identify
├── database/
│   ├── init.sql           # schema + provenance
│   └── seed/
│       └── 02_seed_data.sql
├── docs/
└── README.md
```

---

## Design Principles Enforced

1. **Provenance is mandatory** on every spatial record.
2. **PAI never invents data**. Retrieval-first, explicit “no data” behaviour.
3. **Opportunity scores are transparent** (score_factors JSON).
4. Everything is written as permanent foundation for the future industrial platform (including future NVIDIA Nemotron PAI).

---

## Next Steps

1. Confirm backend is healthy (`/docs` and `/health`).
2. Frontend track (Claude) builds the Next.js + MapLibre UI against these APIs.
3. Push to public GitHub for VBYLD submission.

---

**MCESP Initiative · Digital Inclusion · Uttar Pradesh Pilot**
