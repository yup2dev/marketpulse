"""Database Equity Historical Price Model."""

from datetime import date as dateType, datetime
from typing import Any

from openbb_core.provider.abstract.fetcher import Fetcher
from openbb_core.provider.standard_models.equity_historical import (
    EquityHistoricalData,
    EquityHistoricalQueryParams,
)
from pydantic import Field


class DatabaseEquityHistoricalQueryParams(EquityHistoricalQueryParams):
    """Database Equity Historical Price Query Params."""

    table: str = Field(
        default="ohlcv",
        description="Source table name in the database.",
    )


class DatabaseEquityHistoricalData(EquityHistoricalData):
    """Database Equity Historical Price Data."""


class DatabaseEquityHistoricalFetcher(
    Fetcher[
        DatabaseEquityHistoricalQueryParams,
        list[DatabaseEquityHistoricalData],
    ]
):
    """Fetch equity OHLCV data from a local database (PostgreSQL or SQLite)."""

    require_credentials = True

    @staticmethod
    def transform_query(params: dict[str, Any]) -> DatabaseEquityHistoricalQueryParams:
        """Validate and transform query parameters."""
        from datetime import date

        if params.get("start_date") is None:
            params["start_date"] = date(2000, 1, 1)
        if params.get("end_date") is None:
            params["end_date"] = date.today()

        return DatabaseEquityHistoricalQueryParams(**params)

    @staticmethod
    def extract_data(
        query: DatabaseEquityHistoricalQueryParams,
        credentials: dict[str, str] | None,
        **kwargs: Any,
    ) -> list[dict]:
        """Execute SQL and return raw rows."""
        from openbb_database.utils.connector import get_engine, run_query
        from openbb_database.utils.queries import EquityHistoricalQuery

        engine = get_engine(credentials)
        q = EquityHistoricalQuery(table=query.table)

        return run_query(
            engine,
            q.select(),
            {
                "symbol": query.symbol,
                "start_date": str(query.start_date),
                "end_date": str(query.end_date),
            },
        )

    @staticmethod
    def transform_data(
        query: DatabaseEquityHistoricalQueryParams,
        data: list[dict],
        **kwargs: Any,
    ) -> list[DatabaseEquityHistoricalData]:
        """Map raw rows to the standard data model."""
        if not data:
            from openbb_core.provider.utils.errors import EmptyDataError
            raise EmptyDataError()

        return [DatabaseEquityHistoricalData.model_validate(row) for row in data]
