"""
Economic Indicators API Routes
Endpoints for economic data like GDP, CPI, unemployment, etc.
"""
from fastapi import APIRouter, HTTPException

from app.backend.services.data_service import data_service

router = APIRouter()


@router.get("/indicators")
async def get_economic_indicators():
    """Get key economic indicators"""
    try:
        indicators = await data_service.get_economic_indicators()
        return indicators
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
