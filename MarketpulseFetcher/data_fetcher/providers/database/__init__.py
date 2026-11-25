"""Database Provider"""
from data_fetcher.abstract_provider.abstract.provider import Provider
from data_fetcher.providers.database.models.index_constituents import DBIndexConstituentsFetcher
from data_fetcher.providers.database.models.stock_list import DBStockListFetcher
from data_fetcher.providers.database.models.stock_ranking import DBStockRankingFetcher
from data_fetcher.providers.database.models.research_reports import DBResearchReportsFetcher
from data_fetcher.providers.database.models.fund_performance import DBFundPerformanceFetcher
from data_fetcher.providers.database.models.fx_rate import DBFxRateFetcher
from data_fetcher.providers.database.models.institutional_holdings import DBInstitutionalHoldingsFetcher
from data_fetcher.providers.database.models.institutions_list import DBInstitutionsListFetcher
from data_fetcher.providers.database.models.institutions_summary import DBInstitutionsSummaryFetcher


db_provider = Provider(
    name="db",
    description="Local SQLite Database",
    credentials=[],
    fetcher_dict={
        "index_constituents": DBIndexConstituentsFetcher,
        "stock_list": DBStockListFetcher,
        "stock_ranking": DBStockRankingFetcher,
        "institutions_list": DBInstitutionsListFetcher,
        "institutional_holdings": DBInstitutionalHoldingsFetcher,
        "institutions_summary": DBInstitutionsSummaryFetcher,
        "fund_performance": DBFundPerformanceFetcher,
        "research_reports": DBResearchReportsFetcher,
        "fx_rate": DBFxRateFetcher,
    },
)
