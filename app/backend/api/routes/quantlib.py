"""QuantLib API Routes — OBBject pattern"""
import logging
from datetime import date as date_type
from typing import Literal, Optional

from fastapi import APIRouter, Query

from data_fetcher.core.obbject import OBBject
from data_fetcher.abstract_provider.abstract.fetcher import AnnotatedResult
from data_fetcher.query_executor import QueryExecutor
from app.backend.api.deps import route_handler

log = logging.getLogger(__name__)
router = APIRouter()


@router.get("/pricing/option")
@route_handler
async def price_option(
    option_type: Literal["call", "put"] = Query(...),
    spot: float = Query(..., gt=0),
    strike: float = Query(..., gt=0),
    expiry: date_type = Query(...),
    volatility: float = Query(..., gt=0),
    risk_free_rate: float = Query(0.04),
    dividend_yield: float = Query(0.0),
    exercise_style: Literal["european", "american"] = Query("european"),
    engine: Literal["analytic", "binomial", "mc"] = Query("analytic"),
    evaluation_date: Optional[date_type] = Query(None),
    mc_samples: int = Query(10000),
    binomial_steps: int = Query(200),
    provider: str = "quantlib",
) -> OBBject:
    params = {
        "option_type": option_type, "spot": spot, "strike": strike,
        "expiry": expiry, "volatility": volatility,
        "risk_free_rate": risk_free_rate, "dividend_yield": dividend_yield,
        "exercise_style": exercise_style, "engine": engine,
        "mc_samples": mc_samples, "binomial_steps": binomial_steps,
    }
    if evaluation_date:
        params["evaluation_date"] = evaluation_date

    raw = await QueryExecutor.fetch("quantlib", "pricing", params)
    items = raw.result if isinstance(raw, AnnotatedResult) else (raw or [])
    result = items[0] if items else None
    return OBBject(
        results=[result.model_dump(mode="json")] if result else [],
        provider=provider,
    )
