from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional
from app.core.database import get_db

router = APIRouter()


@router.get("/species")
async def list_species(db: AsyncSession = Depends(get_db)):
    """List all plant species in the knowledge base."""
    result = await db.execute(text("""
        SELECT id, scientific_name, common_name, common_name_hi,
               family, water_requirement, sunlight, best_season, tags
        FROM plant_species
        ORDER BY common_name
    """))
    return {"species": [dict(r) for r in result.mappings()]}


@router.get("/species/{common_name}")
async def get_species(common_name: str, db: AsyncSession = Depends(get_db)):
    """Get full cultivation notes for a species by common name."""
    result = await db.execute(text("""
        SELECT *
        FROM plant_species
        WHERE common_name ILIKE :name OR common_name_hi ILIKE :name
        LIMIT 1
    """), {"name": common_name})
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Species not found in knowledge base")
    return dict(row)


@router.post("/identify")
async def identify_plant(
    common_name: Optional[str] = Form(None),
    district: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Plant identification + spatial context + cultivation advice.

    MVP behaviour:
    - If common_name is supplied, match against plant_species table.
    - Image upload is accepted but full computer-vision matching is future work.
      For now we treat the image as a trigger and rely on the name (or return guidance).
    - Returns cultivation notes + any flora_fauna spatial records for that species.
    """
    if not common_name and not file:
        raise HTTPException(
            status_code=400,
            detail="Provide at least a common_name or an image file."
        )

    # For MVP: if only image is sent, we cannot yet classify it.
    # Return a helpful message guiding the user.
    if file and not common_name:
        return {
            "status": "needs_name",
            "message": (
                "Image received. Full visual identification will be added in a later version. "
                "Please also type the common name of the plant (e.g. Marigold, Banana, Neem, Peepal) "
                "so I can give you spatial data and cultivation guidance right now."
            ),
            "filename": file.filename,
        }

    # Match species
    result = await db.execute(text("""
        SELECT *
        FROM plant_species
        WHERE common_name ILIKE :name
           OR common_name_hi ILIKE :name
           OR scientific_name ILIKE :name
        LIMIT 1
    """), {"name": f"%{common_name}%"})
    species = result.mappings().first()

    if not species:
        return {
            "status": "not_found",
            "message": (
                f"No matching plant species found for '{common_name}' in the current knowledge base. "
                "Available examples: Marigold, Banana, Neem, Peepal. "
                "We will expand the list as more field data is verified."
            ),
            "data_available": False,
        }

    # Spatial records of this species
    spatial = await db.execute(text("""
        SELECT id, species_name, common_name, district_name, description,
               source, confidence, ST_AsGeoJSON(geom)::json AS geometry
        FROM flora_fauna
        WHERE review_status = 'verified'
          AND (species_name ILIKE :s OR common_name ILIKE :s)
    """), {"s": f"%{species['common_name']}%"})

    spatial_records = [dict(r) for r in spatial.mappings()]

    return {
        "status": "matched",
        "data_available": True,
        "species": dict(species),
        "spatial_records": spatial_records,
        "cultivation_summary": species["cultivation_notes"],
        "message": (
            f"Matched to {species['common_name']}. "
            f"Found {len(spatial_records)} spatial observation(s) in the system. "
            "Cultivation guidance is based on the verified knowledge base."
        ),
    }
