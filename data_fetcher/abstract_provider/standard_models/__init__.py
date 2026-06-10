"""standard_models — Provider 무관 표준 입출력 스펙

각 provider는 이 모듈의 클래스를 상속해 provider 전용 필드와 __alias_dict__를 추가합니다.
"""
from data_fetcher.abstract_provider.standard_models.equity_quote import (
    EquityQuoteQueryParams,
    EquityQuoteData,
)
from data_fetcher.abstract_provider.standard_models.equity_historical import (
    EquityHistoricalQueryParams,
    EquityHistoricalData,
)
from data_fetcher.abstract_provider.standard_models.company_profile import (
    CompanyProfileQueryParams,
    CompanyProfileData,
)
from data_fetcher.abstract_provider.standard_models.income_statement import (
    IncomeStatementQueryParams,
    IncomeStatementData,
)
from data_fetcher.abstract_provider.standard_models.analyst_estimates import (
    AnalystEstimatesQueryParams,
    AnalystEstimatesData,
)
from data_fetcher.abstract_provider.standard_models.fred_series import (
    FredSeriesQueryParams,
    FredSeriesData,
)
from data_fetcher.abstract_provider.standard_models.technical_indicators import (
    TechnicalIndicatorQueryParams,
    TechnicalIndicatorData,
    MACDData,
    BollingerBandsData,
)
from data_fetcher.abstract_provider.standard_models.news import (
    NewsQueryParams,
    NewsData,
)
from data_fetcher.abstract_provider.standard_models.search import (
    SearchQueryParams,
    SearchData,
)
from data_fetcher.abstract_provider.standard_models.market_movers import (
    MarketMoversQueryParams,
    MarketMoverData,
)
from data_fetcher.abstract_provider.standard_models.balance_sheet import (
    BalanceSheetQueryParams, BalanceSheetData,
)
from data_fetcher.abstract_provider.standard_models.cash_flow import (
    CashFlowQueryParams, CashFlowData,
)
from data_fetcher.abstract_provider.standard_models.financials import (
    FinancialsQueryParams, FinancialsData,
)
from data_fetcher.abstract_provider.standard_models.insider_trading import (
    InsiderTradingQueryParams, InsiderTradingData,
)
from data_fetcher.abstract_provider.standard_models.earnings import (
    EarningsQueryParams, EarningsData,
)
from data_fetcher.abstract_provider.standard_models.dividends import (
    DividendsQueryParams, DividendData,
)
from data_fetcher.abstract_provider.standard_models.short_interest import (
    ShortInterestQueryParams, ShortInterestData,
)
from data_fetcher.abstract_provider.standard_models.analyst_recommendations import (
    AnalystRecommendationsQueryParams, AnalystRecommendationsData,
)
from data_fetcher.abstract_provider.standard_models.key_metrics import (
    KeyMetricsQueryParams, KeyMetricsData,
)
from data_fetcher.abstract_provider.standard_models.stock_list import (
    StockListQueryParams, StockListData,
)

__all__ = [
    "EquityQuoteQueryParams", "EquityQuoteData",
    "EquityHistoricalQueryParams", "EquityHistoricalData",
    "CompanyProfileQueryParams", "CompanyProfileData",
    "IncomeStatementQueryParams", "IncomeStatementData",
    "AnalystEstimatesQueryParams", "AnalystEstimatesData",
    "FredSeriesQueryParams", "FredSeriesData",
    "TechnicalIndicatorQueryParams", "TechnicalIndicatorData",
    "MACDData", "BollingerBandsData",
    "NewsQueryParams", "NewsData",
    "SearchQueryParams", "SearchData",
    "MarketMoversQueryParams", "MarketMoverData",
    "BalanceSheetQueryParams", "BalanceSheetData",
    "CashFlowQueryParams", "CashFlowData",
    "FinancialsQueryParams", "FinancialsData",
    "InsiderTradingQueryParams", "InsiderTradingData",
    "EarningsQueryParams", "EarningsData",
    "DividendsQueryParams", "DividendData",
    "ShortInterestQueryParams", "ShortInterestData",
    "AnalystRecommendationsQueryParams", "AnalystRecommendationsData",
    "KeyMetricsQueryParams", "KeyMetricsData",
    "StockListQueryParams", "StockListData",
]
