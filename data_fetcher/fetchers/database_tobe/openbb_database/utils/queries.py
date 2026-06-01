"""SQL query definitions for the database provider."""


class EquityHistoricalQuery:
    """Queries for equity OHLCV historical data."""

    def __init__(self, table: str = "ohlcv") -> None:
        self.table = table

    def select(self) -> str:
        return f"""
            SELECT date, open, high, low, close, volume, vwap
            FROM {self.table}
            WHERE symbol = :symbol
              AND date BETWEEN :start_date AND :end_date
            ORDER BY date ASC
        """

    def select_latest(self) -> str:
        return f"""
            SELECT date, open, high, low, close, volume, vwap
            FROM {self.table}
            WHERE symbol = :symbol
            ORDER BY date DESC
            LIMIT 1
        """