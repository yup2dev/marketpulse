"""
MacroManager

거시경제 지표 관련 데이터 조회 (FRED, AlphaVantage Forex, FMP Bond).
"""
from typing import Dict, List, Optional

from data_fetcher.query_executor import QueryExecutor
from data_fetcher.fetchers.base import AnnotatedResult
from data_fetcher.models.fred.gdp import GDPData
from data_fetcher.models.fred.cpi import CPIData
from data_fetcher.models.fred.unemployment import UnemploymentData
from data_fetcher.models.fred.interest_rate import InterestRateData
from data_fetcher.models.fred.retail_sales import RetailSalesData
from data_fetcher.models.fred.consumer_sentiment import ConsumerSentimentData
from data_fetcher.models.fred.nonfarm_payroll import NonfarmPayrollData
from data_fetcher.models.fred.employment import EmploymentData
from data_fetcher.models.fred.housing_starts import HousingStartsData
from data_fetcher.models.fred.industrial_production import IndustrialProductionData
from data_fetcher.models.alphavantage.forex import ForexData
from data_fetcher.models.bond.bond_prices import BondPricesData


class MacroManager:
    """거시경제 데이터 관리"""

    # ── FRED 메서드 ────────────────────────────────────────────────────────
    @classmethod
    async def fred_gdp_data(
        cls,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        credentials: Optional[Dict] = None,
    ) -> List[GDPData]:
        """FRED GDP 조회"""
        params: Dict = {}
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        raw = await QueryExecutor.fetch(
            provider="fred",
            model="gdp",
            params=params,
            credentials=credentials,
        )
        return raw.result if isinstance(raw, AnnotatedResult) else raw

    @classmethod
    async def fred_cpi_data(
        cls,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        credentials: Optional[Dict] = None,
    ) -> List[CPIData]:
        """FRED CPI 조회"""
        params: Dict = {}
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        raw = await QueryExecutor.fetch(
            provider="fred",
            model="cpi",
            params=params,
            credentials=credentials,
        )
        return raw.result if isinstance(raw, AnnotatedResult) else raw

    @classmethod
    async def fred_unemployment_data(
        cls,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        credentials: Optional[Dict] = None,
    ) -> List[UnemploymentData]:
        """FRED 실업률 조회"""
        params: Dict = {}
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        raw = await QueryExecutor.fetch(
            provider="fred",
            model="unemployment",
            params=params,
            credentials=credentials,
        )
        return raw.result if isinstance(raw, AnnotatedResult) else raw

    @classmethod
    async def fred_interest_rate_data(
        cls,
        rate_type: str = "federal_funds",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        credentials: Optional[Dict] = None,
    ) -> List[InterestRateData]:
        """FRED 금리 조회"""
        params: Dict = {"rate_type": rate_type}
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        raw = await QueryExecutor.fetch(
            provider="fred",
            model="interest_rate",
            params=params,
            credentials=credentials,
        )
        return raw.result if isinstance(raw, AnnotatedResult) else raw

    @classmethod
    async def fred_retail_sales_data(
        cls,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        credentials: Optional[Dict] = None,
    ) -> List[RetailSalesData]:
        """FRED 소매 판매 조회"""
        params: Dict = {}
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        raw = await QueryExecutor.fetch(
            provider="fred",
            model="retail_sales",
            params=params,
            credentials=credentials,
        )
        return raw.result if isinstance(raw, AnnotatedResult) else raw

    @classmethod
    async def fred_consumer_sentiment_data(
        cls,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        credentials: Optional[Dict] = None,
    ) -> List[ConsumerSentimentData]:
        """FRED 소비자 심리 조회"""
        params: Dict = {}
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        raw = await QueryExecutor.fetch(
            provider="fred",
            model="consumer_sentiment",
            params=params,
            credentials=credentials,
        )
        return raw.result if isinstance(raw, AnnotatedResult) else raw

    @classmethod
    async def fred_nonfarm_payroll_data(
        cls,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        credentials: Optional[Dict] = None,
    ) -> List[NonfarmPayrollData]:
        """FRED 비농업 고용 조회"""
        params: Dict = {}
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        raw = await QueryExecutor.fetch(
            provider="fred",
            model="nonfarm_payroll",
            params=params,
            credentials=credentials,
        )
        return raw.result if isinstance(raw, AnnotatedResult) else raw

    @classmethod
    async def fred_employment_data(
        cls,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        credentials: Optional[Dict] = None,
    ) -> List[EmploymentData]:
        """FRED 고용 조회"""
        params: Dict = {}
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        raw = await QueryExecutor.fetch(
            provider="fred",
            model="employment",
            params=params,
            credentials=credentials,
        )
        return raw.result if isinstance(raw, AnnotatedResult) else raw

    @classmethod
    async def fred_housing_starts_data(
        cls,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        credentials: Optional[Dict] = None,
    ) -> List[HousingStartsData]:
        """FRED 주택 착공 조회"""
        params: Dict = {}
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        raw = await QueryExecutor.fetch(
            provider="fred",
            model="housing_starts",
            params=params,
            credentials=credentials,
        )
        return raw.result if isinstance(raw, AnnotatedResult) else raw

    @classmethod
    async def fred_industrial_production_data(
        cls,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        credentials: Optional[Dict] = None,
    ) -> List[IndustrialProductionData]:
        """FRED 산업 생산 조회"""
        params: Dict = {}
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        raw = await QueryExecutor.fetch(
            provider="fred",
            model="industrial_production",
            params=params,
            credentials=credentials,
        )
        return raw.result if isinstance(raw, AnnotatedResult) else raw

    # ── AlphaVantage Forex ─────────────────────────────────────────────────
    @classmethod
    async def alphavantage_forex_data(
        cls,
        from_currency: str = "USD",
        to_currency: str = "KRW",
        credentials: Optional[Dict] = None,
    ) -> List[ForexData]:
        """AlphaVantage 환율 조회"""
        raw = await QueryExecutor.fetch(
            provider="alphavantage",
            model="forex",
            params={"from_currency": from_currency, "to_currency": to_currency},
            credentials=credentials,
        )
        return raw.result if isinstance(raw, AnnotatedResult) else raw

    # ── FMP Bond ───────────────────────────────────────────────────────────
    @classmethod
    async def fmp_bond_prices_data(
        cls,
        credentials: Optional[Dict] = None,
    ) -> List[BondPricesData]:
        """FMP 채권 가격 조회"""
        raw = await QueryExecutor.fetch(
            provider="fmp",
            model="bond_prices",
            params={},
            credentials=credentials,
        )
        return raw.result if isinstance(raw, AnnotatedResult) else raw
