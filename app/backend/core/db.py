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
    """Create missing tables and seed initial data. Called once on app startup.

    주의 — create_all 은 **없는 테이블만 만든다.** 기존 테이블의 컬럼 추가·타입 변경은
    절대 반영되지 않는다. 스키마 변경은 alembic 리비전으로 처리할 것:

        alembic revision --autogenerate -m "설명"
        alembic upgrade head

    (기존 DB 는 최초 1회 `alembic stamp head` 로 baseline 을 찍어야 한다)
    """
    # all_models 는 orm/ 바깥 모델(menu, quant_factor 등)까지 import 해 metadata 를
    # 완전하게 만든다. 예전처럼 orm 패키지만 import 하면 라우트 import 순서에 따라
    # 일부 테이블이 생성되지 않는다.
    #
    # 여기서 예외를 삼키지 않는다. 예전에는 log.error 만 찍고 넘어가서, 스키마 초기화가
    # 실패해도 앱이 '정상 기동한 것처럼' 떴다 — 장애를 첫 요청 때 500 으로 발견했다.
    from index_analyzer.models.all_models import Base  # noqa: F401

    Base.metadata.create_all(bind=_db.engine)
    log.info("[DB] Tables initialized")

    # 시드는 실패해도 기동을 막지 않는다 (메뉴가 비어 보일 뿐, 복구 가능하다)
    try:
        from scripts.init_menu_data import init_menu_data
        init_menu_data()
        log.info("[DB] Menu data seeded")
    except Exception as e:
        log.warning(f"[DB] Menu seed skipped: {e}")
