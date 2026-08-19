"""Standard Model: Vol Regime (실현변동성 기반 변동성 국면)

⚠️ **이건 내재변동성(implied volatility)이 아니다. 스팟에서 계산한 실현변동성이다.**

원래 보고 싶은 지표는 USD/JPY 1개월 내재변동성과 25델타 리스크리버설이다. 캐리
트레이드는 본질적으로 숏 볼 포지션이라, 언와인드는 스팟보다 옵션 시장에서 먼저
가격에 반영된다. 하지만 무료로 접근 가능한 소스가 없다:
  - CBOE EuroCurrency Volatility Index(EVZ)는 2025-03-11자로 시리즈가 중단됐다.
  - CME FX 옵션 세틀먼트와 은행 OTC 볼 서피스(RR/BF)는 전부 유료 라이선스다.

그래서 이 모델은 **스팟 기반 대체 지표**를 제공한다. 대체하면서 잃는 것이 명확하다:
  → **선행성을 잃는다.** 실현변동성은 이미 일어난 움직임의 요약이라 동행~후행한다.
    "옵션이 먼저 움직인다"는 원 지표의 핵심 장점이 그대로 사라진다.
  → **리스크리버설의 방향성 정보를 근사할 뿐이다.** 실제 RR은 시장이 어느 쪽 꼬리에
    프리미엄을 붙이고 있는지(=선물적 기대)를 보여주지만, `skew`는 과거 수익률 분포의
    비대칭일 뿐이다.

따라서 이 지표는 단독 트리거로 쓰면 안 되고, [[cot_positioning]]·[[portfolio_flows]]·
[[pair_correlation]]의 보조 확인용으로만 읽어야 한다. 진짜 IV/RR이 필요하면 유료
소스(Bloomberg/Refinitiv/CME 데이터)를 붙이는 수밖에 없다.

한 행 = 하루.
"""
from datetime import date as date_type
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class VolRegimeQueryParams(BaseQueryParams):
    """실현변동성 국면 조회 표준 파라미터"""

    symbol: str = Field(default="JPY=X", description="심볼 (기본: USD/JPY)")
    window_short: int = Field(default=21, description="단기 윈도우 (거래일). 21 ≈ 1개월")
    window_long: int = Field(default=63, description="장기 윈도우 (거래일). 63 ≈ 3개월")
    start_date: Optional[date_type] = Field(default=None, description="시작일")
    end_date: Optional[date_type] = Field(default=None, description="종료일")


class VolRegimeData(BaseData):
    """일자별 실현변동성 국면 (한 행 = 하루). 모든 변동성은 연율화 % 단위"""

    date: Optional[str] = Field(default=None, description="날짜 (YYYY-MM-DD)")

    rv_short: Optional[float] = Field(
        default=None, description="단기 실현변동성 — 종가-종가 기준, 연율화 (%)"
    )
    rv_long: Optional[float] = Field(
        default=None, description="장기 실현변동성 — 종가-종가 기준, 연율화 (%)"
    )
    parkinson: Optional[float] = Field(
        default=None,
        description="Parkinson 고가-저가 변동성, 연율화 (%). 종가-종가보다 추정 효율이 높아 "
                    "장중 급변을 더 빨리 잡는다",
    )
    term_ratio: Optional[float] = Field(
        default=None,
        description="rv_short / rv_long. **>1 이면 단기 변동성이 장기를 추월**(term structure "
                    "역전) = 스트레스 국면. 진짜 IV 기간구조의 스팟 대체 지표",
    )
    skew: Optional[float] = Field(
        default=None,
        description="단기 윈도우 수익률 왜도. USD/JPY 기준 **음수 = 엔 급등(엔고) 방향 꼬리가 "
                    "두껍다** = 리스크리버설이 엔 콜 쪽으로 기우는 것과 같은 방향의 신호. "
                    "단, 실현 분포의 비대칭일 뿐 옵션 시장의 기대가 아니다",
    )
    close: Optional[float] = Field(default=None, description="종가 (USD/JPY 환율 등)")
