"""
Provider Initialization

Automatically registers all providers and their fetchers.
This file should be imported to activate all providers.
"""
import logging

from data_fetcher.abstract_provider.abstract.provider import Provider, ProviderRegistry

# Import all fetchers — new flat structure (providers/{name}/{endpoint}.py)
from data_fetcher.providers.fred.gdp import FREDGDPFetcher
from data_fetcher.providers.fred.cpi import FREDCPIFetcher
from data_fetcher.providers.fred.unemployment import FREDUnemploymentFetcher
from data_fetcher.providers.fred.interest_rate import FREDInterestRateFetcher
from data_fetcher.providers.fred.employment import FREDEmploymentFetcher
from data_fetcher.providers.fred.industrial_production import FREDIndustrialProductionFetcher
from data_fetcher.providers.fred.consumer_sentiment import FREDConsumerSentimentFetcher
from data_fetcher.providers.fred.housing_starts import FREDHousingStartsFetcher
from data_fetcher.providers.fred.retail_sales import FREDRetailSalesFetcher
from data_fetcher.providers.fred.nonfarm_payroll import FREDNonfarmPayrollFetcher
from data_fetcher.providers.fred.generic_series import FREDGenericSeriesFetcher
from data_fetcher.providers.fred.fed_balance_sheet import FREDFedBalanceSheetFetcher
from data_fetcher.providers.fred.real_rates import FREDRealRatesFetcher
from data_fetcher.providers.fred.pmi import FREDPMIFetcher
from data_fetcher.providers.fred.yield_curve import FREDYieldCurveFetcher
from data_fetcher.providers.fred.inflation_momentum import FREDInflationMomentumFetcher
from data_fetcher.providers.fred.yield_curve_history import FREDYieldCurveHistoryFetcher
from data_fetcher.providers.fred.initial_claims import FREDInitialClaimsFetcher
from data_fetcher.providers.fred.jobs_breakdown import FREDJobsBreakdownFetcher
from data_fetcher.providers.fred.financial_conditions_history import FREDFinancialConditionsHistoryFetcher
from data_fetcher.providers.fred.sentiment_history import FREDSentimentHistoryFetcher
from data_fetcher.providers.fred.inflation_sector import FREDInflationSectorFetcher
from data_fetcher.providers.fred.regime_history import FREDRegimeHistoryFetcher
from data_fetcher.providers.fred.phillips_curve import FREDPhillipsCurveFetcher
from data_fetcher.providers.fred.financial_conditions import FREDFinancialConditionsFetcher
from data_fetcher.providers.fred.sentiment_composite import FREDSentimentCompositeFetcher
from data_fetcher.providers.fred.labor_dashboard import FREDLaborDashboardFetcher

from data_fetcher.providers.yahoo.stock_price import YFinanceStockPriceFetcher
from data_fetcher.providers.yahoo.stock_quote import YFinanceQuoteFetcher
from data_fetcher.providers.yahoo.batch_quotes import YFinanceBatchQuotesFetcher
from data_fetcher.providers.yahoo.dividends import YFinanceDividendsFetcher
from data_fetcher.providers.yahoo.company_info import YFinanceCompanyInfoFetcher
from data_fetcher.providers.yahoo.financials import YFinanceFinancialsFetcher
from data_fetcher.providers.yahoo.balance_sheet import YFinanceBalanceSheetFetcher
from data_fetcher.providers.yahoo.key_metrics import YFinanceKeyMetricsFetcher
from data_fetcher.providers.yahoo.quarterly_pnl import YFinanceQuarterlyPnLFetcher
from data_fetcher.providers.yahoo.holders import YFinanceHoldersFetcher
from data_fetcher.providers.yahoo.calendar import YFinanceCalendarFetcher
from data_fetcher.providers.yahoo.splits import YFinanceSplitsFetcher
from data_fetcher.providers.yahoo.filings import YFinanceFilingsFetcher
from data_fetcher.providers.yahoo.estimates import YFinanceEstimatesFetcher
from data_fetcher.providers.yahoo.management import YFinanceManagementFetcher
from data_fetcher.providers.yahoo.moat import YFinanceMoatFetcher
from data_fetcher.providers.yahoo.swot import YFinanceSWOTFetcher
from data_fetcher.providers.yahoo.scorecard import YFinanceScorecardFetcher
from data_fetcher.providers.yahoo.insider_trading import (
    YFinanceInsiderTradingFetcher,
    YFinanceInsiderHoldersFetcher,
    YFinanceInsiderTradingSummaryFetcher,
)

