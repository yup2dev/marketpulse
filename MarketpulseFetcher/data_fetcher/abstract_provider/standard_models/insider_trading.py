"""Standard Model: Insider Trading (내부자 거래)"""
from datetime import date as date_type
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class InsiderTradingQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드")
    limit: Optional[int] = Field(default=50, description="최대 결과 수")
    start_date: Optional[str] = Field(default=None, description="시작일 (YYYY-MM-DD)")
    end_date: Optional[str] = Field(default=None, description="종료일 (YYYY-MM-DD)")


class InsiderTradingData(BaseData):
    symbol: Optional[str] = Field(default=None, description="종목 코드")
    filing_date: Optional[date_type] = Field(default=None, description="공시일")
    transaction_date: Optional[date_type] = Field(default=None, description="거래일")
    insider_name: Optional[str] = Field(default=None, description="내부자 이름")
    insider_title: Optional[str] = Field(default=None, description="직책")
    transaction_type: Optional[str] = Field(default=None, description="거래 유형 (매수/매도/증여 등)")
    transaction_code: Optional[str] = Field(default=None, description="SEC 거래 코드")
    shares_traded: Optional[float] = Field(default=None, description="거래 주식 수")
    price_per_share: Optional[float] = Field(default=None, description="주당 가격")
    transaction_value: Optional[float] = Field(default=None, description="거래 총액")
    shares_owned_after: Optional[float] = Field(default=None, description="거래 후 보유 주식 수")
    ownership_type: Optional[str] = Field(default=None, description="소유 형태 (직접/간접)")
    is_director: Optional[bool] = Field(default=None, description="이사 여부")
    is_officer: Optional[bool] = Field(default=None, description="임원 여부")
    is_ten_percent_owner: Optional[bool] = Field(default=None, description="10% 이상 대주주 여부")
    sec_link: Optional[str] = Field(default=None, description="SEC 공시 링크")
