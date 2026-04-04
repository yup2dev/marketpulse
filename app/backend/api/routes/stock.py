"""
Stock API Routes
Endpoints for stock data, quotes, and historical prices
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException

from app.backend.services.data_service import data_service
from app.backend.api.deps import route_handler

log = logging.getLogger(__name__)
router = APIRouter()


@router.get("/quote/{symbol}")
@route_handler
async def get_stock_quote(symbol: str):
    """Get current stock quote"""
    quote = await data_service.get_stock_quote(symbol.upper())
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
    history = await data_service.get_stock_history(
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
    return await data_service.get_stock_orderbook(symbol.upper())


@router.get("/info/{symbol}")
@route_handler
async def get_company_info(symbol: str):
    """Get company information"""
    info = await data_service.get_company_info(symbol.upper())
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
    metrics = await data_service.get_key_metrics(symbol.upper())
    if not metrics:
        raise HTTPException(status_code=404, detail=f"Metrics for {symbol} not found")
    return metrics


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
    financials = await data_service.get_financials(symbol.upper(), freq, limit)
    if not financials:
        raise HTTPException(status_code=404, detail=f"Financials for {symbol} not found")
    return financials


@router.get("/search")
@route_handler
async def search_stocks(query: str = ""):
    """
    Search for stocks by symbol or name

    Returns a list of matching stocks with their symbols and names
    """
    results = await data_service.search_stocks(query.upper())
    return {"query": query, "results": results}


@router.get("/earnings/{symbol}")
@route_handler
async def get_earnings(symbol: str, limit: int = 8):
    """
    Get earnings data for a stock

    Returns quarterly earnings with EPS actual vs estimated
    """
    return await data_service.get_earnings(symbol.upper(), limit)


@router.get("/insider-trading/{symbol}")
@route_handler
async def get_insider_trading(symbol: str, limit: int = 50):
    """
    Get insider trading data for a stock

    Returns recent insider transactions with buy/sell summary
    """
    return await data_service.get_insider_trading(symbol.upper(), limit)


@router.get("/insider-holders/{symbol}")
@route_handler
async def get_insider_holders(symbol: str):
    """
    Get insider roster/holders information for a stock

    Returns list of insiders with their positions and share holdings
    """
    return await data_service.get_insider_holders(symbol.upper())


@router.get("/analyst/{symbol}")
@route_handler
async def get_analyst_data(symbol: str):
    """
    Get analyst recommendations and price targets

    Returns consensus rating, price targets, and analyst count
    """
    return await data_service.get_analyst_data(symbol.upper())


@router.get("/holders/{symbol}")
@route_handler
async def get_holders(symbol: str):
    """
    Get institutional and insider holder information

    Returns ownership breakdown, institutional holders list, and share statistics
    """
    return await data_service.get_holders(symbol.upper())


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
    return await data_service.get_calendar(
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
    return await data_service.get_dividends(symbol.upper(), limit)


@router.get("/splits/{symbol}")
@route_handler
async def get_splits(symbol: str, limit: int = 20):
    """
    Get stock split history

    Returns historical stock splits with dates and ratios
    """
    return await data_service.get_splits(symbol.upper(), limit)


@router.get("/filings/{symbol}")
@route_handler
async def get_filings(symbol: str, limit: int = 20):
    """
    Get SEC filings for a stock

    Returns recent SEC filings with links to EDGAR
    """
    return await data_service.get_filings(symbol.upper(), limit)


@router.get("/quarterly-pnl/{symbol}")
@route_handler
async def get_quarterly_pnl(symbol: str, limit: int = 12):
    """
    Get quarterly P&L breakdown (Revenue, COGS, Gross Profit, OpEx, Net Income).
    Source: yfinance quarterly income statement.
    """
    return await data_service.get_quarterly_pnl(symbol.upper(), limit=limit)


@router.get("/revenue-segments/{symbol}")
@route_handler
async def get_revenue_segments(symbol: str, limit: int = 8):
    """
    Get revenue breakdown by product segment and geographic region.

    Args:
        symbol: Stock symbol (e.g. AAPL, MSFT, NVDA)
        limit:  Number of annual periods to return (default 8)
    """
    return await data_service.get_revenue_segments(symbol.upper(), limit=limit)


@router.get("/estimates/{symbol}")
@route_handler
async def get_estimates(symbol: str):
    """
    Get analyst estimates for EPS and revenue

    Returns consensus estimates, price targets, and analyst revisions
    """
    return await data_service.get_estimates(symbol.upper())


@router.get("/management/{symbol}")
@route_handler
async def get_management(symbol: str):
    """Get executive team and governance risk data"""
    return await data_service.get_management(symbol.upper())


@router.get("/moat/{symbol}")
@route_handler
async def get_moat_analysis(symbol: str):
    """Get 10-year economic moat analysis (ROE, ROIC, margins, FCF)"""
    return await data_service.get_moat_analysis(symbol.upper())


@router.get("/swot/{symbol}")
@route_handler
async def get_swot(symbol: str):
    """Get data-driven SWOT analysis"""
    return await data_service.get_swot(symbol.upper())


@router.get("/sentiment/{symbol}")
@route_handler
async def get_stock_sentiment(symbol: str):
    """Get news sentiment aggregation and trend"""
    return await data_service.get_stock_sentiment(symbol.upper())


@router.get("/reddit/{symbol}")
@route_handler
async def get_social_sentiment(symbol: str):
    """Get Reddit + StockTwits social sentiment"""
    return await data_service.get_social_sentiment(symbol.upper())


@router.get("/scorecard/{symbol}")
@route_handler
async def get_scorecard(symbol: str):
    """Get 5-category investment scorecard with overall grade"""
    return await data_service.get_scorecard(symbol.upper())


@router.get("/relations/{symbol}")
@route_handler
async def get_company_relations(symbol: str):
    """Return curated supply-chain / competitor / customer / partner relationships."""
    return await data_service.get_company_relations(symbol.upper())


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
    history = await data_service.get_indicator_history(indicator_upper, period)
    if not history:
        raise HTTPException(status_code=404, detail=f"No data for indicator {indicator}")
    return {"indicator": indicator_upper, "period": period, "data": history}
