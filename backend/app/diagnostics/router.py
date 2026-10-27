from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.diagnostics.service import get_diagnostic, list_districts

router = APIRouter()


@router.get("/districts")
async def diagnostic_districts():
    """Districts that currently have Opportunity Engine diagnostic data."""
    return {"districts": list_districts()}


@router.get("/{district}")
async def district_diagnostic(district: str):
    """
    Full Opportunity Engine diagnostic for a district.
    District name is matched fuzzily against Prajna sample data
    (aliases e.g. Gautam Buddha Nagar → Noida).
    """
    result = get_diagnostic(district)
    if not result:
        raise HTTPException(
            status_code=404,
            detail={
                "message": f"No diagnostic data for '{district}'",
                "available": list_districts(),
            },
        )
    return result


@router.get("")
async def diagnostic_root(district: Optional[str] = Query(None)):
    if district:
        return await district_diagnostic(district)
    return {"districts": list_districts(), "hint": "GET /api/diagnostics/{district}"}
