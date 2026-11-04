"""Current Economic Regime — 성장(GDP·산업생산·고용) × 인플레이션(CPI) 4분면 스냅샷.

macro_service.get_current_regime 에서 이전. 입력은 기존과 같은 FRED 모델
(gdp / industrial_production / nonfarm_payroll / cpi)을 QueryExecutor로 받아
캐시·자격증명(요청 사용자 키) 경로를 그대로 탄다.

regime_history 와 분류 기준이 다르다(이쪽: growth>0 & CPI<3.0 → goldilocks,
history: growth>=0 & CPI<=2.5). 기존 동작 유지를 위해 그대로 둔다.
"""
import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Mapping, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import ComputeFetcher
from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams
from data_fetcher.providers.fred.utils.yoy import shift_month, yoy_at

log = logging.getLogger(__name__)

GROWTH_THRESHOLD = 0.0
INFLATION_HIGH = 3.0


class RegimeCurrentQueryParams(BaseQueryParams):
    """현재 레짐 스냅샷 — 파라미터 없음."""


class RegimeCurrentData(BaseData):
    regime: str = Field(description="goldilocks / reflation / stagflation / deflation")
    growth_score: float = Field(description="성장 점수 (-100~100)")
    inflation_score: float = Field(description="인플레이션 점수 (-100~100, 2% 목표 중심)")
    growth_momentum: float = Field(description="GDP 성장률 직전 분기 대비 변화 (%p)")
    inflation_momentum: float = Field(description="CPI YoY 3개월 전 대비 변화 (%p)")
    timestamp: str
    cmp_gdp_growth: float = Field(description="최신 실질 GDP 성장률 (%)")
    cmp_industrial_production_yoy: float
    cmp_employment_yoy: float
    cmp_cpi_yoy: float
    gdp_date: Optional[str] = Field(default=None, description="GDP 기준 분기")
    cpi_date: Optional[str] = Field(default=None, description="CPI 기준 월")


def _v(item: Any, key: str) -> Any:
    return item.get(key) if isinstance(item, Mapping) else getattr(item, key, None)


def _points(items: List[Any]) -> List[Dict[str, Any]]:
    """{date, value} 리스트, 최신순(desc). 결측 제외."""
    pts = [
        {"date": str(_v(it, "date"))[:10], "value": float(_v(it, "value"))}
        for it in items
        if _v(it, "date") is not None and _v(it, "value") is not None
    ]
    return sorted(pts, key=lambda p: p["date"], reverse=True)


def _yoy(desc: List[Dict[str, Any]]) -> Optional[float]:
    """desc 시계열 최신 시점의 전년동월比(%) — 날짜 매칭(fred.utils.yoy)."""
    if not desc:
        return None
    return yoy_at({p["date"]: p["value"] for p in desc}, desc[0]["date"])


def classify_regime(growth_score: float, cpi_yoy: float) -> str:
    if growth_score > GROWTH_THRESHOLD:
        return "goldilocks" if cpi_yoy < INFLATION_HIGH else "reflation"
    return "stagflation" if cpi_yoy > INFLATION_HIGH else "deflation"


def compute_regime(gdp, indpro, payroll, cpi) -> Dict[str, Any]:
    """입력은 각 FRED 모델 결과(순서 무관). 날짜 기준 최신값을 쓴다."""
    gdp_d, ip_d, emp_d, cpi_d = _points(gdp), _points(indpro), _points(payroll), _points(cpi)

    gdp_growth = gdp_d[0]["value"] if gdp_d else 0.0
    ip_yoy = _yoy(ip_d) or 0.0
    emp_yoy = _yoy(emp_d) or 0.0
    cpi_yoy = _yoy(cpi_d) or 0.0

    growth_score = (
        (gdp_growth / 5.0) * 100 * 0.5
        + (ip_yoy / 10.0) * 100 * 0.25
        + (emp_yoy / 3.0) * 100 * 0.25
    )
    growth_score = max(-100.0, min(100.0, growth_score))
    inflation_score = max(-100.0, min(100.0, (cpi_yoy - 2.0) / 6.0 * 100))

    growth_momentum = gdp_d[0]["value"] - gdp_d[1]["value"] if len(gdp_d) >= 2 else 0.0
    # 3개월 전 '날짜'의 YoY (결측월이 있어도 위치가 아닌 날짜 기준)
    cpi_by_date = {p["date"]: p["value"] for p in cpi_d}
    cpi_yoy_3m_ago = yoy_at(cpi_by_date, shift_month(cpi_d[0]["date"], -3)) if cpi_d else None
    inflation_momentum = cpi_yoy - cpi_yoy_3m_ago if cpi_yoy_3m_ago is not None else 0.0

    return {
        "regime": classify_regime(growth_score, cpi_yoy),
        "growth_score": round(growth_score, 2),
        "inflation_score": round(inflation_score, 2),
        "growth_momentum": round(growth_momentum, 2),
        "inflation_momentum": round(inflation_momentum, 2),
        "timestamp": datetime.now().isoformat(),
        "cmp_gdp_growth": round(gdp_growth, 2),
        "cmp_industrial_production_yoy": round(ip_yoy, 2),
        "cmp_employment_yoy": round(emp_yoy, 2),
        "cmp_cpi_yoy": round(cpi_yoy, 2),
        "gdp_date": gdp_d[0]["date"] if gdp_d else None,
        "cpi_date": cpi_d[0]["date"] if cpi_d else None,
    }


class FREDRegimeCurrentFetcher(ComputeFetcher[RegimeCurrentQueryParams, RegimeCurrentData]):
    """FRED 지표 조합 → 현재 경제 레짐. 원천 조회는 fred 모델(QueryExecutor)에 위임."""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> RegimeCurrentQueryParams:
        return RegimeCurrentQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: RegimeCurrentQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        from data_fetcher.query_executor import QueryExecutor  # 순환 import 방지

        async def _get(model: str, required: bool):
            try:
                raw = await QueryExecutor.fetch("fred", model, {})
                return getattr(raw, "result", raw) or []
            except Exception as e:
                if required:
                    raise
                log.warning("[RegimeCurrent] %s 조회 실패: %s", model, e)
                return []

        gdp, indpro, payroll, cpi = await asyncio.gather(
            _get("gdp", True),
            _get("industrial_production", False),
            _get("nonfarm_payroll", False),
            _get("cpi", True),
        )
        return compute_regime(gdp, indpro, payroll, cpi)

    @staticmethod
    def transform_data(query, data: Dict[str, Any], **kwargs: Any) -> List[RegimeCurrentData]:
        return [RegimeCurrentData(**data)]
