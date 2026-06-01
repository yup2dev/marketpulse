"""Database connection utilities."""

from sqlalchemy import Engine, create_engine, text

_engines: dict[str, Engine] = {}


def get_engine(credentials: dict | None) -> Engine:
    """Return a cached SQLAlchemy engine from database_url credential."""
    if not credentials:
        raise ValueError("No credentials provided. Set 'database_url' in credentials.")

    url = credentials.get("database_url")
    if not url:
        raise ValueError("'database_url' credential is required.")

    if url not in _engines:
        _engines[url] = create_engine(url)

    return _engines[url]


def run_query(engine: Engine, sql: str, params: dict) -> list[dict]:
    """Execute a parameterized query and return rows as dicts."""
    with engine.connect() as conn:
        result = conn.execute(text(sql), params)
        return [dict(row._mapping) for row in result]