from data_fetcher.providers.alphavantage.equity_quote import AlphaVantageQuoteFetcher, AlphaVantageTimeseriesFetcher
from data_fetcher.providers.alphavantage.forex import AlphaVantageForexFetcher
from data_fetcher.providers.alphavantage.company_overview import AlphaVantageCompanyOverviewFetcher
from data_fetcher.providers.alphavantage.crypto import AlphaVantageCryptoFetcher

from data_fetcher.providers.fmp.equity_quote import FMPQuoteFetcher
from data_fetcher.providers.fmp.company_profile import FMPCompanyProfileFetcher
from data_fetcher.providers.fmp.income_statement import FMPIncomeStatementFetcher
from data_fetcher.providers.fmp.analyst_estimates import FMPAnalystEstimatesFetcher
from data_fetcher.providers.fmp.analyst_recommendations import FMPAnalystRecommendationsFetcher
from data_fetcher.providers.fmp.search import FMPSearchFetcher
from data_fetcher.providers.fmp.gainers import FMPMostActivesFetcher, FMPGainersFetcher, FMPLosersFetcher
from data_fetcher.providers.bond.bond_prices import FMPBondPricesFetcher

from data_fetcher.providers.polygon.news import PolygonNewsFetcher
from data_fetcher.providers.polygon.earnings import PolygonEarningsFetcher
from data_fetcher.providers.polygon.insider_trading import PolygonInsiderTradingFetcher
from data_fetcher.providers.polygon.sentiment import PolygonStockSentimentFetcher
from data_fetcher.providers.polygon.options import PolygonOptionsFetcher
from data_fetcher.providers.polygon.short_interest import PolygonShortInterestFetcher
from data_fetcher.providers.polygon.technical_indicators import PolygonTechnicalIndicatorsFetcher

# Tiingo (OpenBB openbb_tiingo 이식)
from data_fetcher.providers.tiingo.equity_historical import TiingoEquityHistoricalFetcher

# ── OpenBB 이식 provider (MACRO/STOCK) — 프로젝트 네이티브 베이스 사용 ──────────
# WSJ (STOCK — ETF movers)
from data_fetcher.providers.wsj.models.active import WSJActiveFetcher
from data_fetcher.providers.wsj.models.gainers import WSJGainersFetcher
from data_fetcher.providers.wsj.models.losers import WSJLosersFetcher
# BLS (MACRO — 노동/물가 통계)
from data_fetcher.providers.bls.models.series import BlsSeriesFetcher
from data_fetcher.providers.bls.models.search import BlsSearchFetcher
# EIA (MACRO — 에너지)
from data_fetcher.providers.eia.models.petroleum_status_report import EiaPetroleumStatusReportFetcher
from data_fetcher.providers.eia.models.short_term_energy_outlook import EiaShortTermEnergyOutlookFetcher
# OECD (MACRO)
from data_fetcher.providers.oecd.models.composite_leading_indicator import OECDCompositeLeadingIndicatorFetcher
from data_fetcher.providers.oecd.models.consumer_price_index import OECDCPIFetcher
from data_fetcher.providers.oecd.models.country_interest_rates import OecdCountryInterestRatesFetcher
from data_fetcher.providers.oecd.models.gdp_forecast import OECDGdpForecastFetcher
from data_fetcher.providers.oecd.models.gdp_nominal import OECDGdpNominalFetcher
from data_fetcher.providers.oecd.models.gdp_real import OECDGdpRealFetcher
from data_fetcher.providers.oecd.models.house_price_index import OECDHousePriceIndexFetcher
from data_fetcher.providers.oecd.models.share_price_index import OECDSharePriceIndexFetcher
from data_fetcher.providers.oecd.models.unemployment import OECDUnemploymentFetcher
# IMF (MACRO)
from data_fetcher.providers.imf.models.available_indicators import ImfAvailableIndicatorsFetcher
from data_fetcher.providers.imf.models.consumer_price_index import ImfConsumerPriceIndexFetcher
from data_fetcher.providers.imf.models.direction_of_trade import ImfDirectionOfTradeFetcher
from data_fetcher.providers.imf.models.economic_indicators import ImfEconomicIndicatorsFetcher
from data_fetcher.providers.imf.models.maritime_chokepoint_info import ImfMaritimeChokePointInfoFetcher
from data_fetcher.providers.imf.models.maritime_chokepoint_volume import ImfMaritimeChokePointVolumeFetcher
from data_fetcher.providers.imf.models.port_info import ImfPortInfoFetcher
from data_fetcher.providers.imf.models.port_volume import ImfPortVolumeFetcher

