"""Database session factory and startup initialization — SQLite via SQLAlchemy."""
import logging
from pathlib import Path
from typing import Generator

from sqlalchemy.orm import Session
from index_analyzer.utils.db import get_sqlite_db

log = logging.getLogger(__name__)

_DB_PATH = Path(__file__).parent.parent.parent.parent / "data" / "marketpulse.db"
_db = get_sqlite_db(str(_DB_PATH))


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: yields a scoped DB session."""
    session = _db.get_session()
    try:
        yield session
    finally:
        session.close()


def get_db_sync() -> Session:
    """Synchronous session for non-FastAPI use (caller is responsible for closing)."""
    return _db.get_session()


def init_db() -> None:
    """Create all tables and seed initial data. Called once on app startup."""
    try:
        import index_analyzer.models.orm  # noqa: F401 — registers all ORM models
        from index_analyzer.models.orm import Base
        Base.metadata.create_all(bind=_db.engine)
        log.info("[DB] Tables initialized")

        try:
            from scripts.init_menu_data import init_menu_data
            init_menu_data()
            log.info("[DB] Menu data seeded")
        except Exception as e:
            log.warning(f"[DB] Menu seed skipped: {e}")

    except Exception as e:
        log.error(f"[DB] Initialization failed: {e}")
