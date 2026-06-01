"""Database provider for OpenBB."""

from openbb_core.provider.abstract.provider import Provider

from openbb_database.models.equity_historical import DatabaseEquityHistoricalFetcher

database_provider = Provider(
    name="database",
    website="",
    description="Local database provider supporting PostgreSQL and SQLite.",
    credentials=["database_url"],
    fetcher_dict={
        "EquityHistorical": DatabaseEquityHistoricalFetcher,
    },
    repr_name="Database",
)