from data_fetcher.providers.sec.insider_trading import SECInsiderTradingFetcher
from data_fetcher.providers.sec.institutional_13f import SEC13FFetcher
from data_fetcher.providers.sec.institutions_list import SECInstitutionsListFetcher

# SEC — OpenBB openbb_sec 이식본 (sec/models/ 하위, 기존 3개와 별도 카테고리)
from data_fetcher.providers.sec.models.balance_sheet import SecBalanceSheetFetcher
from data_fetcher.providers.sec.models.balance_sheet_growth import SecBalanceSheetGrowthFetcher
from data_fetcher.providers.sec.models.cash_flow import SecCashFlowStatementFetcher
from data_fetcher.providers.sec.models.cash_flow_growth import SecCashFlowStatementGrowthFetcher
from data_fetcher.providers.sec.models.cik_map import SecCikMapFetcher
from data_fetcher.providers.sec.models.company_filings import SecCompanyFilingsFetcher
from data_fetcher.providers.sec.models.compare_company_facts import SecCompareCompanyFactsFetcher
from data_fetcher.providers.sec.models.equity_ftd import SecEquityFtdFetcher
from data_fetcher.providers.sec.models.equity_search import SecEquitySearchFetcher
from data_fetcher.providers.sec.models.form_13FHR import SecForm13FHRFetcher
from data_fetcher.providers.sec.models.htm_file import SecHtmFileFetcher
from data_fetcher.providers.sec.models.income_statement import SecIncomeStatementFetcher
from data_fetcher.providers.sec.models.income_statement_growth import SecIncomeStatementGrowthFetcher
from data_fetcher.providers.sec.models.insider_trading import SecInsiderTradingFetcher
from data_fetcher.providers.sec.models.institutions_search import SecInstitutionsSearchFetcher
from data_fetcher.providers.sec.models.latest_financial_reports import SecLatestFinancialReportsFetcher
from data_fetcher.providers.sec.models.management_discussion_analysis import SecManagementDiscussionAnalysisFetcher
from data_fetcher.providers.sec.models.nport_disclosure import SecNportDisclosureFetcher
from data_fetcher.providers.sec.models.rss_litigation import SecRssLitigationFetcher
from data_fetcher.providers.sec.models.schema_files import SecSchemaFilesFetcher
from data_fetcher.providers.sec.models.sec_filing import SecFilingFetcher
from data_fetcher.providers.sec.models.sic_search import SecSicSearchFetcher
from data_fetcher.providers.sec.models.symbol_map import SecSymbolMapFetcher

from data_fetcher.providers.fmp.analyst_data import FMPAnalystDataFetcher
from data_fetcher.providers.fmp.revenue_segments import FMPRevenueSegmentsFetcher
from data_fetcher.providers.fmp.index_constituents import FMPIndexConstituentsFetcher

