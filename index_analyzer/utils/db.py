"""Database utility functions and session management"""
import uuid
from pathlib import Path
from typing import Optional

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from .logging import get_logger

log = get_logger(__name__)


class Database:
    """Database management class"""

    def __init__(self, database_url: str):
        # SQLite does not support pool_size / max_overflow
        if database_url.startswith("sqlite"):
            self.engine = create_engine(
                database_url,
                echo=False,
                connect_args={"check_same_thread": False},
            )
        else:
            self.engine = create_engine(
                database_url,
                echo=False,
                pool_size=10,
                max_overflow=20,
            )
        self.SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine,
        )

    def create_tables(self):
        """Create all tables defined in the ORM models."""
        from index_analyzer.models.orm import Base  # lazy import to avoid circular deps
        Base.metadata.create_all(bind=self.engine)

    def drop_tables(self):
        """Drop all tables (caution!)."""
        from index_analyzer.models.orm import Base
        Base.metadata.drop_all(bind=self.engine)

    def get_session(self):
        """Return a new SQLAlchemy session."""
        return self.SessionLocal()


def get_sqlite_db(db_path: str = "marketpulse.db") -> Database:
    """Create a SQLite Database instance."""
    return Database(f"sqlite:///{db_path}")


def get_postgresql_db(
    host: str = "localhost",
    port: int = 5432,
    database: str = "marketpulse",
    user: str = "postgres",
    password: str = "password",
) -> Database:
    """Create a PostgreSQL Database instance."""
    url = f"postgresql://{user}:{password}@{host}:{port}/{database}"
    return Database(url)


def generate_id(prefix: str = "") -> str:
    """Generate a short unique ID."""
    return f"{prefix}{uuid.uuid4().hex[:16]}"


def generate_batch_id() -> str:
    """Generate a batch ID in YYYYMMDD-HHMMSS-UUID format."""
    from datetime import datetime
    now = datetime.now()
    timestamp = now.strftime("%Y%m%d-%H%M%S")
    short_uuid = uuid.uuid4().hex[:8]
    return f"{timestamp}-{short_uuid}"


# =============================================================================
# Default DB instance (SQLite)
# =============================================================================
import os

PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "data" / "marketpulse.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

default_db = get_sqlite_db(str(DB_PATH))
engine = default_db.engine
SessionLocal = default_db.SessionLocal
