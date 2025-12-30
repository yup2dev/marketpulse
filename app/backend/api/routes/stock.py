"""
Stock API Routes
Endpoints for stock data, quotes, and historical prices
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException

from app.backend.services.data_service import data_service

log = logging.getLogger(__name__)
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
async def get_stock_history(
    symbol: str,
    period: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    Get historical stock prices

    Periods: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, max

    Or use start_date and end_date (YYYY-MM-DD format) for custom range
    """
    log.debug(f"ROUTE PARAMS - symbol={symbol}, period={period}, start_date={start_date}, end_date={end_date}")
    try:
        history = await data_service.get_stock_history(
            symbol.upper(),
            period,
            start_date=start_date,
            end_date=end_date
        )
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
async def get_financials(symbol: str, freq: str = "quarterly", limit: int = 4):
    """
    Get financial statements

    Args:
        symbol: Stock symbol
        freq: Frequency - 'quarterly' or 'annual' (default: quarterly)
        limit: Number of periods to return (default: 4)
    """
    try:
        if freq not in ['quarterly', 'annual']:
            raise HTTPException(status_code=400, detail="freq must be 'quarterly' or 'annual'")

        financials = await data_service.get_financials(symbol.upper(), freq, limit)
        if not financials:
            raise HTTPException(status_code=404, detail=f"Financials for {symbol} not found")
        return financials
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search_stocks(query: str = ""):
    """
    Search for stocks by symbol or name

    Returns a list of matching stocks with their symbols and names
    """
    try:
        results = await data_service.search_stocks(query.upper())
        return {"query": query, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/indicator/{indicator}")
async def get_indicator_history(indicator: str, period: str = "5y"):
    """
    Get historical data for an economic indicator

    Indicators: GDP, UNEMPLOYMENT, CPI, FED_FUNDS_RATE, RETAIL_SALES,
                CONSUMER_SENTIMENT, NONFARM_PAYROLL, HOUSING_STARTS, INDUSTRIAL_PRODUCTION
    Periods: 1mo, 3mo, 6mo, 1y, 2y, 3y, 5y, 10y, max
    """
    try:
        indicator_upper = indicator.upper()
        valid_indicators = [
            'GDP', 'UNEMPLOYMENT', 'CPI', 'FED_FUNDS_RATE', 'INTEREST_RATE',
            'RETAIL_SALES', 'CONSUMER_SENTIMENT', 'NONFARM_PAYROLL',
            'HOUSING_STARTS', 'INDUSTRIAL_PRODUCTION'
        ]

        if indicator_upper not in valid_indicators:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid indicator. Valid indicators: {', '.join(valid_indicators)}"
            )

        history = await data_service.get_indicator_history(indicator_upper, period)
        if not history:
            raise HTTPException(status_code=404, detail=f"No data for indicator {indicator}")

        return {"indicator": indicator_upper, "period": period, "data": history}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
