"""
Economic Indicators API Routes
Endpoints for economic data like GDP, CPI, unemployment, etc.
"""
from fastapi import APIRouter, HTTPException

from app.backend.services.fred import economics as fred_economics

router = APIRouter()


@router.get("/indicators")
async def get_economic_indicators():
    """Get key economic indicators"""
    try:
        indicators = await fred_economics.get_economic_indicators()
        return indicators
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
