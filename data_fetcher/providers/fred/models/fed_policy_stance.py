"""Fed Policy Stance — 기준금리 수준·추세로 hawkish/neutral/dovish 판정 스냅샷.

macro_service.get_fed_policy_stance 에서 이전(로직 동일). 입력은 fred interest_rate
(federal_funds) 모델을 QueryExecutor로 받는다.

주의: 금리 인상/동결/인하 확률은 시장 가격(FedWatch 등)이 아니라 판정 결과에 따른
고정 휴리스틱 값이다.
"""
import logging
from datetime import date, timedelta
from typing import Any, Dict, List, Mapping, Optional, Union

from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import ComputeFetcher
from data_fetcher.abstract_provider.standard_models.indicator_dashboard import (
    IndicatorDashboardData,
    IndicatorDashboardQueryParams,
)

log = logging.getLogger(__name__)


class FedPolicyStanceQueryParams(IndicatorDashboardQueryParams):
    pass


class FedPolicyStanceData(IndicatorDashboardData):
    section: str = Field(default="Fed Policy", description="대시보드 섹션")
    value: Optional[Union[float, int, str]] = Field(default=None, description="값 (Stance는 문자열)")


def _v(item: Any, key: str) -> Any:
    return item.get(key) if isinstance(item, Mapping) else getattr(item, key, None)


def compute_stance(rates: List[Any], today: Optional[date] = None) -> List[Dict[str, Any]]:
    today = today or date.today()
    pts = sorted(
        ({"date": str(_v(r, "date"))[:10], "rate": float(_v(r, "rate"))}
         for r in rates if _v(r, "date") is not None and _v(r, "rate") is not None),
        key=lambda r: r["date"], reverse=True,
    )
    if len(pts) < 2:
        raise ValueError("Insufficient Fed Funds Rate data")

    current_rate, current_date = pts[0]["rate"], pts[0]["date"]

    since_12m = str(today - timedelta(days=365))
    recent = [r for r in pts if r["date"] >= since_12m]
    rate_changes_12m = sum(
        1 for i in range(len(recent) - 1) if abs(recent[i]["rate"] - recent[i + 1]["rate"]) > 0.01
    )

    peak_rate = max(r["rate"] for r in pts)
    trough_rate = min(r["rate"] for r in pts)

    rate_level_score = ((current_rate - 2.0) / 3.0) * 50
    since_3m = str(today - timedelta(days=90))
    three_m = [r for r in pts if r["date"] >= since_3m]
    rate_momentum = (three_m[0]["rate"] - three_m[-1]["rate"]) * 10 if len(three_m) >= 2 else 0
    stance_score = max(-100, min(100, rate_level_score + rate_momentum))

    stance = "hawkish" if stance_score > 30 else "dovish" if stance_score < -30 else "neutral"

    if stance == "hawkish" and current_rate < peak_rate - 0.5:
        probs = {"hike": 65, "hold": 30, "cut": 5}
    elif stance == "dovish" and current_rate > trough_rate + 0.5:
        probs = {"hike": 5, "hold": 30, "cut": 65}
    else:
        probs = {"hike": 20, "hold": 60, "cut": 20}

    percentile = (
        round((current_rate - trough_rate) / (peak_rate - trough_rate) * 100, 1)
        if peak_rate != trough_rate else 50
    )
    return [
        {"metric": "Stance",           "value": stance,                       "unit": ""},
        {"metric": "Stance Score",     "value": round(stance_score, 2),        "unit": "/100"},
        {"metric": "Fed Funds Rate",   "value": round(current_rate, 2),        "unit": "%"},
        {"metric": "Target Lower",     "value": round(current_rate - 0.25, 2), "unit": "%"},
        {"metric": "Target Upper",     "value": round(current_rate, 2),        "unit": "%"},
        {"metric": "Rate Changes 12M", "value": rate_changes_12m,              "unit": "times"},
        {"metric": "Peak Rate",        "value": round(peak_rate, 2),           "unit": "%"},
        {"metric": "Trough Rate",      "value": round(trough_rate, 2),         "unit": "%"},
        {"metric": "Rate Percentile",  "value": percentile,                    "unit": "%"},
        {"metric": "Hike Prob",        "value": probs["hike"],                 "unit": "%"},
        {"metric": "Hold Prob",        "value": probs["hold"],                 "unit": "%"},
        {"metric": "Cut Prob",         "value": probs["cut"],                  "unit": "%"},
        {"metric": "Last Updated",     "value": current_date,                  "unit": ""},
    ]


class FREDFedPolicyStanceFetcher(ComputeFetcher[FedPolicyStanceQueryParams, FedPolicyStanceData]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FedPolicyStanceQueryParams:
        return FedPolicyStanceQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: FedPolicyStanceQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        from data_fetcher.query_executor import QueryExecutor  # 순환 import 방지

        raw = await QueryExecutor.fetch("fred", "interest_rate", {"rate_type": "federal_funds"})
        return compute_stance(getattr(raw, "result", raw) or [])

    @staticmethod
    def transform_data(query, data: List[Dict[str, Any]], **kwargs: Any) -> List[FedPolicyStanceData]:
        return [FedPolicyStanceData(**row) for row in data]
