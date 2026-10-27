from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import get_settings
from app.spatial.router import router as spatial_router
from app.spatial.search import router as search_router
from app.opportunities.router import router as opportunities_router
from app.pai.router import router as pai_router
from app.plant.router import router as plant_router
from app.profiles.router import router as profiles_router
from app.export.router import router as export_router
from app.diagnostics.router import router as diagnostics_router

settings = get_settings()

app = FastAPI(
    title="PRIS + adcGIS API — Statewide Uttar Pradesh",
    version="0.2.0",
    description=(
        "Community-rooted spatial intelligence for the entire state of Uttar Pradesh. "
        "Multi-profile units (soil, human capital, infrastructure, industrial, sustainable, conservation), "
        "air volume as a first-class asset, livelihood opportunities, and downloadable intelligence packs (PDF/CSV/GeoJSON). "
        "PAI-lite answers only from retrieved, provenance-tagged data."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(spatial_router, prefix="/api/spatial", tags=["Spatial Layers"])
app.include_router(search_router, prefix="/api/spatial", tags=["Search & Hierarchy"])
app.include_router(profiles_router, prefix="/api/profiles", tags=["Multi-Profile Intelligence"])
app.include_router(opportunities_router, prefix="/api/opportunities", tags=["Opportunities"])
app.include_router(pai_router, prefix="/api/pai", tags=["PAI-lite"])
app.include_router(plant_router, prefix="/api/plant", tags=["Plant"])
app.include_router(export_router, prefix="/api/export", tags=["Intelligence Packs & Downloads"])
app.include_router(diagnostics_router, prefix="/api/diagnostics", tags=["Opportunity Engine Diagnostics"])

# Startup / opportunity images — drop real photos in this folder (see README.txt inside)
_startup_img_dir = Path(__file__).parent / "diagnostics" / "static" / "startup_images"
_startup_img_dir.mkdir(parents=True, exist_ok=True)
app.mount(
    "/api/diagnostics/static/startup_images",
    StaticFiles(directory=str(_startup_img_dir)),
    name="startup_images",
)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": "0.2.0",
        "scope": "Entire Uttar Pradesh",
        "capabilities": [
            "statewide_search",
            "multi_profile",
            "air_volume_asset",
            "opportunities",
            "opportunity_engine_diagnostics",
            "industrial_sustainable_layers",
            "pai_lite",
            "pdf_csv_geojson_export",
        ],
    }


@app.get("/")
async def root():
    return {
        "message": "PRIS + adcGIS · Statewide Uttar Pradesh Spatial Intelligence",
        "docs": "/docs",
        "health": "/health",
        "highlights": [
            "Search any village / suburb / district",
            "Full multi-profile intelligence",
            "Air volume treated as asset",
            "Download PDF / CSV / GeoJSON packs",
        ],
    }