from data_fetcher.providers.social.sentiment import SocialSentimentFetcher

# database provider는 sqlalchemy(WebServer/DB 환경)에서만 사용 가능.
# Fetcher(exe)처럼 sqlalchemy 없는 환경에선 조용히 스킵한다.
try:
    from data_fetcher.providers.database.index_constituents import DBIndexConstituentsFetcher
    from data_fetcher.providers.database.stock_list import DBStockListFetcher
    from data_fetcher.providers.database.stock_ranking import DBStockRankingFetcher
    _db_available = True
except ImportError:
    _db_available = False

from data_fetcher.providers.nasdaqtrader.listing import NasdaqTraderListingFetcher
from data_fetcher.providers.krx.listing import KRXListingFetcher
from data_fetcher.providers.krx.bond import KRXBondFetcher

# KIS(한국투자증권) — httpx만 있으면 동작. import 실패 시 조용히 스킵.
try:
    from data_fetcher.providers.kis.ranking import KISRankingFetcher
    _kis_available = True
except ImportError:
    _kis_available = False
from data_fetcher.providers.whalewisdom.institutional_holdings import WhaleWisdomFetcher
from data_fetcher.providers.whalewisdom.institutions_list import InstitutionsListFetcher

# quantlib / quantitative는 scipy·QuantLib 등 선택적 의존성 필요.
# 없는 환경(Fetcher exe)에서는 조용히 스킵한다.
try:
    from data_fetcher.providers.quantlib.pricing import QuantLibPricingFetcher
    _quantlib_available = True
except ImportError:
    _quantlib_available = False

try:
    from data_fetcher.providers.quantitative.summary import QuantSummaryFetcher
    from data_fetcher.providers.quantitative.normality import QuantNormalityFetcher
    from data_fetcher.providers.quantitative.capm import QuantCAPMFetcher
    from data_fetcher.providers.quantitative.rolling import QuantRollingFetcher
    from data_fetcher.providers.quantitative.unitroot import QuantUnitRootFetcher
    _quantitative_available = True
except ImportError:
    _quantitative_available = False

log = logging.getLogger(__name__)


# ==================== FRED Provider ====================

fred_provider = Provider(
    name="fred",
    description="Federal Reserve Economic Data (FRED)",
    website="https://fred.stlouisfed.org",
    credentials=["api_key"],
    fetcher_dict={
        "gdp": FREDGDPFetcher,
        "cpi": FREDCPIFetcher,
        "unemployment": FREDUnemploymentFetcher,
        "interest_rate": FREDInterestRateFetcher,
        "employment": FREDEmploymentFetcher,
        "industrial_production": FREDIndustrialProductionFetcher,
        "consumer_sentiment": FREDConsumerSentimentFetcher,
        "housing_starts": FREDHousingStartsFetcher,
        "retail_sales": FREDRetailSalesFetcher,
        "nonfarm_payroll": FREDNonfarmPayrollFetcher,
        "series": FREDGenericSeriesFetcher,
        "fed_balance_sheet":    FREDFedBalanceSheetFetcher,
        "real_rates":           FREDRealRatesFetcher,
        "pmi":                  FREDPMIFetcher,
        "yield_curve":          FREDYieldCurveFetcher,
        "inflation_momentum":           FREDInflationMomentumFetcher,
        "yield_curve_history":          FREDYieldCurveHistoryFetcher,
        "initial_claims":               FREDInitialClaimsFetcher,
        "jobs_breakdown":               FREDJobsBreakdownFetcher,
        "financial_conditions_history": FREDFinancialConditionsHistoryFetcher,
        "sentiment_history":            FREDSentimentHistoryFetcher,
        "inflation_sector":             FREDInflationSectorFetcher,
        "regime_history":               FREDRegimeHistoryFetcher,
        "phillips_curve":               FREDPhillipsCurveFetcher,
        "financial_conditions":         FREDFinancialConditionsFetcher,
        "sentiment_composite":          FREDSentimentCompositeFetcher,
        "labor_dashboard":              FREDLaborDashboardFetcher,
    },
    metadata={
        "rate_limit": "120 requests/minute",
        "data_coverage": "US economic data",
    }
)


