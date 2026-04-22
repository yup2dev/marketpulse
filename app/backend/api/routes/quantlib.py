"""
QuantLib API Routes
로컬 QuantLib 연산을 노출하는 엔드포인트
"""
import logging
from datetime import date as date_type
from typing import Literal, Optional

from fastapi import APIRouter, Query

from app.backend.services.quantlib import pricing_service
from app.backend.api.deps import route_handler

log = logging.getLogger(__name__)
router = APIRouter()


@router.get("/pricing/option")
@route_handler
async def price_option(
    option_type: Literal["call", "put"] = Query(..., description="옵션 타입"),
    spot: float = Query(..., gt=0, description="현재가"),
    strike: float = Query(..., gt=0, description="행사가"),
    expiry: date_type = Query(..., description="만기일 YYYY-MM-DD"),
    volatility: float = Query(..., gt=0, description="변동성 (연율, 예: 0.25)"),
    risk_free_rate: float = Query(0.04, description="무위험 이자율"),
    dividend_yield: float = Query(0.0, description="배당 수익률"),
    exercise_style: Literal["european", "american"] = Query("european"),
    engine: Literal["analytic", "binomial", "mc"] = Query("analytic"),
    evaluation_date: Optional[date_type] = Query(None, description="평가일 (기본: 오늘)"),
    mc_samples: int = Query(10000, description="MC 샘플 수"),
    binomial_steps: int = Query(200, description="Binomial 스텝 수"),
):
    """
    옵션 가격 및 Greeks 계산

    - `analytic` (Black-Scholes): European만 지원, 전체 Greeks 제공
    - `binomial` (CRR): European/American 모두 지원, delta/gamma/theta 제공
    - `mc` (Monte Carlo): European만 지원, Greeks 없음
    """
    params = {
        "option_type": option_type,
        "spot": spot,
        "strike": strike,
        "expiry": expiry,
        "volatility": volatility,
        "risk_free_rate": risk_free_rate,
        "dividend_yield": dividend_yield,
        "exercise_style": exercise_style,
        "engine": engine,
        "mc_samples": mc_samples,
        "binomial_steps": binomial_steps,
    }
    if evaluation_date:
        params["evaluation_date"] = evaluation_date

    result = await pricing_service.price_option(params)
    if result is None:
        return {"result": None}
    return {"result": result.model_dump(mode="json")}
