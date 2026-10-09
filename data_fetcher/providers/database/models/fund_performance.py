"""DB Fund Performance Fetcher — 로컬 배치가 적재한 13F 추정 분기 수익률 조회.

MBS_IN_INSTI_PERF 에서 읽는다. 13F 원본 파싱(sec/fund_performance)은 메모리 부담이 커서
서버에서 실행하지 않고, 로컬 배치(Institutional13FCollector)가 산출·적재한 결과만 쓴다.
응답 형태는 sec/fund_performance 와 같다(최신 분기 먼저).
"""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.base_fetchers import DbFetcher
from data_fetcher.abstract_provider.standard_models.fund_performance import (
    FundPerformanceQueryParams,
    FundPerformanceData,
)
from index_analyzer.models.orm import MBS_IN_INSTI_MST, MBS_IN_INSTI_PERF

log = logging.getLogger(__name__)

_FIELDS = tuple(
    c.name for c in MBS_IN_INSTI_PERF.__table__.columns if c.name != "id"
)


class DBFundPerformanceFetcher(DbFetcher[FundPerformanceQueryParams, FundPerformanceData]):
    """DB(MBS_IN_INSTI_PERF)에서 기관 13F 추정 분기 수익률 조회."""

    @classmethod
    def resolve_param_choices(cls) -> Dict[str, Any]:
        """institution_key 선택지 — 수익률이 적재된 기관만."""
        try:
            with cls.db_session() as session:
                keys = session.query(MBS_IN_INSTI_PERF.institution_key).distinct()
                rows = (
                    session.query(MBS_IN_INSTI_MST)
                    .filter(MBS_IN_INSTI_MST.institution_key.in_(keys))
                    .order_by(MBS_IN_INSTI_MST.name)
                    .all()
                )
                opts = [
                    {"value": r.institution_key, "label": r.name or r.manager or r.institution_key}
                    for r in rows
                ]
            return {"institution_key": opts} if opts else {}
        except Exception as e:  # 메타 조회 실패는 무시(폼은 자유입력으로 폴백)
            log.warning(f"fund_performance institution_key 선택지 조회 실패: {e}")
            return {}

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FundPerformanceQueryParams:
        return FundPerformanceQueryParams(**params)

    @classmethod
    def extract_data(
        cls,
        query: FundPerformanceQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        # quarters 개 스냅샷의 분기쌍 비교 → 행은 quarters-1 개 (sec fetcher와 동일한 의미)
        n_rows = max(1, int(query.quarters or 8) - 1)
        with cls.db_session(**kwargs) as session:
            rows = (
                session.query(MBS_IN_INSTI_PERF)
                .filter(MBS_IN_INSTI_PERF.institution_key == query.institution_key)
                .order_by(MBS_IN_INSTI_PERF.period.desc())
                .limit(n_rows)
                .all()
            )
            return [{f: getattr(r, f) for f in _FIELDS} for r in rows]

    @staticmethod
    def transform_data(
        query: FundPerformanceQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[FundPerformanceData]:
        # 적재된 cumulative_return_pct 는 배치 산출 구간 기준 — 조회 구간으로 다시 누적한다.
        cumulative = 1.0
        for row in reversed(data or []):  # 오래된 분기 → 최신 분기
            if row.get("return_pct") is None:
                row["cumulative_return_pct"] = None
                continue
            cumulative *= 1 + row["return_pct"] / 100
            row["cumulative_return_pct"] = round((cumulative - 1) * 100, 2)
        return [FundPerformanceData.model_validate(r) for r in (data or [])]
