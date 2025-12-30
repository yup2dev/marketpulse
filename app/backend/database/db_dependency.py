"""
Database Dependency for FastAPI
FastAPI 라우트에서 사용할 공통 DB 세션 의존성
"""
import sys
from pathlib import Path
from typing import Generator

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from sqlalchemy.orm import Session
from index_analyzer.models.database import get_sqlite_db

# Database path
DB_PATH = Path(__file__).parent.parent.parent.parent / "data" / "marketpulse.db"

# Create database instance
db_instance = get_sqlite_db(str(DB_PATH))


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency for database session

    Usage:
        @router.get("/example")
        async def example(db: Session = Depends(get_db)):
            result = db.query(Model).all()
            return result
    """
    session = db_instance.get_session()
    try:
        yield session
    finally:
        session.close()


def get_db_sync() -> Session:
    """
    Synchronous database session (for non-FastAPI use)

    Usage:
        with get_db_sync() as session:
            result = session.query(Model).all()

    Or:
        session = get_db_sync()
        try:
            result = session.query(Model).all()
        finally:
            session.close()
    """
    return db_instance.get_session()