"""Database Provider"""
from data_fetcher.abstract_provider.abstract.provider import Provider
from data_fetcher.providers.database.models.index_constituents import DBIndexConstituentsFetcher
from data_fetcher.providers.database.models.stock_list import DBStockListFetcher
from data_fetcher.providers.database.models.stock_ranking import DBStockRankingFetcher
from data_fetcher.providers.database.models.research_reports import DBResearchReportsFetcher
from data_fetcher.providers.database.models.fund_performance import DBFundPerformanceFetcher
from data_fetcher.providers.database.models.fx_rate import DBFxRateFetcher
from data_fetcher.providers.database.models.quote import DBEquityQuoteFetcher
from data_fetcher.providers.database.models.company_profile import DBCompanyProfileFetcher
from data_fetcher.providers.database.models.company_relations import DBCompanyRelationsFetcher
from data_fetcher.providers.database.models.sector_performance import DBSectorPerformanceFetcher
from data_fetcher.providers.database.models.news_events import DBNewsEventsFetcher
from data_fetcher.providers.database.models.quant_snapshot import DBQuantSnapshotFetcher
from data_fetcher.providers.database.models.equity_screener import DBEquityScreenerFetcher
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
        "quote": DBEquityQuoteFetcher,
        "company_profile": DBCompanyProfileFetcher,
        "company_relations": DBCompanyRelationsFetcher,
        "sector_performance": DBSectorPerformanceFetcher,
        "news_events": DBNewsEventsFetcher,
        "quant_snapshot": DBQuantSnapshotFetcher,
        "equity_screener": DBEquityScreenerFetcher,
    },
)
