"""FMP (Financial Modeling Prep) Provider"""
from data_fetcher.abstract_provider.abstract.provider import Provider
from data_fetcher.providers.fmp.models.equity_quote import QuoteQueryParams, QuoteData, FMPQuoteFetcher
from data_fetcher.providers.fmp.models.company_profile import FMPCompanyProfileQueryParams, FMPCompanyProfileData, FMPCompanyProfileFetcher
from data_fetcher.providers.fmp.models.income_statement import FMPIncomeStatementQueryParams, FMPIncomeStatementData, FMPIncomeStatementFetcher
from data_fetcher.providers.fmp.models.analyst_estimates import FMPAnalystEstimatesQueryParams, FMPAnalystEstimatesData, FMPAnalystEstimatesFetcher
from data_fetcher.providers.fmp.models.analyst_recommendations import AnalystRecommendationsQueryParams, AnalystRecommendationsData, FMPAnalystRecommendationsFetcher
from data_fetcher.providers.fmp.models.analyst_data import FMPAnalystDataQueryParams, FMPAnalystDataData, FMPAnalystDataFetcher
from data_fetcher.providers.fmp.models.revenue_segments import FMPRevenueSegmentsQueryParams, FMPRevenueSegmentsData, FMPRevenueSegmentsFetcher
from data_fetcher.providers.fmp.models.search import FMPSearchQueryParams, FMPSearchData, FMPSearchFetcher
from data_fetcher.providers.fmp.models.gainers import FMPMoversQueryParams, FMPActiveStockData, FMPGainersFetcher, FMPLosersFetcher, FMPMostActivesFetcher
from data_fetcher.providers.fmp.models.index_constituents import IndexQueryParams, ConstituentResult, FMPIndexConstituentsFetcher
from data_fetcher.providers.bond.models.bond_prices import FMPBondPricesFetcher
from data_fetcher.providers.fmp.models.financials import FMPFinancialsFetcher


fmp_provider = Provider(
    name="fmp",
    description="Financial Modeling Prep API",
    website="https://financialmodelingprep.com",
    credentials=["api_key"],
    fetcher_dict={
        "quote": FMPQuoteFetcher,
        "company_profile": FMPCompanyProfileFetcher,
        "income_statement": FMPIncomeStatementFetcher,
        "financials": FMPFinancialsFetcher,
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
