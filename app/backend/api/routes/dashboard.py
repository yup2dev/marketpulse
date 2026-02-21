"""
Dashboard API Routes
Endpoints for dashboard data aggregation
"""
from fastapi import APIRouter

from app.backend.services.data_service import data_service

router = APIRouter()


@router.get("/overview/{symbol}")
async def get_stock_overview(symbol: str):
    """Get complete stock overview (quote + info + news)"""
    try:
        quote = await data_service.get_stock_quote(symbol.upper())
        info = await data_service.get_company_info(symbol.upper())
        news = await data_service.get_news(symbol=symbol.upper(), limit=5)

        return {
            "symbol": symbol.upper(),
            "quote": quote,
            "info": info,
            "news": news
        }
    except Exception as e:
        return {"error": str(e)}