# ==================== Yahoo Provider ====================

yahoo_provider = Provider(
    name="yahoo",
    description="Yahoo Finance",
    website="https://finance.yahoo.com",
    credentials=[],  # No API key required
    fetcher_dict={
        "stock_price": YFinanceStockPriceFetcher,
        "quote":       YFinanceQuoteFetcher,
        "batch_quotes": YFinanceBatchQuotesFetcher,
        "dividends": YFinanceDividendsFetcher,
        "company_info": YFinanceCompanyInfoFetcher,
        "financials": YFinanceFinancialsFetcher,
        "balance_sheet": YFinanceBalanceSheetFetcher,
        "key_metrics": YFinanceKeyMetricsFetcher,
        "quarterly_pnl": YFinanceQuarterlyPnLFetcher,
        "holders": YFinanceHoldersFetcher,
        "calendar": YFinanceCalendarFetcher,
        "splits": YFinanceSplitsFetcher,
        "filings": YFinanceFilingsFetcher,
        "estimates": YFinanceEstimatesFetcher,
        "management": YFinanceManagementFetcher,
        "moat": YFinanceMoatFetcher,
        "swot": YFinanceSWOTFetcher,
        "scorecard": YFinanceScorecardFetcher,
        "insider_trading": YFinanceInsiderTradingFetcher,
        "insider_trading_summary": YFinanceInsiderTradingSummaryFetcher,
        "insider_holders": YFinanceInsiderHoldersFetcher,
    },
    metadata={
        "rate_limit": "2000 requests/hour",
        "data_coverage": "Global stock market data",
    }
)


# ==================== AlphaVantage Provider ====================

alphavantage_provider = Provider(
    name="alphavantage",
    description="Alpha Vantage Financial Data API",
    website="https://www.alphavantage.co",
    credentials=["api_key"],
    fetcher_dict={
        "quote": AlphaVantageQuoteFetcher,
        "timeseries": AlphaVantageTimeseriesFetcher,
        "forex": AlphaVantageForexFetcher,
        "company_overview": AlphaVantageCompanyOverviewFetcher,
        "crypto": AlphaVantageCryptoFetcher,
    },
    metadata={
        "rate_limit": "5 requests/minute (free tier)",
        "data_coverage": "Global stock market and economic data",
    }
)


# ==================== FMP Provider ====================

fmp_provider = Provider(
    name="fmp",
    description="Financial Modeling Prep API",
    website="https://financialmodelingprep.com",
    credentials=["api_key"],
    fetcher_dict={
        "quote": FMPQuoteFetcher,
        "company_profile": FMPCompanyProfileFetcher,
        "income_statement": FMPIncomeStatementFetcher,
        "analyst_estimates": FMPAnalystEstimatesFetcher,
        "analyst_recommendations": FMPAnalystRecommendationsFetcher,
        "analyst_data": FMPAnalystDataFetcher,
        "revenue_segments": FMPRevenueSegmentsFetcher,
        "search": FMPSearchFetcher,
        "most_actives": FMPMostActivesFetcher,
        "gainers": FMPGainersFetcher,
        "losers": FMPLosersFetcher,
        "bond_prices": FMPBondPricesFetcher,
        "index_constituents": FMPIndexConstituentsFetcher,
    },
    metadata={
        "rate_limit": "250 requests/day (free tier), 750/min (premium)",
        "data_coverage": "Global financial data, company fundamentals, analyst data",
    }
)


# ==================== Polygon Provider ====================

