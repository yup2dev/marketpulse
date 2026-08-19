"""Carry Funding Stress Fetcher — 엔 조달 스트레스 대체 지표 (FRED 5개 시리즈 병합).

⚠️ 크로스커런시 베이시스가 아니다. 3개월 FX 포워드 포인트를 무료로 주는 소스가 없어
   CIP 편차를 직접 계산할 수 없다. 대신 조달 스트레스의 간접 신호를 모은다.
   무엇을 잃는지는 standard model 도큐스트링(carry_funding_stress.py) 참조.

빈도가 섞여 있다(일간/주간/월간). 일간 축에 맞춰 직전값으로 전진 채움한다.
"""
import logging
from datetime import timedelta
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.carry_funding_stress import (
    CarryFundingStressData,
    CarryFundingStressQueryParams,
)
from data_fetcher.providers.fred.utils.helpers import FredSeriesHelper
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)

#: 표준 필드 → FRED series_id. 주석의 빈도는 전진 채움 대상 판별용.
_SERIES_MAP = {
    "usdjpy":       "DEXJPUS",           # 일간 — USD/JPY 환율
    "us_3m":        "DGS3MO",            # 일간 — 미국 3개월 국채
    "vix":          "VIXCLS",            # 일간 — VIX
    "cb_swap_musd": "SWPT",              # 주간 — 연준 중앙은행 유동성 스왑 잔액
    "jp_3m":        "IR3TIB01JPM156N",   # 월간 — 일본 3개월 인터뱅크 금리
}

#: 관측 빈도가 낮아 일간 축에서 직전값으로 채워야 하는 필드
_FORWARD_FILL = ("cb_swap_musd", "jp_3m")

#: 저빈도 시리즈를 start_date보다 이만큼 앞에서부터 받아온다.
#: 그러지 않으면 구간 첫 관측이 나오기 전 행들이 전부 null이 된다
#: (주간 SWPT는 최대 7일, 월간 일본 3개월 금리는 최대 ~60일 뒤처진다).
_FORWARD_FILL_WARMUP_DAYS = 120

#: 일간 축을 정의하는 필드 — 이 값이 있는 날만 행으로 만든다(환율이 기준).
_ANCHOR_FIELD = "usdjpy"


class FREDCarryFundingStressQueryParams(CarryFundingStressQueryParams):
    """조달 스트레스 조회 파라미터 (standard CarryFundingStress 경유)."""


class FREDCarryFundingStressData(CarryFundingStressData):
    """일자별 조달 스트레스 지표 (standard CarryFundingStress 경유)."""


class FREDCarryFundingStressFetcher(
    ApiFetcher[FREDCarryFundingStressQueryParams, FREDCarryFundingStressData]
):
    """엔 조달 스트레스 — 환율·미일 금리차·중앙은행 스왑·VIX 통합 시계열."""

    api_name = "FRED"
    api_key_env = "FRED_API_KEY"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FREDCarryFundingStressQueryParams:
        return FREDCarryFundingStressQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: FREDCarryFundingStressQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, List[Dict]]:
        api_key = get_api_key(credentials=credentials, api_name="FRED", env_var="FRED_API_KEY")
        warmup_start = (
            query.start_date - timedelta(days=_FORWARD_FILL_WARMUP_DAYS)
            if query.start_date else None
        )
        raw: Dict[str, List[Dict]] = {}
        for field, series_id in _SERIES_MAP.items():
            # 전진 채움 대상은 구간 시작 전 값이 있어야 첫 행부터 채워진다.
            series_start = warmup_start if field in _FORWARD_FILL else query.start_date
            try:
                raw[field] = await FredSeriesHelper.fetch_series(
                    series_id=series_id,
                    api_key=api_key,
                    start_date=series_start,
                    end_date=query.end_date,
                    sort_order="asc",
                )
            except Exception as exc:  # noqa: BLE001 — 한 시리즈 실패가 위젯 전체를 죽이지 않게
                log.warning("[CarryFundingStress] %s fetch failed: %s", series_id, exc)
                raw[field] = []
        return raw

    @staticmethod
    def transform_data(
        query: FREDCarryFundingStressQueryParams,
        data: Dict[str, List[Dict]],
        **kwargs: Any,
    ) -> List[FREDCarryFundingStressData]:
        # date → {field: value}
        by_date: Dict[str, Dict[str, float]] = {}
        for field, observations in (data or {}).items():
            for obs in observations or []:
                date_str, value = obs.get("date"), obs.get("value")
                if not date_str or value in (None, ".", ""):
                    continue
                try:
                    by_date.setdefault(date_str, {})[field] = float(value)
                except (TypeError, ValueError):
                    continue

        if not by_date:
            raise ValueError("CarryFundingStress: FRED에서 유효한 관측값을 받지 못했다")

        rows: List[FREDCarryFundingStressData] = []
        carried: Dict[str, float] = {}
        for date_str in sorted(by_date):
            values = by_date[date_str]

            # 저빈도 시리즈는 관측이 있는 날 갱신하고, 없는 날은 직전값을 끌고 간다.
            for field in _FORWARD_FILL:
                if field in values:
                    carried[field] = values[field]
                elif field in carried:
                    values[field] = carried[field]

            # 환율 관측이 없는 날(주말·휴일, 혹은 월간 시리즈만 있는 날)은 행을 만들지 않는다.
            if _ANCHOR_FIELD not in values:
                continue

            us_3m, jp_3m = values.get("us_3m"), values.get("jp_3m")
            rows.append(FREDCarryFundingStressData(
                date=date_str,
                usdjpy=values.get("usdjpy"),
                us_3m=us_3m,
                jp_3m=jp_3m,
                rate_diff=(
                    round(us_3m - jp_3m, 3)
                    if (us_3m is not None and jp_3m is not None) else None
                ),
                cb_swap_musd=values.get("cb_swap_musd"),
                vix=values.get("vix"),
            ))
        return rows
