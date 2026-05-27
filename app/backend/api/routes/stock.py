"""
Stock API Routes
Endpoints for stock data, quotes, and historical prices
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.backend.database.db_dependency import get_db
from app.backend.services.ranking_service import RankingService
from app.backend.services.yahoo import price as yahoo_price
from app.backend.services.yahoo import company as yahoo_company
from app.backend.services.yahoo import financials as yahoo_financials
from app.backend.services.yahoo import holders as yahoo_holders
from app.backend.services.polygon import market as polygon_market
from app.backend.services.fmp import market as fmp_market
from app.backend.services.fred import economics as fred_economics
from app.backend.services.social import sentiment as social_sentiment
from app.backend.services.company_relations import get_company_relations
from app.backend.api.deps import route_handler

log = logging.getLogger(__name__)
router = APIRouter()


@router.get("/quote/{symbol}")
@route_handler
async def get_stock_quote(symbol: str):
    """Get current stock quote"""
    quote = await yahoo_price.get_stock_quote(symbol.upper())
    if not quote:
        raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")
    return quote


@router.get("/history/{symbol}")
@route_handler
async def get_stock_history(
    symbol: str,
    period: Optional[str] = None,
    interval: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    Get historical stock prices

    Periods: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, max
    Intervals: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo

    Or use start_date and end_date (YYYY-MM-DD format) for custom range
    """
    log.debug(f"ROUTE PARAMS - symbol={symbol}, period={period}, interval={interval}, start_date={start_date}, end_date={end_date}")
    history = await yahoo_price.get_stock_history(
        symbol.upper(),
        period,
        interval=interval,
        start_date=start_date,
        end_date=end_date
    )
    if not history:
        raise HTTPException(status_code=404, detail=f"No history for {symbol}")
    return {"symbol": symbol.upper(), "period": period, "data": history}


@router.get("/orderbook/{symbol}")
@route_handler
async def get_stock_orderbook(symbol: str):
    """
    Get approximate order book for a US stock.
    Uses Polygon.io NBBO quotes aggregated by price level.
    """
    return await yahoo_price.get_stock_orderbook(symbol.upper())


@router.get("/info/{symbol}")
@route_handler
async def get_company_info(symbol: str):
    """Get company information"""
    info = await yahoo_company.get_company_info(symbol.upper())
    if not info:
        raise HTTPException(status_code=404, detail=f"Company info for {symbol} not found")
    return info


@router.get("/metrics/{symbol}")
@route_handler
async def get_key_metrics(symbol: str):
    """
    Get key financial metrics and ratios for a stock

    Returns valuation multiples, profitability ratios, liquidity metrics, and more
    """
    metrics = await yahoo_company.get_key_metrics(symbol.upper())
    if metrics is None:
        raise HTTPException(status_code=404, detail=f"Metrics for {symbol} not found")
    d = metrics.model_dump(mode='json')
    d['52_week_high'] = d.pop('week_52_high', None)
    d['52_week_low']  = d.pop('week_52_low', None)
    d['50_day_ma']    = d.pop('ma_50_day', None)
    d['200_day_ma']   = d.pop('ma_200_day', None)
    return d


@router.get("/financials/{symbol}")
@route_handler
async def get_financials(symbol: str, freq: str = "quarterly", limit: int = 4):
    """
    Get financial statements

    Args:
        symbol: Stock symbol
        freq: Frequency - 'quarterly' or 'annual' (default: quarterly)
        limit: Number of periods to return (default: 4)
    """
    if freq not in ['quarterly', 'annual']:
        raise HTTPException(status_code=400, detail="freq must be 'quarterly' or 'annual'")
    financials = await yahoo_financials.get_financials(symbol.upper(), freq, limit)
    if not financials:
        raise HTTPException(status_code=404, detail=f"Financials for {symbol} not found")
    return {'symbol': symbol.upper(), 'frequency': freq, 'periods': financials}


@router.get("/search")
@route_handler
async def search_stocks(query: str = "", limit: int = 12):
    """
    Search for stocks by symbol or name.
    Uses in-memory symbol cache for instant results; falls back to FMP API.
    """
    from app.backend.services.symbol_cache import get_symbol_cache

    cache = get_symbol_cache()
    await cache.ensure_loaded()

    if cache.is_loaded:
        results = cache.search(query.upper(), limit=limit)
        if results:
            return {"query": query, "results": results}

    results = await fmp_market.search_stocks(query.upper())
    return {"query": query, "results": results}


@router.get("/earnings/{symbol}")
@route_handler
async def get_earnings(symbol: str, limit: int = 8):
    """
    Get earnings data for a stock

    Returns quarterly earnings with EPS actual vs estimated
    """
    return await polygon_market.get_earnings(symbol.upper(), limit)


