from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class YieldCurveQueryParams(BaseQueryParams):
    pass  # 항상 최신 스냅샷 반환


class YieldCurveData(BaseData):
    maturity: str = Field(description="만기 (예: '3-Month', '10-Year')")
    years: float = Field(description="만기 연수 (예: 0.25, 10)")
    value: float = Field(description="수익률 (%)")
