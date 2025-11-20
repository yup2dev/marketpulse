"""FMP (Financial Modeling Prep) Fetchers"""

from data_fetcher.fetchers.fmp.quote import FMPQuoteFetcher
from data_fetcher.fetchers.fmp.company_profile import FMPCompanyProfileFetcher
from data_fetcher.fetchers.fmp.income_statement import FMPIncomeStatementFetcher
from data_fetcher.fetchers.fmp.analyst_estimates import FMPAnalystEstimatesFetcher
from data_fetcher.fetchers.fmp.analyst_recommendations import FMPAnalystRecommendationsFetcher

__all__ = [
    "FMPQuoteFetcher",
    "FMPCompanyProfileFetcher",
    "FMPIncomeStatementFetcher",
    "FMPAnalystEstimatesFetcher",
    "FMPAnalystRecommendationsFetcher",
]