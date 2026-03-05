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
    try:
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/orderbook/{symbol}")
async def get_stock_orderbook(symbol: str):
    """
    Get approximate order book for a US stock.
    Uses Polygon.io NBBO quotes aggregated by price level.
    """
    try:
        result = await data_service.get_stock_orderbook(symbol.upper())
        return result
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


@router.get("/metrics/{symbol}")
async def get_key_metrics(symbol: str):
    """
    Get key financial metrics and ratios for a stock

    Returns valuation multiples, profitability ratios, liquidity metrics, and more
    """
    try:
        metrics = await data_service.get_key_metrics(symbol.upper())
        if not metrics:
            raise HTTPException(status_code=404, detail=f"Metrics for {symbol} not found")
        return metrics
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


@router.get("/earnings/{symbol}")
async def get_earnings(symbol: str, limit: int = 8):
    """
    Get earnings data for a stock

    Returns quarterly earnings with EPS actual vs estimated
    """
    try:
        earnings = await data_service.get_earnings(symbol.upper(), limit)
        return earnings
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/insider-trading/{symbol}")
async def get_insider_trading(symbol: str, limit: int = 50):
    """
    Get insider trading data for a stock

    Returns recent insider transactions with buy/sell summary
    """
    try:
        insider = await data_service.get_insider_trading(symbol.upper(), limit)
        return insider
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/insider-holders/{symbol}")
async def get_insider_holders(symbol: str):
    """
    Get insider roster/holders information for a stock

    Returns list of insiders with their positions and share holdings
    """
    try:
        holders = await data_service.get_insider_holders(symbol.upper())
        return holders
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analyst/{symbol}")
async def get_analyst_data(symbol: str):
    """
    Get analyst recommendations and price targets

    Returns consensus rating, price targets, and analyst count
    """
    try:
        analyst = await data_service.get_analyst_data(symbol.upper())
        return analyst
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/holders/{symbol}")
async def get_holders(symbol: str):
    """
    Get institutional and insider holder information

    Returns ownership breakdown, institutional holders list, and share statistics
    """
    try:
        holders = await data_service.get_holders(symbol.upper())
        return holders
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/calendar/{symbol}")
async def get_calendar(
    symbol: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    Get company calendar events

    Returns upcoming earnings dates, dividend dates, and other corporate events

    Args:
        symbol: Stock symbol
        start_date: Start date filter (YYYY-MM-DD)
        end_date: End date filter (YYYY-MM-DD)
    """
    try:
        calendar = await data_service.get_calendar(
            symbol.upper(),
            start_date=start_date,
            end_date=end_date
        )
        return calendar
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dividends/{symbol}")
async def get_dividends(symbol: str, limit: int = 20):
    """
    Get dividend history for a stock

    Returns historical dividend payments with dates and amounts
    """
    try:
        dividends = await data_service.get_dividends(symbol.upper(), limit)
        return dividends
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/splits/{symbol}")
async def get_splits(symbol: str, limit: int = 20):
    """
    Get stock split history

    Returns historical stock splits with dates and ratios
    """
    try:
        splits = await data_service.get_splits(symbol.upper(), limit)
        return splits
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/filings/{symbol}")
async def get_filings(symbol: str, limit: int = 20):
    """
    Get SEC filings for a stock

    Returns recent SEC filings with links to EDGAR
    """
    try:
        filings = await data_service.get_filings(symbol.upper(), limit)
        return filings
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quarterly-pnl/{symbol}")
async def get_quarterly_pnl(symbol: str, limit: int = 12):
    """
    Get quarterly P&L breakdown (Revenue, COGS, Gross Profit, OpEx, Net Income).
    Source: yfinance quarterly income statement.
    """
    try:
        data = await data_service.get_quarterly_pnl(symbol.upper(), limit=limit)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/revenue-segments/{symbol}")
async def get_revenue_segments(symbol: str, limit: int = 8):
    """
    Get revenue breakdown by product segment and geographic region.

    Args:
        symbol: Stock symbol (e.g. AAPL, MSFT, NVDA)
        limit:  Number of annual periods to return (default 8)

    Returns:
        product: Revenue by business/product segment (iPhone, Mac, Services …)
        geo:     Revenue by geography (Americas, Europe, China …)
        has_product / has_geo: availability flags
    """
    try:
        data = await data_service.get_revenue_segments(symbol.upper(), limit=limit)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/estimates/{symbol}")
async def get_estimates(symbol: str):
    """
    Get analyst estimates for EPS and revenue

    Returns consensus estimates, price targets, and analyst revisions
    """
    try:
        estimates = await data_service.get_estimates(symbol.upper())
        return estimates
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/management/{symbol}")
async def get_management(symbol: str):
    """Get executive team and governance risk data"""
    try:
        data = await data_service.get_management(symbol.upper())
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/moat/{symbol}")
async def get_moat_analysis(symbol: str):
    """Get 10-year economic moat analysis (ROE, ROIC, margins, FCF)"""
    try:
        data = await data_service.get_moat_analysis(symbol.upper())
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/swot/{symbol}")
async def get_swot(symbol: str):
    """Get data-driven SWOT analysis"""
    try:
        data = await data_service.get_swot(symbol.upper())
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sentiment/{symbol}")
async def get_stock_sentiment(symbol: str):
    """Get news sentiment aggregation and trend"""
    try:
        data = await data_service.get_stock_sentiment(symbol.upper())
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reddit/{symbol}")
async def get_social_sentiment(symbol: str):
    """Get Reddit + StockTwits social sentiment"""
    try:
        data = await data_service.get_social_sentiment(symbol.upper())
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scorecard/{symbol}")
async def get_scorecard(symbol: str):
    """Get 5-category investment scorecard with overall grade"""
    try:
        data = await data_service.get_scorecard(symbol.upper())
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/relations/{symbol}")
async def get_company_relations(symbol: str):
    """Return curated supply-chain / competitor / customer / partner relationships."""
    try:
        data = await data_service.get_company_relations(symbol.upper())
        return data
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
