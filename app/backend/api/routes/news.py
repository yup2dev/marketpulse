"""
News API Routes
Endpoints for market news and articles
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.backend.services.polygon import market as polygon_market

router = APIRouter()

@router.get("/")
async def get_news(
    symbol: Optional[str] = None,
    limit: int = Query(10, ge=1, le=50)
):
    """
    Get market news

    - symbol: Optional stock symbol to filter news
    - limit: Number of news articles (1-50)
    """
    try:
        news = await polygon_market.get_news(
            symbol=symbol.upper() if symbol else None,
            limit=limit
        )
        return {"count": len(news), "articles": news}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
