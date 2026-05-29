"""Inflation Momentum Fetcher — CPIAUCSL 기반 12M/6M/3M 연율화 변화율."""
import logging
from datetime import date as date_type
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.fetchers.fred.series import FredSeriesFetcher
from data_fetcher.models.fred.inflation_momentum import InflationMomentumData, InflationMomentumQueryParams
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


class FREDInflationMomentumFetcher(Fetcher[InflationMomentumQueryParams, InflationMomentumData]):
    """CPI 모멘텀 — 12M/6M/3M 연율화 변화율 시계열."""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> InflationMomentumQueryParams:
        return InflationMomentumQueryParams(**params)

    @staticmethod
    def extract_data(
        query: InflationMomentumQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict]:
        api_key = get_api_key(credentials=credentials, api_name="FRED", env_var="FRED_API_KEY")
        # YoY 계산을 위해 start_date를 13개월 앞으로 확장
        extended_start: Optional[date_type] = None
        if query.start_date:
            from dateutil.relativedelta import relativedelta
            extended_start = query.start_date - relativedelta(months=13)
        return FredSeriesFetcher.fetch_series(
            series_id="CPIAUCSL",
            api_key=api_key,
            start_date=extended_start,
            end_date=query.end_date,
            sort_order="asc",
        )

    @staticmethod
    def transform_data(
        query: InflationMomentumQueryParams,
        data: List[Dict],
        **kwargs: Any,
    ) -> List[InflationMomentumData]:
        cpi_data = [
            {"date": o["date"], "value": float(o["value"])}
            for o in data
            if o.get("value") not in (None, ".", "")
        ]

        results = []
        for i, row in enumerate(cpi_data):
            point: Dict[str, Any] = {"date": row["date"]}
            val = row["value"]

            # 12M YoY
            if i >= 12:
                prev = cpi_data[i - 12]["value"]
                if prev:
                    point["yoy_12m"] = round((val / prev - 1) * 100, 2)

            # 6M 연율화
            if i >= 6:
                prev6 = cpi_data[i - 6]["value"]
                if prev6:
                    change_6m = val / prev6 - 1
                    point["yoy_6m"] = round(((1 + change_6m) ** 2 - 1) * 100, 2)

            # 3M 연율화
            if i >= 3:
                prev3 = cpi_data[i - 3]["value"]
                if prev3:
                    change_3m = val / prev3 - 1
                    point["yoy_3m"] = round(((1 + change_3m) ** 4 - 1) * 100, 2)

            # start_date 이후 + 최소 YoY 있는 포인트만 포함
            if "yoy_12m" not in point:
                continue
            if query.start_date and row["date"] < query.start_date.isoformat():
                continue
            results.append(InflationMomentumData(**point))

        return results
