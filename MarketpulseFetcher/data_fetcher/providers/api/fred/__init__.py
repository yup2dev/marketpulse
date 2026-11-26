"""FRED Provider"""
from data_fetcher.abstract_provider.abstract.provider import Provider
from data_fetcher.providers.api.fred.models.gdp import FREDGDPFetcher
from data_fetcher.providers.api.fred.models.cpi import FREDCPIFetcher
from data_fetcher.providers.api.fred.models.unemployment import FREDUnemploymentFetcher
from data_fetcher.providers.api.fred.models.interest_rate import FREDInterestRateFetcher
from data_fetcher.providers.api.fred.models.employment import FREDEmploymentFetcher
from data_fetcher.providers.api.fred.models.industrial_production import FREDIndustrialProductionFetcher
from data_fetcher.providers.api.fred.models.consumer_sentiment import FREDConsumerSentimentFetcher
from data_fetcher.providers.api.fred.models.housing_starts import FREDHousingStartsFetcher
from data_fetcher.providers.api.fred.models.retail_sales import FREDRetailSalesFetcher
from data_fetcher.providers.api.fred.models.nonfarm_payroll import FREDNonfarmPayrollFetcher
from data_fetcher.providers.api.fred.models.generic_series import FREDGenericSeriesFetcher
from data_fetcher.providers.api.fred.models.fed_balance_sheet import FREDFedBalanceSheetFetcher
from data_fetcher.providers.api.fred.models.real_rates import FREDRealRatesFetcher
from data_fetcher.providers.api.fred.models.pmi import FREDPMIFetcher
from data_fetcher.providers.api.fred.models.yield_curve import FREDYieldCurveFetcher
from data_fetcher.providers.api.fred.models.yield_curve_history import FREDYieldCurveHistoryFetcher
from data_fetcher.providers.api.fred.models.initial_claims import FREDInitialClaimsFetcher


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
        "yield_curve_history":          FREDYieldCurveHistoryFetcher,
        "initial_claims":               FREDInitialClaimsFetcher,
    },
    metadata={
        "rate_limit": "120 requests/minute",
        "data_coverage": "US economic data",
    }
)
