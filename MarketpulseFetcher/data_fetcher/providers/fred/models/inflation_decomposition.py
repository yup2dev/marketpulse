"""Inflation Decomposition — CPI 구성요소별 YoY와 헤드라인 기여도.

macro_service.get_inflation_decomposition 에서 이전. 이전 구현은 FRED를 조회하고도
결과를 버리고 하드코딩된 추정치(yoy_change/contribution)를 반환했다 — 여기서는 FRED
구성요소 지수(SA, 월간)로 실제 YoY를 계산한다.

기여도(%p) = 가중치(%) × YoY(%) / 100. 가중치는 FRED에 없는 BLS CPI relative importance
라 상수로 둔다(_WEIGHTS_VINTAGE). BLS는 매년 1월에 갱신하므로 연 1회 값을 바꿔야 한다.
구성요소 5개는 서로 겹치지 않게 나눴고, '서비스(주거 제외)'는 FRED 대체 지수
'Services less rent of shelter'(에너지 서비스 일부 포함)를 YoY 프록시로 쓴다.

헤드라인·근원·sticky/flexible·기대인플레이션은 metadata 로 함께 돌려준다.
"""
import asyncio
import logging
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.fetcher import AnnotatedResult
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams
from data_fetcher.providers.fred.utils.helpers import FredSeriesHelper
from data_fetcher.providers.fred.utils.yoy import pct_change_at, yoy_at
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)

# BLS CPI-U relative importance (Dec 2023, 대략값 — 소수 1자리 반올림). 합계 100.
_WEIGHTS_VINTAGE = "BLS CPI-U relative importance, Dec 2023 (approx.)"
_COMPONENTS = [
    # (category, FRED series, weight %)
    ("Food",                    "CPIUFDSL",        13.6),
    ("Energy",                  "CPIENGSL",         6.7),
    ("Goods (ex-food, energy)", "CUSR0000SACL1E",  19.0),
    ("Shelter",                 "CUSR0000SAH1",    36.2),
    ("Services (ex-shelter)",   "CUSR0000SASL2RS", 24.5),
]
# 13개월(YoY 계산) 필요
_INDEX_SERIES = {"headline": "CPIAUCSL", "core": "CPILFESL"}
# 이미 비율(%)인 시리즈 — 최신값만
_RATE_SERIES = {
    "sticky_core_cpi_yoy": "CORESTICKM159SFRBATL",
    "flexible_core_cpi_yoy": "COREFLEXCPIM159SFRBATL",
    "breakeven_5y": "T5YIE",
    "breakeven_10y": "T10YIE",
}


class InflationDecompositionQueryParams(BaseQueryParams):
    """CPI 구성요소 스냅샷 — 파라미터 없음."""


class InflationDecompositionData(BaseData):
    category: str = Field(description="CPI 구성요소")
    weight: float = Field(description="CPI 바스켓 가중치 (%)")
    yoy_change: Optional[float] = Field(default=None, description="전년동월比 (%)")
    contribution: Optional[float] = Field(default=None, description="헤드라인 YoY 기여도 (%p)")
    series_id: str = Field(description="FRED 시리즈 ID")
    date: Optional[str] = Field(default=None, description="기준월")


def _floats(obs: List[Dict[str, Any]]) -> List[tuple]:
    """FRED observations(desc) → [(date, float)] 결측('.') 제외."""
    out = []
    for o in obs or []:
        v = o.get("value")
        if v in (None, ".", ""):
            continue
        try:
            out.append((o["date"], float(v)))
        except (TypeError, ValueError):
            continue
    return out


def index_stats(obs: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """월간 지수(desc) → 최신값·YoY·MoM.

    비교 시점은 위치가 아니라 날짜로 찾는다 — FRED 결측월('.', 예: 2025-10 셧다운)을
    빼면 12칸 뒤가 13개월 전이 된다. 전년동월/전월이 결측이면 해당 값은 None.
    """
    pts = _floats(obs)
    if not pts:
        return None
    by_date = dict(pts)
    d0, cur = pts[0]
    yoy, mom = yoy_at(by_date, d0), pct_change_at(by_date, d0, 1)
    if yoy is None:
        return None
    return {
        "date": d0,
        "current": round(cur, 3),
        "yoy": round(yoy, 2),
        "mom": round(mom, 2) if mom is not None else None,
    }


def build_rows(index_obs: Dict[str, List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    rows = []
    for category, sid, weight in _COMPONENTS:
        st = index_stats(index_obs.get(sid, []))
        yoy = st["yoy"] if st else None
        rows.append({
            "category": category,
            "weight": weight,
            "yoy_change": yoy,
            "contribution": round(weight * yoy / 100, 2) if yoy is not None else None,
            "series_id": sid,
            "date": st["date"] if st else None,
        })
    return rows


class FREDInflationDecompositionFetcher(
    ApiFetcher[InflationDecompositionQueryParams, InflationDecompositionData]
):
    api_name = "FRED"
    api_key_env = "FRED_API_KEY"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> InflationDecompositionQueryParams:
        return InflationDecompositionQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: InflationDecompositionQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Dict[str, List[Dict[str, Any]]]]:
        api_key = get_api_key(credentials=credentials, api_name="FRED", env_var="FRED_API_KEY")

        async def _fetch(sid: str, limit: int):
            try:
                return sid, await FredSeriesHelper.fetch_series(sid, api_key, limit=limit, sort_order="desc")
            except Exception as e:
                log.warning("[InflationDecomposition] %s 조회 실패: %s", sid, e)
                return sid, []

        index_ids = [sid for _, sid, _ in _COMPONENTS] + list(_INDEX_SERIES.values())
        pairs = await asyncio.gather(
            *[_fetch(sid, 14) for sid in index_ids],
            *[_fetch(sid, 5) for sid in _RATE_SERIES.values()],
        )
        obs = dict(pairs)
        if not any(obs.get(sid) for _, sid, _ in _COMPONENTS):
            raise ValueError("CPI component series unavailable from FRED")
        return {"obs": obs}

    @staticmethod
    def transform_data(
        query: InflationDecompositionQueryParams,
        data: Dict[str, Dict[str, List[Dict[str, Any]]]],
        **kwargs: Any,
    ) -> "AnnotatedResult[List[InflationDecompositionData]]":
        obs = data["obs"]
        rows = [InflationDecompositionData(**r) for r in build_rows(obs)]

        rates = {}
        for key, sid in _RATE_SERIES.items():
            pts = _floats(obs.get(sid, []))
            rates[key] = round(pts[0][1], 2) if pts else None

        contribs = [r.contribution for r in rows if r.contribution is not None]
        metadata = {
            "headline": index_stats(obs.get(_INDEX_SERIES["headline"], [])),
            "core": index_stats(obs.get(_INDEX_SERIES["core"], [])),
            **rates,
            "sum_of_contributions": round(sum(contribs), 2) if contribs else None,
            "weights_vintage": _WEIGHTS_VINTAGE,
        }
        return AnnotatedResult(result=rows, metadata=metadata)
