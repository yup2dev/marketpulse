"""FRED Provider"""
from data_fetcher.abstract_provider.abstract.provider import Provider
from data_fetcher.providers.fred.models.gdp import FREDGDPFetcher
from data_fetcher.providers.fred.models.cpi import FREDCPIFetcher
from data_fetcher.providers.fred.models.unemployment import FREDUnemploymentFetcher
from data_fetcher.providers.fred.models.interest_rate import FREDInterestRateFetcher
from data_fetcher.providers.fred.models.employment import FREDEmploymentFetcher
from data_fetcher.providers.fred.models.industrial_production import FREDIndustrialProductionFetcher
from data_fetcher.providers.fred.models.consumer_sentiment import FREDConsumerSentimentFetcher
from data_fetcher.providers.fred.models.housing_starts import FREDHousingStartsFetcher
from data_fetcher.providers.fred.models.retail_sales import FREDRetailSalesFetcher
from data_fetcher.providers.fred.models.nonfarm_payroll import FREDNonfarmPayrollFetcher
from data_fetcher.providers.fred.models.generic_series import FREDGenericSeriesFetcher
from data_fetcher.providers.fred.models.fed_balance_sheet import FREDFedBalanceSheetFetcher
from data_fetcher.providers.fred.models.real_rates import FREDRealRatesFetcher
from data_fetcher.providers.fred.models.pmi import FREDPMIFetcher
from data_fetcher.providers.fred.models.yield_curve import FREDYieldCurveFetcher
from data_fetcher.providers.fred.models.inflation_momentum import FREDInflationMomentumFetcher
from data_fetcher.providers.fred.models.yield_curve_history import FREDYieldCurveHistoryFetcher
from data_fetcher.providers.fred.models.initial_claims import FREDInitialClaimsFetcher
from data_fetcher.providers.fred.models.jobs_breakdown import FREDJobsBreakdownFetcher
from data_fetcher.providers.fred.models.financial_conditions_history import FREDFinancialConditionsHistoryFetcher
from data_fetcher.providers.fred.models.sentiment_history import FREDSentimentHistoryFetcher
from data_fetcher.providers.fred.models.inflation_sector import FREDInflationSectorFetcher
from data_fetcher.providers.fred.models.regime_history import FREDRegimeHistoryFetcher
from data_fetcher.providers.fred.models.phillips_curve import FREDPhillipsCurveFetcher
from data_fetcher.providers.fred.models.financial_conditions import FREDFinancialConditionsFetcher
from data_fetcher.providers.fred.models.sentiment_composite import FREDSentimentCompositeFetcher
from data_fetcher.providers.fred.models.labor_dashboard import FREDLaborDashboardFetcher
from data_fetcher.providers.fred.models.fed_policy_stance import FREDFedPolicyStanceFetcher
from data_fetcher.providers.fred.models.inflation_decomposition import FREDInflationDecompositionFetcher
from data_fetcher.providers.fred.models.regime_current import FREDRegimeCurrentFetcher
from data_fetcher.providers.fred.models.indicators import (
    FREDIndicatorHistoryFetcher, FREDIndicatorOverviewFetcher,
    FREDMacroSeriesHistoryFetcher, FREDMacroSeriesOverviewFetcher,
)


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
        "regime_current":               FREDRegimeCurrentFetcher,
        "fed_policy_stance":            FREDFedPolicyStanceFetcher,
        "inflation_decomposition":      FREDInflationDecompositionFetcher,
        "phillips_curve":               FREDPhillipsCurveFetcher,
        "financial_conditions":         FREDFinancialConditionsFetcher,
        "sentiment_composite":          FREDSentimentCompositeFetcher,
        "labor_dashboard":              FREDLaborDashboardFetcher,
        "indicator_overview":           FREDIndicatorOverviewFetcher,
        "indicator_history":            FREDIndicatorHistoryFetcher,
        "macro_series_overview":        FREDMacroSeriesOverviewFetcher,
        "macro_series_history":         FREDMacroSeriesHistoryFetcher,
    },
    metadata={
        "rate_limit": "120 requests/minute",
        "data_coverage": "US economic data",
    }
)
