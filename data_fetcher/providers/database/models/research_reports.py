"""DB Research Reports Fetcher — PDF 임포트로 적재된 리서치 보고서 조회.

MBS_IN_RESEARCH_RPT 에서 읽는다. 적재는 백엔드 업로드 라우트(/api/reports/upload)가
수행하고, 이 fetcher는 조회 전용이다. 위젯은 /api/data/db/research_reports 게이트웨이로
이 fetcher를 호출한다.
"""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.base_fetchers import DbFetcher
from data_fetcher.abstract_provider.standard_models.research_reports import (
    ResearchReportsQueryParams,
    ResearchReportData,
)
from index_analyzer.models.orm import MBS_IN_RESEARCH_RPT

log = logging.getLogger(__name__)

_EXCERPT_LEN = 500


class DBResearchReportsFetcher(DbFetcher[ResearchReportsQueryParams, ResearchReportData]):
    """DB(MBS_IN_RESEARCH_RPT)에서 리서치 보고서 목록 조회."""

    # 위젯 폼 드롭다운용 선택지 (data.py list_providers가 param_choices로 노출)
    param_choices = {"report_type": ["analyst", "estimates", "annual"]}

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> ResearchReportsQueryParams:
        return ResearchReportsQueryParams(**params)

    @classmethod
    def extract_data(
        cls,
        query: ResearchReportsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        with cls.db_session(**kwargs) as session:
            q = session.query(MBS_IN_RESEARCH_RPT)
            if query.symbol:
                q = q.filter(MBS_IN_RESEARCH_RPT.symbol == query.symbol.upper())
            if query.report_type:
                q = q.filter(MBS_IN_RESEARCH_RPT.report_type == query.report_type)
            q = q.order_by(
                MBS_IN_RESEARCH_RPT.published_date.desc().nullslast(),
                MBS_IN_RESEARCH_RPT.created_at.desc(),
            )
            if query.limit:
                q = q.limit(query.limit)
            return [
                {
                    **r.to_dict(),
                    "excerpt": (r.content_text or "")[:_EXCERPT_LEN] or None,
                }
                for r in q.all()
            ]

    @staticmethod
    def transform_data(
        query: ResearchReportsQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[ResearchReportData]:
        return [ResearchReportData.model_validate(d) for d in (data or [])]
