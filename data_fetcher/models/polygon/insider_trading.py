"""Polygon.io Insider Trading Model"""
from datetime import date as date_type
from typing import Optional
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class InsiderTradingQueryParams(BaseQueryParams):
    """내부자 거래 조회 파라미터"""

    ticker: str = Field(
        description="종목 티커 (예: AAPL, TSLA)"
    )
    transaction_date_gte: Optional[str] = Field(
        default=None,
        description="거래일 >= (YYYY-MM-DD)"
    )
    transaction_date_lte: Optional[str] = Field(
        default=None,
        description="거래일 <= (YYYY-MM-DD)"
    )
    limit: Optional[int] = Field(
        default=100,
        description="최대 결과 수"
    )


class InsiderTradingData(BaseData):
    """내부자 거래 데이터"""

    ticker: str = Field(
        description="종목 티커"
    )

    # === 거래 정보 ===
    transaction_date: date_type = Field(
        description="거래 날짜"
    )
    filing_date: Optional[date_type] = Field(
        default=None,
        description="SEC 신고 날짜"
    )

    # === 내부자 정보 ===
    insider_name: str = Field(
        description="내부자 이름"
    )
    insider_title: Optional[str] = Field(
        default=None,
        description="직책/직위"
    )
    is_director: Optional[bool] = Field(
        default=None,
        description="이사 여부"
    )
    is_officer: Optional[bool] = Field(
        default=None,
        description="임원 여부"
    )
    is_ten_percent_owner: Optional[bool] = Field(
        default=None,
        description="10% 이상 주주 여부"
    )

    # === 거래 유형 ===
    transaction_type: str = Field(
        description="거래 유형 (P=매수, S=매도, A=수령, D=처분 등)"
    )
    transaction_code: Optional[str] = Field(
        default=None,
        description="거래 코드"
    )
    acquisition_or_disposition: Optional[str] = Field(
        default=None,
        description="취득/처분 구분 (A/D)"
    )

    # === 거래량 및 가격 ===
    shares_traded: Optional[float] = Field(
        default=None,
        description="거래 주식 수"
    )
    price_per_share: Optional[float] = Field(
        default=None,
        description="주당 가격"
    )
    transaction_value: Optional[float] = Field(
        default=None,
        description="거래 금액 (= shares * price)"
    )

    # === 보유 현황 ===
    shares_owned_before: Optional[float] = Field(
        default=None,
        description="거래 전 보유 주식 수"
    )
    shares_owned_after: Optional[float] = Field(
        default=None,
        description="거래 후 보유 주식 수"
    )

    # === 소유권 형태 ===
    ownership_type: Optional[str] = Field(
        default=None,
        description="소유권 유형 (D=직접, I=간접)"
    )

    # === 문서 정보 ===
    sec_form_type: Optional[str] = Field(
        default=None,
        description="SEC 양식 유형 (Form 4, Form 3 등)"
    )
    sec_link: Optional[str] = Field(
        default=None,
        description="SEC 문서 링크"
    )
