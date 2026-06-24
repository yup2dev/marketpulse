"""DB Institutional Holdings Fetcher — 배치 적재한 13F 포트폴리오를 DB에서 조회.

MBS_IN_INSTI_PORT(요약) + MBS_IN_INSTI_HOLD(보유종목)에서 읽어 whalewisdom과 동일한
객체 형태로 복원한다(portfolio_service 직렬화 무수정). 미적재 기관이면 빈 리스트 →
백엔드가 whalewisdom 온디맨드로 폴백.
"""
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.abstract_provider.standard_models.institutional_holdings import (
    InstitutionalHoldingsQueryParams,
    HoldingData,
    InstitutionalHoldingsData,
)
from index_analyzer.models.orm import MBS_IN_INSTI_PORT, MBS_IN_INSTI_HOLD, get_sqlite_db

log = logging.getLogger(__name__)

_DB_PATH = Path(__file__).parent.parent.parent.parent / "data" / "marketpulse.db"

_PORT_FIELDS = (
    "id", "institution_key", "manager", "name", "description",
    "total_value", "num_holdings", "filing_date", "period_end", "category",
    "previous_filing_date", "previous_value", "value_change", "value_change_pct",
    "num_new_positions", "num_sold_out", "num_increased", "num_decreased",
    "turnover", "performance", "top_sectors",
)

_HOLD_FIELDS = (
    "symbol", "name", "cusip", "value", "shares", "weight",
    "prev_shares", "prev_value", "share_change", "share_change_pct",
    "value_change", "value_change_pct", "status",
)


class DBInstitutionalHoldingsFetcher(
    Fetcher[InstitutionalHoldingsQueryParams, InstitutionalHoldingsData]
):
    """DB(PORT+HOLD)에서 기관 13F 포트폴리오 조회."""

    require_credentials = False

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> InstitutionalHoldingsQueryParams:
        return InstitutionalHoldingsQueryParams(**params)

    @staticmethod
    def extract_data(
        query: InstitutionalHoldingsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        db_path = kwargs.get("db_path", _DB_PATH)
        db = get_sqlite_db(str(db_path))
        session = db.get_session()
        try:
            port = session.get(MBS_IN_INSTI_PORT, query.institution_key)
            if port is None:
                return {}  # 미적재 → 폴백
            summary = {f: getattr(port, f, None) for f in _PORT_FIELDS}

            rows = (
                session.query(MBS_IN_INSTI_HOLD)
                .filter(MBS_IN_INSTI_HOLD.institution_key == query.institution_key)
                .order_by(MBS_IN_INSTI_HOLD.is_sold, MBS_IN_INSTI_HOLD.seq)
                .all()
            )
            stocks, sold = [], []
            for r in rows:
                h = {f: getattr(r, f, None) for f in _HOLD_FIELDS}
                (sold if r.is_sold else stocks).append(h)
            if query.summary_only:
                stocks, sold = [], []
            summary["stocks"] = stocks
            summary["sold_positions"] = sold
            return summary
        finally:
            session.close()

    @staticmethod
    def transform_data(
        query: InstitutionalHoldingsQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> List[InstitutionalHoldingsData]:
        if not data:
            return []  # 폴백 트리거
        stocks = [HoldingData.model_validate(h) for h in data.pop("stocks", [])]
        sold = [HoldingData.model_validate(h) for h in data.pop("sold_positions", [])]
        # whalewisdom과 동일하게 stocks/sold_positions + 요약필드를 extra로 부착
        obj = InstitutionalHoldingsData.model_validate(data)
        obj.stocks = stocks
        obj.sold_positions = sold
        return [obj]
