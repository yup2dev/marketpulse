"""Standard Model: Bond Prices (증권 단위 채권 가격/수익률)

ISIN/LEI 등으로 식별되는 개별 채권의 가격·쿠폰·수익률·듀레이션 등 상세 데이터.
provider는 이 클래스를 상속해 전용 필드를 추가한다.
"""
from datetime import date as date_type
from typing import List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class BondPricesQueryParams(BaseQueryParams):
    """채권 가격 조회 표준 파라미터"""

    country: Optional[str] = Field(
        default=None,
        description="국가 (부분 이름 매칭, 예: United States, Germany)",
    )
    issuer_name: Optional[str] = Field(
        default=None,
        description="발행기관 이름 (부분 매칭, 대소문자 무관)",
    )
    isin: Optional[str | List[str]] = Field(
        default=None,
        description="국제증권식별번호(ISIN). 단일 또는 리스트",
    )
    lei: Optional[str] = Field(
        default=None,
        description="발행기관 법인식별기호(LEI)",
    )
    currency: Optional[str | List[str]] = Field(
        default=None,
        description="채권 통화. ISO 4217 3자리 코드 (예: USD, EUR, GBP)",
    )
    coupon_min: Optional[float] = Field(default=None, description="최소 쿠폰금리 (%)")
    coupon_max: Optional[float] = Field(default=None, description="최대 쿠폰금리 (%)")
    issued_amount_min: Optional[int] = Field(default=None, description="최소 발행금액")
    issued_amount_max: Optional[int] = Field(default=None, description="최대 발행금액")
    maturity_date_min: Optional[date_type] = Field(default=None, description="최소 만기일")
    maturity_date_max: Optional[date_type] = Field(default=None, description="최대 만기일")
    ytm_min: Optional[float] = Field(default=None, description="최소 만기수익률 (%)")
    ytm_max: Optional[float] = Field(default=None, description="최대 만기수익률 (%)")
    limit: Optional[int] = Field(default=100, description="최대 반환 건수")


class BondPricesData(BaseData):
    """채권 가격 표준 데이터"""

    isin: Optional[str] = Field(default=None, description="국제증권식별번호(ISIN)")
    lei: Optional[str] = Field(default=None, description="발행기관 법인식별기호(LEI)")
    figi: Optional[str] = Field(default=None, description="FIGI 식별자")
    cusip: Optional[str] = Field(default=None, description="CUSIP 식별자")
    issuer_name: Optional[str] = Field(default=None, description="발행기관 이름")
    country: Optional[str] = Field(default=None, description="발행 국가")
    currency: Optional[str] = Field(default=None, description="채권 통화")
    coupon_rate: Optional[float] = Field(default=None, description="쿠폰금리 (%)")
    price: Optional[float] = Field(
        default=None, description="채권 가격 (액면가 기준, 보통 100 기준)"
    )
    current_yield: Optional[float] = Field(default=None, description="현재 수익률 (%)")
    ytm: Optional[float] = Field(
        default=None, description="만기수익률 — Yield to Maturity (%)"
    )
    ytw: Optional[float] = Field(
        default=None, description="최악 수익률 — Yield to Worst (%)"
    )
    duration: Optional[float] = Field(default=None, description="듀레이션 (년)")
    issued_amount: Optional[float] = Field(default=None, description="발행금액")
    maturity_date: Optional[date_type] = Field(default=None, description="만기일")
    call_date: Optional[date_type] = Field(
        default=None, description="조기상환 가능일 (Nearest Call Date)"
    )
    issue_date: Optional[date_type] = Field(default=None, description="발행일")
    rating: Optional[str] = Field(default=None, description="신용등급 (예: AAA, AA+, BBB)")
    bond_type: Optional[str] = Field(
        default=None, description="채권 유형 (Corporate, Government, Municipal 등)"
    )
