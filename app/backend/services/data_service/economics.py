"""Economic indicators and company relations methods."""
import asyncio
import logging
from typing import Any, Dict

from data_fetcher.models.fred.gdp import GDPQueryParams
from data_fetcher.models.fred.unemployment import UnemploymentQueryParams
from data_fetcher.models.fred.cpi import CPIQueryParams
from data_fetcher.models.fred.interest_rate import InterestRateQueryParams
from data_fetcher.models.fred.retail_sales import RetailSalesQueryParams
from data_fetcher.models.fred.consumer_sentiment import ConsumerSentimentQueryParams
from data_fetcher.models.fred.nonfarm_payroll import NonfarmPayrollQueryParams
from data_fetcher.models.fred.housing_starts import HousingStartsQueryParams
from data_fetcher.models.fred.industrial_production import IndustrialProductionQueryParams
from data_fetcher.utils.helpers import parse_period_to_dates

log = logging.getLogger(__name__)


class EconomicsMixin:

    _INDICATOR_QUERIES = {
        'GDP':                   lambda sd, ed: GDPQueryParams(start_date=sd, end_date=ed),
        'UNEMPLOYMENT':          lambda sd, ed: UnemploymentQueryParams(start_date=sd, end_date=ed),
        'CPI':                   lambda sd, ed: CPIQueryParams(start_date=sd, end_date=ed),
        'FED_FUNDS_RATE':        lambda sd, ed: InterestRateQueryParams(rate_type='federal_funds', start_date=sd, end_date=ed),
        'INTEREST_RATE':         lambda sd, ed: InterestRateQueryParams(rate_type='federal_funds', start_date=sd, end_date=ed),
        'RETAIL_SALES':          lambda sd, ed: RetailSalesQueryParams(start_date=sd, end_date=ed),
        'CONSUMER_SENTIMENT':    lambda sd, ed: ConsumerSentimentQueryParams(start_date=sd, end_date=ed),
        'NONFARM_PAYROLL':       lambda sd, ed: NonfarmPayrollQueryParams(start_date=sd, end_date=ed),
        'HOUSING_STARTS':        lambda sd, ed: HousingStartsQueryParams(start_date=sd, end_date=ed),
        'INDUSTRIAL_PRODUCTION': lambda sd, ed: IndustrialProductionQueryParams(start_date=sd, end_date=ed),
    }

    async def get_economic_indicators(self) -> Dict[str, Any]:
        """Get latest values for key economic indicators."""
        indicators: Dict[str, Any] = {}
        for key, query in [
            ('gdp',           GDPQueryParams()),
            ('unemployment',  UnemploymentQueryParams()),
            ('cpi',           CPIQueryParams()),
            ('interest_rate', InterestRateQueryParams(rate_type='DFF')),
        ]:
            item = await self.fred.fetch_one(query)
            if item is not None:
                indicators[key] = item
        return indicators

    async def get_indicator_history(self, indicator: str, period: str = "5y") -> list:
        """Get historical data for an economic indicator."""
        make_query = self._INDICATOR_QUERIES.get(indicator)
        if not make_query:
            return []
        start_date, end_date = parse_period_to_dates(period)
        return await self.fred.fetch(make_query(start_date, end_date))

    async def _fetch_yahoo_similar_fallback(self, symbol: str, base_sector: str) -> list:
        import httpx
        url = f"https://query2.finance.yahoo.com/v6/finance/recommendationsbysymbol/{symbol}"
        headers = {"User-Agent": "Mozilla/5.0 (compatible; MarketPulse/1.0)"}
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(url, headers=headers)
                if r.status_code != 200:
                    return []
                result = r.json().get("finance", {}).get("result", [])
                if not result:
                    return []
                syms = result[0].get("recommendedSymbols", [])
        except Exception as e:
            log.warning(f"Yahoo 유사종목 fallback 실패 [{symbol}]: {e}")
            return []

        nodes = []
        for item in syms[:10]:
            sym = item.get("symbol", "")
            if not sym or sym == symbol:
                continue
            try:
                import yfinance as yf
                info = await asyncio.to_thread(lambda s=sym: yf.Ticker(s).info)
                nodes.append({
                    "symbol": sym,
                    "name": info.get("longName", sym),
                    "type": "competitor",
                    "detail": f"{info.get('industry', base_sector)} peer",
                })
            except Exception:
                nodes.append({"symbol": sym, "name": sym, "type": "competitor", "detail": "Peer"})
        return nodes

    async def get_company_relations(self, symbol: str) -> dict:
        """종목 관계 그래프 반환 (DB-first → Yahoo Finance fallback)."""
        from index_analyzer.services.stock_service import get_relations_from_db, get_profile_from_db

        symbol = symbol.upper()
        db_nodes = await asyncio.to_thread(get_relations_from_db, symbol)
        profile  = await asyncio.to_thread(get_profile_from_db, symbol)

        name   = profile.get("stk_nm", symbol) if profile else symbol
        sector = profile.get("sector", "") if profile else ""

        if db_nodes:
            return {"symbol": symbol, "name": name, "sector": sector,
                    "nodes": db_nodes, "found": True, "data_source": "db_fmp_peers"}

        if not sector:
            try:
                import yfinance as yf
                info = await asyncio.to_thread(lambda: yf.Ticker(symbol).info)
                name   = info.get("longName", symbol)
                sector = info.get("sector", "")
            except Exception:
                pass

        yahoo_nodes = await self._fetch_yahoo_similar_fallback(symbol, sector)
        return {"symbol": symbol, "name": name, "sector": sector,
                "nodes": yahoo_nodes, "found": bool(yahoo_nodes), "data_source": "yahoo_finance"}