polygon_provider = Provider(
    name="polygon",
    description="Polygon.io Market Data API",
    website="https://polygon.io",
    credentials=["api_key"],
    fetcher_dict={
        "news": PolygonNewsFetcher,
        "earnings": PolygonEarningsFetcher,
        "insider_trading": PolygonInsiderTradingFetcher,
        "sentiment": PolygonStockSentimentFetcher,
        "options": PolygonOptionsFetcher,
        "short_interest": PolygonShortInterestFetcher,
        "technical_indicators": PolygonTechnicalIndicatorsFetcher,
    },
    metadata={
        "rate_limit": "5 requests/minute (free tier)",
        "data_coverage": "US stock market data, news, options",
    }
)


# ==================== Tiingo Provider (OpenBB 이식) ====================

tiingo_provider = Provider(
    name="tiingo",
    description="Tiingo Market Data API (EOD/intraday OHLCV)",
    website="https://www.tiingo.com",
    credentials=["api_key"],
    fetcher_dict={
        "equity_historical": TiingoEquityHistoricalFetcher,
        "stock_price": TiingoEquityHistoricalFetcher,  # 별칭 — yahoo stock_price 대체용
    },
    metadata={
        "data_coverage": "US/global equity OHLCV (EOD + IEX intraday)",
    },
)


# ==================== OpenBB 이식 provider (MACRO/STOCK) ====================
# Provider.metadata["group"] 로 MACRO/STOCK 분류를 표기한다 (providers API가 노출).

wsj_provider = Provider(
    name="wsj",
    description="Wall Street Journal — ETF movers (most active / gainers / losers)",
    website="https://www.wsj.com/market-data",
    credentials=[],
    fetcher_dict={
        "etf_active": WSJActiveFetcher,
        "etf_gainers": WSJGainersFetcher,
        "etf_losers": WSJLosersFetcher,
    },
    metadata={"group": "stock", "data_coverage": "US ETF performance movers"},
)

bls_provider = Provider(
    name="bls",
    description="U.S. Bureau of Labor Statistics — 시계열(고용·물가·임금 등)",
    website="https://www.bls.gov",
    credentials=[],  # 키 없이도 공개 API 동작(키 등록 시 일일 한도 상향)
    fetcher_dict={
        "series": BlsSeriesFetcher,
        "search": BlsSearchFetcher,
    },
    metadata={"group": "macro", "data_coverage": "US labor/price statistics"},
)

eia_provider = Provider(
    name="eia",
    description="U.S. Energy Information Administration — 에너지 통계",
    website="https://www.eia.gov",
    credentials=["api_key"],
    fetcher_dict={
        "petroleum_status_report": EiaPetroleumStatusReportFetcher,
        "short_term_energy_outlook": EiaShortTermEnergyOutlookFetcher,
    },
    metadata={"group": "macro", "data_coverage": "US energy data (petroleum, STEO)"},
)

oecd_provider = Provider(
    name="oecd",
    description="OECD — 거시 경제 지표 (GDP/CPI/실업률/금리 등)",
    website="https://data-explorer.oecd.org",
    credentials=[],
    fetcher_dict={
        "composite_leading_indicator": OECDCompositeLeadingIndicatorFetcher,
        "consumer_price_index": OECDCPIFetcher,
        "country_interest_rates": OecdCountryInterestRatesFetcher,
        "gdp_forecast": OECDGdpForecastFetcher,
        "gdp_nominal": OECDGdpNominalFetcher,
        "gdp_real": OECDGdpRealFetcher,
        "house_price_index": OECDHousePriceIndexFetcher,
        "share_price_index": OECDSharePriceIndexFetcher,
        "unemployment": OECDUnemploymentFetcher,
    },
    metadata={"group": "macro", "data_coverage": "OECD member economies"},
)

