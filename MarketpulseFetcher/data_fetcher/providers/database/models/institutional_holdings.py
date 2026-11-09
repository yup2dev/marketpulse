"""DB Institutional Holdings Fetcher — 배치 적재한 13F 포트폴리오를 DB에서 조회.

MBS_IN_INSTI_PORT(요약) + MBS_IN_INSTI_HOLD(보유종목)에서 읽어 whalewisdom과 동일한
객체 형태로 복원한다(portfolio_service 직렬화 무수정). 미적재 기관이면 빈 리스트
(서버 온디맨드 폴백 없음 — 13F 파싱은 로컬 배치에서만).

period(보고 분기말)를 주면 분기 이력(MBS_IN_INSTI_PORT_HIST/HOLD_HIST)에서 읽는다.
응답에는 항상 available_periods(적재된 분기, 최신순)를 실어 위젯이 분기 선택지를 만든다.
"""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.base_fetchers import DbFetcher
from data_fetcher.abstract_provider.standard_models.institutional_holdings import (
    InstitutionalHoldingsQueryParams,
    HoldingData,
    InstitutionalHoldingsData,
)
from data_fetcher.providers.database.schema import (
    MBS_IN_INSTI_MST, MBS_IN_INSTI_PORT, MBS_IN_INSTI_HOLD,
    MBS_IN_INSTI_PORT_HIST, MBS_IN_INSTI_HOLD_HIST,
)

log = logging.getLogger(__name__)

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
    DbFetcher[InstitutionalHoldingsQueryParams, InstitutionalHoldingsData]
):
    """DB(PORT+HOLD)에서 기관 13F 포트폴리오 조회."""

    @classmethod
    def resolve_param_choices(cls) -> Dict[str, Any]:
        """institution_key 선택지를 MBS_IN_INSTI_MST(13F 기관 마스터)에서 동적 조회.
        /api/data/ 메타로 노출되어 프론트에서 기관 이름 드롭다운이 된다."""
        try:
            with cls.db_session() as session:
                rows = (
                    session.query(MBS_IN_INSTI_MST)
                    .filter(MBS_IN_INSTI_MST.is_active.is_(True))
                    .order_by(MBS_IN_INSTI_MST.name)
                    .all()
                )
                opts = [
                    {"value": r.institution_key, "label": r.name or r.manager or r.institution_key}
                    for r in rows
                ]
            return {"institution_key": opts} if opts else {}
        except Exception as e:  # 메타 조회 실패는 무시(폼은 자유입력으로 폴백)
            log.warning(f"institution_key 선택지 조회 실패: {e}")
            return {}

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> InstitutionalHoldingsQueryParams:
        return InstitutionalHoldingsQueryParams(**params)

    @classmethod
    def extract_data(
        cls,
        query: InstitutionalHoldingsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        key = query.institution_key
        with cls.db_session(**kwargs) as session:
            periods = [
                r[0] for r in session.query(MBS_IN_INSTI_PORT_HIST.period)
                .filter(MBS_IN_INSTI_PORT_HIST.institution_key == key)
                .order_by(MBS_IN_INSTI_PORT_HIST.period.desc())
                .all()
            ]
            if query.period:
                port = session.get(MBS_IN_INSTI_PORT_HIST, (key, query.period))
                hold, filt = MBS_IN_INSTI_HOLD_HIST, [MBS_IN_INSTI_HOLD_HIST.period == query.period]
            else:
                port = session.get(MBS_IN_INSTI_PORT, key)
                hold, filt = MBS_IN_INSTI_HOLD, []
            if port is None:
                return {}  # 미적재 (기관 또는 그 분기)
            summary = {f: getattr(port, f, None) for f in _PORT_FIELDS}
            if query.period:
                summary["period_end"] = query.period
            summary["available_periods"] = periods

            if query.summary_only:
                # 요약만 — 보유종목(기관당 수천 행)은 읽지 않는다
                summary["stocks"], summary["sold_positions"] = [], []
                return summary

            rows = (
                session.query(hold)
                .filter(hold.institution_key == key, *filt)
                .order_by(hold.is_sold, hold.seq)
                .all()
            )
            stocks, sold = [], []
            for r in rows:
                h = {f: getattr(r, f, None) for f in _HOLD_FIELDS}
                (sold if r.is_sold else stocks).append(h)
            summary["stocks"] = stocks
            summary["sold_positions"] = sold
            return summary

    @staticmethod
    def transform_data(
        query: InstitutionalHoldingsQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> List[InstitutionalHoldingsData]:
        if not data:
            return []  # 미적재
        stocks = [HoldingData.model_validate(h) for h in data.pop("stocks", [])]
        sold = [HoldingData.model_validate(h) for h in data.pop("sold_positions", [])]
        # whalewisdom과 동일하게 stocks/sold_positions + 요약필드를 extra로 부착
        obj = InstitutionalHoldingsData.model_validate(data)
        obj.stocks = stocks
        obj.sold_positions = sold
        return [obj]
