"""Sentiment History Fetcher — VIX + HY Spread → fear/greed score."""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.fetchers.fred.series import FredSeriesFetcher
from data_fetcher.models.fred.sentiment_history import SentimentHistoryData, SentimentHistoryQueryParams
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


def _vix_to_score(vix: float) -> float:
    if vix < 15:   return 100 - ((vix - 10) / 5) * 30
    if vix < 20:   return 70  - ((vix - 15) / 5) * 40
    if vix < 30:   return 30  - ((vix - 20) / 10) * 20
    return max(0, 10 - ((vix - 30) / 10) * 10)


def _hy_to_score(hy: float) -> float:
    if hy < 300:   return 100 - ((300 - hy) / 100) * 20
    if hy < 500:   return 80  - ((hy - 300) / 200) * 50
    return max(0, 30 - ((hy - 500) / 500) * 30)


class FREDSentimentHistoryFetcher(Fetcher[SentimentHistoryQueryParams, SentimentHistoryData]):
    """시장 심리 시계열 — VIX + HY 스프레드 기반 공포-탐욕 지수."""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> SentimentHistoryQueryParams:
        return SentimentHistoryQueryParams(**params)

    @staticmethod
    def extract_data(
        query: SentimentHistoryQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, List[Dict]]:
        api_key = get_api_key(credentials=credentials, api_name="FRED", env_var="FRED_API_KEY")
        raw: Dict[str, List[Dict]] = {}
        for key, series_id in [("vix", "VIXCLS"), ("hy", "BAMLH0A0HYM2")]:
            try:
                raw[key] = FredSeriesFetcher.fetch_series(
                    series_id=series_id,
                    api_key=api_key,
                    start_date=query.start_date,
                    end_date=query.end_date,
                    sort_order="asc",
                )
            except Exception as e:
                log.warning(f"[SentimentHistory] {series_id} failed: {e}")
                raw[key] = []
        return raw

    @staticmethod
    def transform_data(
        query: SentimentHistoryQueryParams,
        data: Dict[str, List[Dict]],
        **kwargs: Any,
    ) -> List[SentimentHistoryData]:
        vix_dict = {
            o["date"]: float(o["value"])
            for o in data.get("vix", [])
            if o.get("value") not in (None, ".", "")
        }
        hy_dict = {
            o["date"]: float(o["value"])
            for o in data.get("hy", [])
            if o.get("value") not in (None, ".", "")
        }

        all_dates = sorted(set(vix_dict) | set(hy_dict))
        results = []
        for date_str in all_dates:
            vix = vix_dict.get(date_str)
            hy = hy_dict.get(date_str)
            scores = []
            if vix is not None: scores.append(_vix_to_score(vix))
            if hy  is not None: scores.append(_hy_to_score(hy))

            if not scores:
                continue
            results.append(SentimentHistoryData(
                date=date_str,
                vix=round(vix, 2) if vix is not None else None,
                hy_spread=round(hy, 2) if hy is not None else None,
                fear_greed_score=round(sum(scores) / len(scores), 1),
            ))
        return results
