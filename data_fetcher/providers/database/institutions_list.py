"""DB Institutions List Fetcher — index_analyzer 배치가 적재한 13F 기관 목록 조회.

MBS_IN_INSTI_MST 에서 읽는다(온디맨드 스크래핑 없음). 배치 미적재 시 빈 목록 →
백엔드가 whalewisdom 온디맨드로 폴백.
"""
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.abstract_provider.standard_models.institutions_list import (
    InstitutionsListQueryParams,
    InstitutionInfo,
)
from index_analyzer.models.orm import MBS_IN_INSTI_MST, get_sqlite_db

log = logging.getLogger(__name__)

_DB_PATH = Path(__file__).parent.parent.parent.parent / "data" / "marketpulse.db"


class DBInstitutionsListQueryParams(InstitutionsListQueryParams):
    """기관 목록 조회 파라미터 (standard 경유). use_dynamic은 DB에선 무시."""
    use_dynamic: bool = True


class DBInstitutionsListFetcher(Fetcher[DBInstitutionsListQueryParams, InstitutionInfo]):
    """DB(MBS_IN_INSTI_MST)에서 13F 기관 목록 조회."""

    require_credentials = False

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> DBInstitutionsListQueryParams:
        return DBInstitutionsListQueryParams(**params)

    @staticmethod
    def extract_data(
        query: DBInstitutionsListQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        db_path = kwargs.get("db_path", _DB_PATH)
        db = get_sqlite_db(str(db_path))
        session = db.get_session()
        try:
            q = (
                session.query(MBS_IN_INSTI_MST)
                .filter(MBS_IN_INSTI_MST.is_active.is_(True))
                .order_by(MBS_IN_INSTI_MST.name)
            )
            if query.limit:
                q = q.limit(query.limit)
            return [
                {
                    "key": r.institution_key,
                    "name": r.name,
                    "manager": r.manager,
                    "cik": r.cik,
                    "description": r.description,
                }
                for r in q.all()
            ]
        finally:
            session.close()

    @staticmethod
    def transform_data(
        query: DBInstitutionsListQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[InstitutionInfo]:
        return [InstitutionInfo.model_validate(d) for d in (data or [])]
