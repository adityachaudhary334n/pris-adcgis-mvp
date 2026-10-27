# PRIS + adcGIS — Frontend

Next.js (App Router) + TypeScript + MapLibre GL JS + Tailwind. Statewide Uttar Pradesh, multi-profile, air-volume aware, downloadable.

## Run
```bash
cp .env.example .env.local   # NEXT_PUBLIC_API_BASE=http://localhost:8000
npm install
npm run dev                  # http://localhost:3000
```
Backend contract: Swagger at `http://localhost:8000/docs`. Docker: `docker build -t pris-frontend .`

## Structure
- `src/app` — page shell (search, map, drawer, overlays), layout, Neo-Sovereign theme tokens (`tailwind.config.ts`)
- `src/lib` — `api.ts` (all endpoint calls), `types.ts` (SearchResult, UnitProfile, AirVolumeAsset, Opportunity, PaiChatResponse), `layers.ts` (layer registry), `i18n.ts` (EN/हिं)
- `src/components/map` — MapLibre view + grouped layer toggles
- `src/components/profile` — indices, 7 profile tabs, Air Volume Asset card, PDF/CSV/GeoJSON download bar
- `src/components/opportunities` — ranked cards with expandable setup steps
- `src/components/chat` — PAI-lite chat (sources, "no data" state, nearest information)
- `src/components/plant` — photo upload, preview, advice, optional map highlight

## Honesty rules implemented
Null fields render "No data yet"; uncomputed units show the coverage-expanding notice and still allow downloads and PAI; layers the backend doesn't expose are disabled with "No data yet"; chat shows sources and nearest-available info.
