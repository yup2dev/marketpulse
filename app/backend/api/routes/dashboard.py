"""
Dashboard API Routes
Endpoints for dashboard data aggregation
"""
from fastapi import APIRouter

from app.backend.services.yahoo import price as yahoo_price
from app.backend.services.yahoo import company as yahoo_company
from app.backend.services.polygon import market as polygon_market

router = APIRouter()


@router.get("/overview/{symbol}")
async def get_stock_overview(symbol: str):
    """Get complete stock overview (quote + info + news)"""
    try:
        quote = await yahoo_price.get_stock_quote(symbol.upper())
        info = await yahoo_company.get_company_info(symbol.upper())
        news = await polygon_market.get_news(symbol=symbol.upper(), limit=5)

        return {
            "symbol": symbol.upper(),
            "quote": quote,
            "info": info,
            "news": news
        }
    except Exception as e:
        return {"error": str(e)}