imf_provider = Provider(
    name="imf",
    description="International Monetary Fund — 경제 지표/무역/항만(SDMX)",
    website="https://data.imf.org",
    credentials=[],
    fetcher_dict={
        "available_indicators": ImfAvailableIndicatorsFetcher,
        "consumer_price_index": ImfConsumerPriceIndexFetcher,
        "direction_of_trade": ImfDirectionOfTradeFetcher,
        "economic_indicators": ImfEconomicIndicatorsFetcher,
        "maritime_chokepoint_info": ImfMaritimeChokePointInfoFetcher,
        "maritime_chokepoint_volume": ImfMaritimeChokePointVolumeFetcher,
        "port_info": ImfPortInfoFetcher,
        "port_volume": ImfPortVolumeFetcher,
    },
    metadata={"group": "macro", "data_coverage": "IMF global economic data"},
)


# ==================== Social Provider ====================

social_provider = Provider(
    name="social",
    description="Social Sentiment (Reddit, StockTwits)",
    credentials=[],
    fetcher_dict={
        "sentiment": SocialSentimentFetcher,
    },
)


# ==================== Database Provider ====================

db_provider = Provider(
    name="db",
    description="Local SQLite Database",
    credentials=[],
    fetcher_dict={
        "index_constituents": DBIndexConstituentsFetcher,
        "stock_list": DBStockListFetcher,
        "stock_ranking": DBStockRankingFetcher,
    },
) if _db_available else None


# ==================== Universe Providers (무료·공개) ====================

nasdaqtrader_provider = Provider(
    name="nasdaqtrader",
    description="NASDAQ Trader Symbol Directory — NYSE/NASDAQ 전 종목 (무료·공개)",
    website="https://www.nasdaqtrader.com/Trader.aspx?id=symboldirdefs",
    credentials=[],
    fetcher_dict={
        "listing": NasdaqTraderListingFetcher,
    },
    metadata={
        "rate_limit": "none (정적 공개 파일)",
        "data_coverage": "US NYSE/NASDAQ 상장 전 종목, 일 갱신",
    },
)

krx_provider = Provider(
    name="krx",
    description="KRX (pykrx) — KOSPI/KOSDAQ 전 종목 (무료)",
    website="http://data.krx.co.kr",
    credentials=[],
    fetcher_dict={
        "listing": KRXListingFetcher,
        "bond": KRXBondFetcher,
    },
    metadata={
        "rate_limit": "none (pykrx)",
        "data_coverage": "KR KOSPI/KOSDAQ 상장 전 종목·ETF·국고채",
    },
)


# ==================== WhaleWisdom Provider ====================

whalewisdom_provider = Provider(
    name="whalewisdom",
    description="WhaleWisdom Institutional Holdings (SEC EDGAR 13F)",
    credentials=[],
    fetcher_dict={
        "institutional_holdings": WhaleWisdomFetcher,
        "institutions_list": InstitutionsListFetcher,
    },
)


# ==================== SEC Provider ====================

sec_provider = Provider(
    name="sec",
    description="SEC EDGAR — insider trading (Forms 3/4/5), 13F institutional holdings",
    website="https://www.sec.gov/edgar",
    credentials=[],  # EDGAR is keyless (requires only a User-Agent header)
    fetcher_dict={
        # 기존(프로젝트 자체 구현)
        "insider_trading": SECInsiderTradingFetcher,
        "institutional_13f": SEC13FFetcher,
        "institutions_list": SECInstitutionsListFetcher,
        # OpenBB 이식본 (XBRL 재무제표/공시/검색 등)
        "balance_sheet": SecBalanceSheetFetcher,
        "balance_sheet_growth": SecBalanceSheetGrowthFetcher,
        "cash_flow": SecCashFlowStatementFetcher,
        "cash_flow_growth": SecCashFlowStatementGrowthFetcher,
        "income_statement": SecIncomeStatementFetcher,
        "income_statement_growth": SecIncomeStatementGrowthFetcher,
        "cik_map": SecCikMapFetcher,
        "company_filings": SecCompanyFilingsFetcher,
        "compare_company_facts": SecCompareCompanyFactsFetcher,
        "equity_ftd": SecEquityFtdFetcher,
        "equity_search": SecEquitySearchFetcher,
        "sec_filing": SecFilingFetcher,
        "htm_file": SecHtmFileFetcher,
        "form_13FHR": SecForm13FHRFetcher,
        "insider_trading_xbrl": SecInsiderTradingFetcher,
        "institutions_search": SecInstitutionsSearchFetcher,
        "latest_financial_reports": SecLatestFinancialReportsFetcher,
        "management_discussion_analysis": SecManagementDiscussionAnalysisFetcher,
        "nport_disclosure": SecNportDisclosureFetcher,
        "rss_litigation": SecRssLitigationFetcher,
        "schema_files": SecSchemaFilesFetcher,
        "sic_search": SecSicSearchFetcher,
        "symbol_map": SecSymbolMapFetcher,
    },
    metadata={
        "group": "stock",
        "rate_limit": "10 requests/second (fair-access policy)",
        "data_coverage": "US public company filings",
    },
)


