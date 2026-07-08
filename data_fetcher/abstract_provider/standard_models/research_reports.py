"""Standard Model: Research Reports (리서치 보고서 — 애널리스트/추정치/연간보고서)

PDF 임포트로 적재된 보고서 메타데이터 공통 인터페이스. 현재는 db provider가
유일한 구현이지만, 외부 리서치 API가 붙으면 이 모델을 공유한다.
"""
from datetime import date as date_type
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class ResearchReportsQueryParams(BaseQueryParams):
    """리서치 보고서 목록 조회 표준 파라미터"""

    symbol: Optional[str] = Field(default=None, description="대상 종목 (없으면 전체)")
    report_type: Optional[str] = Field(
        default=None, description="analyst | estimates | annual (없으면 전체)"
    )
    limit: int = Field(default=100, description="최대 보고서 수")


class ResearchReportData(BaseData):
    """리서치 보고서 메타데이터 (본문 텍스트는 excerpt만)"""

    report_id: str = Field(description="보고서 식별자")
    symbol: Optional[str] = Field(default=None, description="대상 종목")
    title: str = Field(description="보고서 제목")
    report_type: str = Field(description="analyst | estimates | annual")
    source: Optional[str] = Field(default=None, description="증권사/작성기관")
    published_date: Optional[date_type] = Field(default=None, description="발행일")
    file_name: Optional[str] = Field(default=None, description="원본 파일명")
    file_size: Optional[int] = Field(default=None, description="파일 크기 (bytes)")
    num_pages: Optional[int] = Field(default=None, description="페이지 수")
    excerpt: Optional[str] = Field(default=None, description="본문 첫 부분 발췌")
    created_at: Optional[str] = Field(default=None, description="적재 시각")
