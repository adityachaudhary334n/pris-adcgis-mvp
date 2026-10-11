from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.spatial.router import router as spatial_router
from app.opportunities.router import router as opportunities_router
from app.pai.router import router as pai_router
from app.plant.router import router as plant_router

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "PRIS + adcGIS Community Engine API. "
        "Spatial intelligence for livelihood opportunities, flora/fauna insights, "
        "and plant cultivation guidance in Uttar Pradesh (Ayodhya, Kaushambi, Agra)."
    ),
)

# Allow frontend (Next.js) to call the API during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(spatial_router, prefix="/api/spatial", tags=["Spatial"])
app.include_router(opportunities_router, prefix="/api/opportunities", tags=["Opportunities"])
app.include_router(pai_router, prefix="/api/pai", tags=["PAI-lite"])
app.include_router(plant_router, prefix="/api/plant", tags=["Plant"])


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "pilot_districts": ["Ayodhya", "Kaushambi", "Agra"],
    }


@app.get("/")
async def root():
    return {
        "message": "PRIS + adcGIS Community Engine API",
        "docs": "/docs",
        "health": "/health",
    }
