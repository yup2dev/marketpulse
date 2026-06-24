"""Standard Model: Option Pricing (옵션 이론가/Greeks 계산)

옵션 가격 모델(Black-Scholes/Binomial/MC)의 입력 파라미터와 계산 결과(NPV, Greeks,
내재/시간가치)의 공통 인터페이스. provider는 이 클래스를 상속해 전용 필드를 추가한다.
"""
from datetime import date as date_type
from typing import Literal, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


OptionType = Literal["call", "put"]
ExerciseStyle = Literal["european", "american"]
PricingEngine = Literal["analytic", "binomial", "mc"]


class OptionPricingQueryParams(BaseQueryParams):
    """옵션 가격 계산 표준 파라미터"""

    option_type: OptionType = Field(description="옵션 타입 (call/put)")
    exercise_style: ExerciseStyle = Field(
        default="european", description="행사 방식 (european/american)"
    )
    engine: PricingEngine = Field(
        default="analytic",
        description="가격 엔진 (analytic=Black-Scholes, binomial=CRR, mc=Monte Carlo)",
    )
    spot: float = Field(gt=0, description="현재가 (underlying spot price)")
    strike: float = Field(gt=0, description="행사가 (strike price)")
    expiry: date_type = Field(description="만기일")
    evaluation_date: Optional[date_type] = Field(
        default=None, description="평가일 (기본값: 오늘)"
    )
    risk_free_rate: float = Field(default=0.04, description="무위험 이자율 (연율, 소수점)")
    dividend_yield: float = Field(default=0.0, description="배당 수익률 (연율, 소수점)")
    volatility: float = Field(gt=0, description="변동성 (연율, 소수점)")
    day_count: Literal["act365", "act360", "30_360"] = Field(
        default="act365", description="일수 계산 방식"
    )
    mc_samples: int = Field(
        default=10000, description="MC 시뮬레이션 샘플 수 (engine=mc일 때)"
    )
    binomial_steps: int = Field(
        default=200, description="Binomial 트리 스텝 수 (engine=binomial일 때)"
    )


class OptionPricingData(BaseData):
    """옵션 가격 계산 결과 표준 데이터"""

    option_type: OptionType = Field(description="옵션 타입")
    exercise_style: ExerciseStyle = Field(description="행사 방식")
    engine: PricingEngine = Field(description="사용된 엔진")

    spot: float = Field(description="현재가")
    strike: float = Field(description="행사가")
    expiry: date_type = Field(description="만기일")
    days_to_expiry: int = Field(description="만기까지 잔존일수")
    time_to_expiry: float = Field(description="만기까지 잔존년수 (day_count 기준)")

    risk_free_rate: float = Field(description="무위험 이자율")
    dividend_yield: float = Field(description="배당 수익률")
    volatility: float = Field(description="변동성")

    # === 가격 ===
    npv: float = Field(description="옵션 이론가 (NPV)")

    # === Greeks ===
    delta: Optional[float] = Field(default=None, description="Delta (∂V/∂S)")
    gamma: Optional[float] = Field(default=None, description="Gamma (∂²V/∂S²)")
    theta: Optional[float] = Field(default=None, description="Theta (∂V/∂t, 연율)")
    vega: Optional[float] = Field(default=None, description="Vega (∂V/∂σ, 1%p 대비)")
    rho: Optional[float] = Field(default=None, description="Rho (∂V/∂r, 1%p 대비)")

    # === 본질/시간 가치 ===
    intrinsic_value: float = Field(description="내재가치 (max(S-K, 0) 등)")
    time_value: float = Field(description="시간가치 (NPV - intrinsic)")
