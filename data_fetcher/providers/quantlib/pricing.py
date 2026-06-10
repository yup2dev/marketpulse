"""QuantLib Option Pricing Models"""
from datetime import date as date_type
from typing import Literal, Optional
from pydantic import Field

from data_fetcher.abstract_provider.abstract import BaseQueryParams, BaseData


OptionType = Literal["call", "put"]
ExerciseStyle = Literal["european", "american"]
PricingEngine = Literal["analytic", "binomial", "mc"]


class OptionPricingQueryParams(BaseQueryParams):
    """옵션 가격 계산 파라미터"""

    option_type: OptionType = Field(
        description="옵션 타입 (call/put)"
    )
    exercise_style: ExerciseStyle = Field(
        default="european",
        description="행사 방식 (european/american)"
    )
    engine: PricingEngine = Field(
        default="analytic",
        description="가격 엔진 (analytic=Black-Scholes, binomial=CRR, mc=Monte Carlo)"
    )
    spot: float = Field(
        gt=0,
        description="현재가 (underlying spot price)"
    )
    strike: float = Field(
        gt=0,
        description="행사가 (strike price)"
    )
    expiry: date_type = Field(
        description="만기일"
    )
    evaluation_date: Optional[date_type] = Field(
        default=None,
        description="평가일 (기본값: 오늘)"
    )
    risk_free_rate: float = Field(
        default=0.04,
        description="무위험 이자율 (연율, 소수점)"
    )
    dividend_yield: float = Field(
        default=0.0,
        description="배당 수익률 (연율, 소수점)"
    )
    volatility: float = Field(
        gt=0,
        description="변동성 (연율, 소수점)"
    )
    day_count: Literal["act365", "act360", "30_360"] = Field(
        default="act365",
        description="일수 계산 방식"
    )
    mc_samples: int = Field(
        default=10000,
        description="MC 시뮬레이션 샘플 수 (engine=mc일 때)"
    )
    binomial_steps: int = Field(
        default=200,
        description="Binomial 트리 스텝 수 (engine=binomial일 때)"
    )


class OptionPricingData(BaseData):
    """옵션 가격 계산 결과"""

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


"""QuantLib Option Pricing Fetcher

QuantLib-Python으로 옵션 가격과 Greeks를 로컬에서 계산한다.
외부 API를 호출하지 않으며 require_credentials=False.
"""
import logging
from datetime import date as date_type, datetime
from typing import Any, Dict, List, Optional

import QuantLib as ql

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher

log = logging.getLogger(__name__)


_DAY_COUNT_MAP = {
    "act365": ql.Actual365Fixed(),
    "act360": ql.Actual360(),
    "30_360": ql.Thirty360(ql.Thirty360.BondBasis),
}


def _to_ql_date(d: date_type) -> ql.Date:
    return ql.Date(d.day, d.month, d.year)