@router.get("/insider-trading/{symbol}")
@route_handler
async def get_insider_trading(symbol: str, limit: int = 50):
    """
    Get insider trading data for a stock

    Returns recent insider transactions with buy/sell summary
    """
    return await yahoo_holders.get_insider_trading(symbol.upper(), limit)


@router.get("/insider-holders/{symbol}")
@route_handler
async def get_insider_holders(symbol: str):
    """
    Get insider roster/holders information for a stock

    Returns list of insiders with their positions and share holdings
    """
    return await yahoo_holders.get_insider_holders(symbol.upper())


@router.get("/analyst/{symbol}")
@route_handler
async def get_analyst_data(symbol: str):
    """
    Get analyst recommendations and price targets

    Returns consensus rating, price targets, and analyst count
    """
    return await fmp_market.get_analyst_data(symbol.upper())


@router.get("/holders/{symbol}")
@route_handler
async def get_holders(symbol: str):
    """
    Get institutional and insider holder information

    Returns ownership breakdown, institutional holders list, and share statistics
    """
    return await yahoo_holders.get_holders(symbol.upper())


@router.get("/calendar/{symbol}")
@route_handler
async def get_calendar(
    symbol: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    Get company calendar events

    Returns upcoming earnings dates, dividend dates, and other corporate events
    """
    return await yahoo_financials.get_calendar(
        symbol.upper(),
        start_date=start_date,
        end_date=end_date
    )


@router.get("/dividends/{symbol}")
@route_handler
async def get_dividends(symbol: str, limit: int = 20):
    """
    Get dividend history for a stock

    Returns historical dividend payments with dates and amounts
    """
    return await yahoo_financials.get_dividends(symbol.upper(), limit)


@router.get("/splits/{symbol}")
@route_handler
async def get_splits(symbol: str, limit: int = 20):
    """
    Get stock split history

    Returns historical stock splits with dates and ratios
    """
    return await yahoo_financials.get_splits(symbol.upper(), limit)


@router.get("/filings/{symbol}")
@route_handler
async def get_filings(symbol: str, limit: int = 20):
    """
    Get SEC filings for a stock

    Returns recent SEC filings with links to EDGAR
    """
    return await yahoo_financials.get_filings(symbol.upper(), limit)


@router.get("/quarterly-pnl/{symbol}")
@route_handler
async def get_quarterly_pnl(symbol: str, limit: int = 12):
    """
    Get quarterly P&L breakdown (Revenue, COGS, Gross Profit, OpEx, Net Income).
    Source: yfinance quarterly income statement.
    """
    return await yahoo_financials.get_quarterly_pnl(symbol.upper(), limit=limit)


@router.get("/revenue-segments/{symbol}")
@route_handler
async def get_revenue_segments(symbol: str, limit: int = 8):
    """
    Get revenue breakdown by product segment and geographic region.

    Args:
        symbol: Stock symbol (e.g. AAPL, MSFT, NVDA)
        limit:  Number of annual periods to return (default 8)
    """
    return await fmp_market.get_revenue_segments(symbol.upper(), limit=limit)


@router.get("/estimates/{symbol}")
@route_handler
async def get_estimates(symbol: str):
    """
    Get analyst estimates for EPS and revenue

    Returns consensus estimates, price targets, and analyst revisions
    """
    return await yahoo_financials.get_estimates(symbol.upper())


@router.get("/management/{symbol}")
@route_handler
async def get_management(symbol: str):
    """Get executive team and governance risk data"""
    return await yahoo_company.get_management(symbol.upper())


@router.get("/moat/{symbol}")
@route_handler
async def get_moat_analysis(symbol: str):
    """Get 10-year economic moat analysis (ROE, ROIC, margins, FCF)"""
    return await yahoo_company.get_moat_analysis(symbol.upper())


@router.get("/swot/{symbol}")
@route_handler
async def get_swot(symbol: str):
    """Get data-driven SWOT analysis"""
    return await yahoo_company.get_swot(symbol.upper())


@router.get("/sentiment/{symbol}")
@route_handler
async def get_stock_sentiment(symbol: str):
    """Get news sentiment aggregation and trend"""
    return await polygon_market.get_stock_sentiment(symbol.upper())


@router.get("/reddit/{symbol}")
@route_handler
async def get_social_sentiment(symbol: str):
    """Get Reddit + StockTwits social sentiment"""
    return await social_sentiment.get_social_sentiment(symbol.upper())


@router.get("/scorecard/{symbol}")
@route_handler
async def get_scorecard(symbol: str):
    """Get 5-category investment scorecard with overall grade"""
    return await yahoo_company.get_scorecard(symbol.upper())


@router.get("/relations/{symbol}")
@route_handler
async def get_company_relations_route(symbol: str):
    """Return curated supply-chain / competitor / customer / partner relationships."""
    return await get_company_relations(symbol.upper())


@router.get("/sector-performance")
@route_handler
async def get_sector_performance():
    """S&P 500 섹터별 퍼포먼스 (트리맵/히트맵용). 등락률은 WebSocket 실시간 제공."""
    from app.backend.database.db_dependency import get_db_sync
    from index_analyzer.models.orm import MBS_IN_STK_PROFILE

    db = get_db_sync()
    try:
        base_q = db.query(MBS_IN_STK_PROFILE).filter(MBS_IN_STK_PROFILE.sector.isnot(None))
        sp500 = base_q.filter(MBS_IN_STK_PROFILE.in_sp500 == True).all()
        profiles = sp500 if len(sp500) >= 50 else base_q.all()

        sector_map = {}
        for p in profiles:
            s = p.sector or "Other"
            if s not in sector_map:
                sector_map[s] = {"sector": s, "stocks": [], "total_market_cap": 0}
            mcap = float(p.market_cap) if p.market_cap else 0
            sector_map[s]["stocks"].append({
                "symbol": p.stk_cd,
                "name": p.stk_nm,
                "sector": s,
                "industry": p.industry,
                "market_cap": mcap,
                "price": float(p.price) if p.price else None,
            })
            sector_map[s]["total_market_cap"] += mcap

        sectors = sorted(sector_map.values(), key=lambda x: x["total_market_cap"], reverse=True)
        for sec in sectors:
            sec["count"] = len(sec["stocks"])
            sec["stocks"] = sorted(sec["stocks"], key=lambda x: x["market_cap"], reverse=True)[:50]

        return {"sectors": sectors}
    finally:
        db.close()


@router.get("/compare")
@route_handler
async def compare_stocks(
    symbols: str = Query(..., description="Comma-separated symbols (2-4)"),
):
    """2~4 종목 비교 데이터."""
    tickers = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if len(tickers) < 2:
        raise ValueError("At least 2 symbols required")
    if len(tickers) > 4:
        raise ValueError("Maximum 4 symbols allowed")

    results = []
    for sym in tickers:
        try:
            q = await yahoo_price.get_stock_quote(sym) or {}
            metrics_obj = await yahoo_company.get_key_metrics(sym)
            m = metrics_obj.model_dump(mode="json") if metrics_obj else {}
            results.append({
                "symbol": sym,
                "name": m.get("symbol", sym),
                "price": q.get("price"),
                "change": q.get("change"),
                "changesPercentage": q.get("change_percent"),
                "marketCap": m.get("market_cap"),
                "volume": q.get("volume"),
                "pe": m.get("pe_ratio"),
                "eps": m.get("eps_trailing"),
                "beta": m.get("beta"),
                "dividend_yield": m.get("dividend_yield"),
                "roe": m.get("roe"),
                "roa": m.get("roa"),
                "debt_to_equity": m.get("debt_to_equity"),
                "profit_margin": m.get("net_margin"),
                "revenue_growth": m.get("revenue_growth"),
                "52w_high": m.get("week_52_high"),
                "52w_low": m.get("week_52_low"),
            })
        except Exception:
            results.append({"symbol": sym, "error": "Failed to fetch data"})

    return {"stocks": results}


@router.get("/indicator/{indicator}")
@route_handler
async def get_indicator_history(indicator: str, period: str = "5y"):
    """
    Get historical data for an economic indicator

    Indicators: GDP, UNEMPLOYMENT, CPI, FED_FUNDS_RATE, RETAIL_SALES,
                CONSUMER_SENTIMENT, NONFARM_PAYROLL, HOUSING_STARTS, INDUSTRIAL_PRODUCTION
    Periods: 1mo, 3mo, 6mo, 1y, 2y, 3y, 5y, 10y, max
    """
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
    history = await fred_economics.get_indicator_history(indicator_upper, period)
    if not history:
        raise HTTPException(status_code=404, detail=f"No data for indicator {indicator}")
    return {"indicator": indicator_upper, "period": period, "data": history}


@router.get("/ranking/live")
async def get_live_stock_ranking(
    market:  str = Query("all",     description="all | domestic | overseas"),
    sort_by: str = Query("gainers", description="gainers | losers | volume | trade_value"),
    limit:   int = Query(50,        ge=1, le=200),
):
    """yfinance 배치 기반 실시간 랭킹 (60s 캐시)"""
    results = await RankingService.get_live_ranking(
        market=market, sort_by=sort_by, limit=limit
    )
    return {"results": results, "count": len(results)}


@router.get("/ranking")
async def get_stock_ranking(
    market:  str = Query("all",     description="all | domestic | overseas"),
    sort_by: str = Query("gainers", description="gainers | losers | volume | trade_value"),
    period:  str = Query("1d",      description="realtime | 1d | 1w | 1mo | 3mo | 6mo | 1y"),
    limit:   int = Query(50,        ge=1, le=200),
):
    """시장 랭킹 조회 (기간별 변동률)"""
    results = await RankingService.get_ranking(
        market=market, sort_by=sort_by, period=period, limit=limit
    )
    return {"results": results, "count": len(results)}
