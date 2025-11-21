"""
Stock API Routes
Endpoints for stock data, quotes, and historical prices
"""
from fastapi import APIRouter, HTTPException
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from services.data_service import data_service

router = APIRouter()


@router.get("/quote/{symbol}")
async def get_stock_quote(symbol: str):
    """Get current stock quote"""
    try:
        quote = await data_service.get_stock_quote(symbol.upper())
        if not quote:
            raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")
        return quote
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{symbol}")
async def get_stock_history(symbol: str, period: str = "1mo"):
    """
    Get historical stock prices

    Periods: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, max
    """
    try:
        history = await data_service.get_stock_history(symbol.upper(), period)
        if not history:
            raise HTTPException(status_code=404, detail=f"No history for {symbol}")
        return {"symbol": symbol.upper(), "period": period, "data": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/info/{symbol}")
async def get_company_info(symbol: str):
    """Get company information"""
    try:
        info = await data_service.get_company_info(symbol.upper())
        if not info:
            raise HTTPException(status_code=404, detail=f"Company info for {symbol} not found")
        return info
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/financials/{symbol}")
async def get_financials(symbol: str):
    """Get financial statements"""
    try:
        financials = await data_service.get_financials(symbol.upper())
        if not financials:
            raise HTTPException(status_code=404, detail=f"Financials for {symbol} not found")
        return financials
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
