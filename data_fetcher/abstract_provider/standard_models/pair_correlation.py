"""Standard Model: Pair Correlation (두 자산 롤링 상관계수)

두 시계열의 일일 수익률 롤링 상관계수. 한 행 = 하루.

엔 캐리 맥락의 용법 — `symbol='JPY=X'`(USD/JPY), `benchmark='^N225'`(닛케이225):
  정상 국면에서는 **음의 상관**이다. USD/JPY 상승(엔 약세) ↔ 닛케이 상승. 수출주 실적
  기대와 캐리 유입이 같이 붙기 때문이다. 이 부호가 뒤집혀 **양의 상관이 강해지면**
  엔고와 주가 하락이 동시에 오는 것이고, 이는 캐리 언와인드 국면 진입 신호다.
  (레버리지 축소는 조달통화 매수 + 위험자산 매도를 동시에 일으킨다.)

⚠️ 주의:
  1. **거래시간 불일치** — USD/JPY는 24시간, ^N225는 일본장 한정이다. 일자 정렬만으로
     맞추면 미국장 시간대 급변이 다음 날 닛케이에 반영돼 상관이 과소 추정될 수 있다.
     `lag_benchmark=1`로 벤치마크를 하루 밀어 이 왜곡을 점검할 수 있다.
  2. **상관은 인과가 아니다** — 부호 전환은 국면 변화의 정황이지 언와인드의 증거가
     아니다. [[cot_positioning]]·[[portfolio_flows]]와 교차 확인해야 한다.
  3. 짧은 window는 노이즈로도 부호가 자주 뒤집힌다. 60거래일(약 3개월)이 기본값이다.
"""
from datetime import date as date_type
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class PairCorrelationQueryParams(BaseQueryParams):
    """롤링 상관계수 조회 표준 파라미터"""

    symbol: str = Field(default="JPY=X", description="기준 심볼 (기본: USD/JPY)")
    benchmark: str = Field(default="^N225", description="비교 심볼 (기본: 닛케이225)")
    window: int = Field(default=60, description="롤링 윈도우 (거래일). 60 ≈ 3개월")
    lag_benchmark: int = Field(
        default=0,
        description="벤치마크를 N일 지연시켜 상관 계산 (거래시간 불일치 점검용, 보통 0 또는 1)",
    )
    start_date: Optional[date_type] = Field(default=None, description="시작일")
    end_date: Optional[date_type] = Field(default=None, description="종료일")


class PairCorrelationData(BaseData):
    """일자별 롤링 상관계수 (한 행 = 하루)"""

    date: Optional[str] = Field(default=None, description="날짜 (YYYY-MM-DD)")
    correlation: Optional[float] = Field(
        default=None, description="롤링 상관계수 (−1 ~ 1). 음수 = 엔 약세와 주가 상승이 동행"
    )
    symbol_return_pct: Optional[float] = Field(default=None, description="기준 심볼 일일 수익률 (%)")
    benchmark_return_pct: Optional[float] = Field(default=None, description="벤치마크 일일 수익률 (%)")
    regime: Optional[str] = Field(
        default=None,
        description="상관 국면 라벨 — 'risk-on'(corr<-0.2) / 'neutral' / 'unwind'(corr>+0.2)",
    )
