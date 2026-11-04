"""Standard Model: Institutions List (13F 제출 기관 목록)

13F를 제출하는 기관의 기본 정보 목록 공통 인터페이스. sec/whalewisdom 등 여러
provider가 이 클래스를 상속/공유한다(멀티프로바이더).
"""
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class InstitutionsListQueryParams(BaseQueryParams):
    """기관 목록 조회 표준 파라미터"""

    limit: int = Field(default=100, description="최대 기관 수")


class InstitutionInfo(BaseData):
    """기관 기본 정보"""

    key: Optional[str] = Field(default=None, description="기관 식별자")
    name: Optional[str] = Field(default=None, description="기관명")
    manager: Optional[str] = Field(default=None, description="운용 책임자")
    cik: Optional[str] = Field(default=None, description="SEC CIK")
