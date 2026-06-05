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

from data_fetcher.providers.sec.insider_trading import SECInsiderTradingFetcher
from data_fetcher.providers.sec.institutional_13f import SEC13FFetcher
from data_fetcher.providers.sec.institutions_list import SECInstitutionsListFetcher

from data_fetcher.providers.fmp.analyst_data import FMPAnalystDataFetcher
from data_fetcher.providers.fmp.revenue_segments import FMPRevenueSegmentsFetcher
from data_fetcher.providers.fmp.index_constituents import FMPIndexConstituentsFetcher

from data_fetcher.providers.social.sentiment import SocialSentimentFetcher

# database provider는 sqlalchemy(WebServer/DB 환경)에서만 사용 가능.
# Fetcher(exe)처럼 sqlalchemy 없는 환경에선 조용히 스킵한다.
try:
    from data_fetcher.providers.database.index_constituents import DBIndexConstituentsFetcher
    from data_fetcher.providers.database.stock_list import DBStockListFetcher
    _db_available = True
except ImportError:
    _db_available = False

from data_fetcher.providers.nasdaqtrader.listing import NasdaqTraderListingFetcher
from data_fetcher.providers.krx.listing import KRXListingFetcher
from data_fetcher.providers.krx.bond import KRXBondFetcher
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
        "insider_trading": SECInsiderTradingFetcher,
        "institutional_13f": SEC13FFetcher,
        "institutions_list": SECInstitutionsListFetcher,
    },
    metadata={
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


# ==================== Provider Registration ====================

def register_all_providers():
    """모든 Provider 등록"""
    ProviderRegistry.register(fred_provider)
    ProviderRegistry.register(yahoo_provider)
    ProviderRegistry.register(alphavantage_provider)
    ProviderRegistry.register(fmp_provider)
    ProviderRegistry.register(polygon_provider)
    ProviderRegistry.register(social_provider)
    if db_provider is not None:
        ProviderRegistry.register(db_provider)
    ProviderRegistry.register(nasdaqtrader_provider)
    ProviderRegistry.register(krx_provider)
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