class QuantLibPricingFetcher(Fetcher[OptionPricingQueryParams, OptionPricingData]):
    """Black-Scholes / Binomial / Monte Carlo 기반 옵션 가격 계산"""

    require_credentials = False

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> OptionPricingQueryParams:
        return OptionPricingQueryParams(**params)

    @staticmethod
    def extract_data(
        query: OptionPricingQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """QuantLib으로 옵션 가격 및 Greeks 계산"""
        try:
            eval_date = query.evaluation_date or datetime.now().date()
            ql_eval_date = _to_ql_date(eval_date)
            ql.Settings.instance().evaluationDate = ql_eval_date

            calendar = ql.NullCalendar()
            day_count = _DAY_COUNT_MAP[query.day_count]

            ql_expiry = _to_ql_date(query.expiry)
            if ql_expiry <= ql_eval_date:
                raise ValueError(
                    f"Expiry ({query.expiry}) must be after evaluation_date ({eval_date})"
                )

            # 행사 방식
            if query.exercise_style == "european":
                exercise = ql.EuropeanExercise(ql_expiry)
            else:
                exercise = ql.AmericanExercise(ql_eval_date, ql_expiry)

            # 옵션 타입
            ql_option_type = (
                ql.Option.Call if query.option_type == "call" else ql.Option.Put
            )
            payoff = ql.PlainVanillaPayoff(ql_option_type, query.strike)
            option = ql.VanillaOption(payoff, exercise)

            # 시장 데이터 핸들
            spot_handle = ql.QuoteHandle(ql.SimpleQuote(query.spot))
            rate_handle = ql.YieldTermStructureHandle(
                ql.FlatForward(ql_eval_date, query.risk_free_rate, day_count)
            )
            dividend_handle = ql.YieldTermStructureHandle(
                ql.FlatForward(ql_eval_date, query.dividend_yield, day_count)
            )
            vol_handle = ql.BlackVolTermStructureHandle(
                ql.BlackConstantVol(ql_eval_date, calendar, query.volatility, day_count)
            )

            bsm_process = ql.BlackScholesMertonProcess(
                spot_handle, dividend_handle, rate_handle, vol_handle
            )

            # 엔진 선택
            if query.engine == "analytic":
                if query.exercise_style != "european":
                    raise ValueError("analytic engine requires european exercise")
                option.setPricingEngine(ql.AnalyticEuropeanEngine(bsm_process))
            elif query.engine == "binomial":
                option.setPricingEngine(
                    ql.BinomialVanillaEngine(bsm_process, "crr", query.binomial_steps)
                )
            elif query.engine == "mc":
                if query.exercise_style != "european":
                    raise ValueError("mc engine only supports european exercise here")
                mc_engine = ql.MCEuropeanEngine(
                    bsm_process,
                    "pseudorandom",
                    timeSteps=1,
                    requiredSamples=query.mc_samples,
                    seed=42,
                )
                option.setPricingEngine(mc_engine)
            else:
                raise ValueError(f"Unknown engine: {query.engine}")

            npv = float(option.NPV())

            # Greeks (분석/이항 엔진에서만 제공, MC에서는 None)
            greeks: Dict[str, Optional[float]] = {
                "delta": None,
                "gamma": None,
                "theta": None,
                "vega": None,
                "rho": None,
            }
            if query.engine != "mc":
                try:
                    greeks["delta"] = float(option.delta())
                    greeks["gamma"] = float(option.gamma())
                    greeks["theta"] = float(option.theta())
                except RuntimeError:
                    pass
                # vega/rho: analytic만 지원
                if query.engine == "analytic":
                    try:
                        greeks["vega"] = float(option.vega()) / 100.0
                        greeks["rho"] = float(option.rho()) / 100.0
                    except RuntimeError:
                        pass

            time_to_expiry = day_count.yearFraction(ql_eval_date, ql_expiry)
            days_to_expiry = ql_expiry - ql_eval_date

            if query.option_type == "call":
                intrinsic = max(query.spot - query.strike, 0.0)
            else:
                intrinsic = max(query.strike - query.spot, 0.0)

            return {
                "option_type": query.option_type,
                "exercise_style": query.exercise_style,
                "engine": query.engine,
                "spot": query.spot,
                "strike": query.strike,
                "expiry": query.expiry,
                "days_to_expiry": int(days_to_expiry),
                "time_to_expiry": float(time_to_expiry),
                "risk_free_rate": query.risk_free_rate,
                "dividend_yield": query.dividend_yield,
                "volatility": query.volatility,
                "npv": npv,
                "intrinsic_value": intrinsic,
                "time_value": npv - intrinsic,
                **greeks,
            }

        except Exception as e:
            log.error(f"QuantLib pricing failed: {e}")
            raise

    @staticmethod
    def transform_data(
        query: OptionPricingQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> List[OptionPricingData]:
        return [OptionPricingData.model_validate(data)]
