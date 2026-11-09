"""DB Institutions Summary Fetcher — 전 기관 13F 요약을 한 번에 조회.

Institutional Portfolios 위젯 첫 화면(Overview)용. 요약값(총액·종목 수·QoQ 등)은 로컬 배치
(Institutional13FCollector)가 계산해 MBS_IN_INSTI_PORT 에 기관당 1행으로 적재하고,
매일 sync_db_to_cloud(/api/ingest)로 서버에 반영된다. 여기서는 그 행만 읽는다 —
보유종목(MBS_IN_INSTI_HOLD, 기관당 수천 행)은 읽지 않는다. 기관별 상세는
institutional_holdings 가 펼칠 때 따로 조회한다.

period(보고 분기말)를 주면 분기 이력(MBS_IN_INSTI_PORT_HIST)에서 읽는다. 각 행에는
그 기관의 available_periods(적재된 분기, 최신순)를 실어 위젯이 분기 선택지를 만든다.
목록은 institutions_list(loaded_only)와 같은 기준 — 활성 기관만.
"""
from collections import defaultdict
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.base_fetchers import DbFetcher
from data_fetcher.abstract_provider.standard_models.institutional_holdings import (
    InstitutionsSummaryQueryParams,
    InstitutionalHoldingsData,
)
from data_fetcher.providers.database.models.institutional_holdings import _PORT_FIELDS
from data_fetcher.providers.database.schema import (
    MBS_IN_INSTI_MST, MBS_IN_INSTI_PORT, MBS_IN_INSTI_PORT_HIST,
)


class DBInstitutionsSummaryFetcher(
    DbFetcher[InstitutionsSummaryQueryParams, InstitutionalHoldingsData]
):
    """DB(PORT / PORT_HIST)에서 전 기관 13F 요약 일괄 조회 — 보유종목 행 없음."""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> InstitutionsSummaryQueryParams:
        return InstitutionsSummaryQueryParams(**params)

    @classmethod
    def extract_data(
        cls,
        query: InstitutionsSummaryQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        with cls.db_session(**kwargs) as session:
            periods: Dict[str, List[str]] = defaultdict(list)
            for key, period in (
                session.query(MBS_IN_INSTI_PORT_HIST.institution_key, MBS_IN_INSTI_PORT_HIST.period)
                .order_by(MBS_IN_INSTI_PORT_HIST.period.desc())
            ):
                periods[key].append(period)

            port = MBS_IN_INSTI_PORT_HIST if query.period else MBS_IN_INSTI_PORT
            q = (
                session.query(port)
                .join(MBS_IN_INSTI_MST, MBS_IN_INSTI_MST.institution_key == port.institution_key)
                .filter(MBS_IN_INSTI_MST.is_active.is_(True))
            )
            if query.period:
                q = q.filter(MBS_IN_INSTI_PORT_HIST.period == query.period)

            out = []
            for row in q.all():
                summary = {f: getattr(row, f, None) for f in _PORT_FIELDS}
                if query.period:
                    summary["period_end"] = query.period
                summary["available_periods"] = periods.get(row.institution_key, [])
                out.append(summary)
            return out

    @staticmethod
    def transform_data(
        query: InstitutionsSummaryQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[InstitutionalHoldingsData]:
        result = []
        for d in data or []:
            obj = InstitutionalHoldingsData.model_validate(d)
            obj.stocks = []
            obj.sold_positions = []
            result.append(obj)
        return result