# ==================== QuantLib Provider ====================

quantlib_provider = Provider(
    name="quantlib",
    description="QuantLib Suite — local quantitative computation (no external API)",
    website="https://www.quantlib.org",
    credentials=[],
    fetcher_dict={"pricing": QuantLibPricingFetcher},
    metadata={
        "rate_limit": "none (local computation)",
        "data_coverage": "Option pricing, Greeks, curves, risk, volatility",
    }
) if _quantlib_available else None


# ==================== Quantitative Provider ====================

quantitative_provider = Provider(
    name="quantitative",
    description="Quantitative Analysis Suite — descriptive stats, normality, CAPM, rolling metrics, ADF",
    credentials=[],
    fetcher_dict={
        "summary": QuantSummaryFetcher,
        "normality": QuantNormalityFetcher,
        "capm": QuantCAPMFetcher,
        "rolling": QuantRollingFetcher,
        "unitroot": QuantUnitRootFetcher,
    },
    metadata={
        "rate_limit": "yfinance only",
        "data_coverage": "any yfinance-available ticker",
    },
) if _quantitative_available else None


# ==================== KIS Provider ====================

kis_provider = Provider(
    name="kis",
    description="한국투자증권(KIS) Open API — 국내주식 실시간 순위",
    website="https://apiportal.koreainvestment.com",
    credentials=["appkey", "appsecret"],
    fetcher_dict={
        "ranking": KISRankingFetcher,
    },
    metadata={
        "rate_limit": "초당 약 20건 (실전)",
        "data_coverage": "KR KOSPI/KOSDAQ 등락률·거래량·거래대금 순위",
    },
) if _kis_available else None


# ==================== Provider Registration ====================

def register_all_providers():
    """모든 Provider 등록"""
    ProviderRegistry.register(fred_provider)
    ProviderRegistry.register(yahoo_provider)
    ProviderRegistry.register(alphavantage_provider)
    ProviderRegistry.register(fmp_provider)
    ProviderRegistry.register(polygon_provider)
    ProviderRegistry.register(tiingo_provider)
    # OpenBB 이식 provider (MACRO/STOCK)
    ProviderRegistry.register(wsj_provider)
    ProviderRegistry.register(bls_provider)
    ProviderRegistry.register(eia_provider)
    ProviderRegistry.register(oecd_provider)
    ProviderRegistry.register(imf_provider)
    ProviderRegistry.register(social_provider)
    if db_provider is not None:
        ProviderRegistry.register(db_provider)
    ProviderRegistry.register(nasdaqtrader_provider)
    ProviderRegistry.register(krx_provider)
    if kis_provider is not None:
        ProviderRegistry.register(kis_provider)
    ProviderRegistry.register(whalewisdom_provider)
    ProviderRegistry.register(sec_provider)
    if quantlib_provider is not None:
        ProviderRegistry.register(quantlib_provider)
    if quantitative_provider is not None:
        ProviderRegistry.register(quantitative_provider)

    log.info(f"Registered {len(ProviderRegistry.list())} providers")


# Auto-register on import
register_all_providers()
# FetcherRegistry는 ProviderRegistry에 위임하므로 별도 등록 불필요

log.info("Data Fetcher initialization complete")
