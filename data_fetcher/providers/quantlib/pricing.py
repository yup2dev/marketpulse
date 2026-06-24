"""QuantLib Option Pricing provider (standard OptionPricing 모델 경유)"""
from data_fetcher.abstract_provider.standard_models.option_pricing import (
    OptionType,
    ExerciseStyle,
    PricingEngine,
    OptionPricingQueryParams,
    OptionPricingData,
)


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
