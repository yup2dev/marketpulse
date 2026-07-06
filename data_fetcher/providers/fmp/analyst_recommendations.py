"""FMP Analyst Recommendations — QueryParams + Data + Fetcher"""
import logging
from datetime import date as date_type
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models import (
    AnalystRecommendationsQueryParams as _StdAnalystRecsQueryParams,
    AnalystRecommendationsData as _StdAnalystRecsData,
)
from data_fetcher.utils.api_keys import get_api_key
from data_fetcher.utils.async_http_client import amake_request, HTTPClientError

log = logging.getLogger(__name__)

FMP_STABLE_BASE = "https://financialmodelingprep.com/stable"


# ── QueryParams ───────────────────────────────────────────────────────────────

class AnalystRecommendationsQueryParams(_StdAnalystRecsQueryParams):
    pass


# ── Data ──────────────────────────────────────────────────────────────────────

class AnalystRecommendationsData(_StdAnalystRecsData):
    """FMP 애널리스트 추천 — 표준 모델 상속, FMP alias 매핑 유지"""
    # FMP API 필드명 별칭 (표준 필드명과 다른 경우)
    analyst_rating_strong_buy: Optional[int] = Field(default=None, description="Strong Buy 추천 수")
    analyst_rating_buy: Optional[int] = Field(default=None, description="Buy 추천 수")
    analyst_rating_hold: Optional[int] = Field(default=None, description="Hold 추천 수")
    analyst_rating_sell: Optional[int] = Field(default=None, description="Sell 추천 수")
    analyst_rating_strong_sell: Optional[int] = Field(default=None, description="Strong Sell 추천 수")
    analyst_rating_consensus: Optional[str] = Field(default=None, description="컨센서스 등급")
    analyst_target_price: Optional[float] = Field(default=None, description="목표주가")
    analyst_target_price_min: Optional[float] = Field(default=None, description="최소 목표주가")
    analyst_target_price_max: Optional[float] = Field(default=None, description="최대 목표주가")
    analyst_target_price_avg: Optional[float] = Field(default=None, description="평균 목표주가")
    analyst_target_price_median: Optional[float] = Field(default=None, description="중간 목표주가")

    __alias_dict__ = {
        "analyst_rating_consensus": "consensus_grade",
        "analyst_target_price": "priceTarget",
        "number_of_analysts": "numberOfAnalysts",
    }


# ── Fetcher ───────────────────────────────────────────────────────────────────

class FMPAnalystRecommendationsFetcher(
    ApiFetcher[AnalystRecommendationsQueryParams, AnalystRecommendationsData]
):
    """FMP 애널리스트 추천 등급 Fetcher"""

    api_name = "FMP"
    api_key_env = "FMP_API_KEY"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> AnalystRecommendationsQueryParams:
        return AnalystRecommendationsQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: AnalystRecommendationsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        try:
            api_key = get_api_key(credentials=credentials, api_name="FMP", env_var="FMP_API_KEY")
            params_grade = {"symbol": query.symbol, "apikey": api_key, "limit": query.limit or 100}
            params_target = {"symbol": query.symbol, "apikey": api_key}
            grade_data = await amake_request(f"{FMP_STABLE_BASE}/grades", params=params_grade, timeout=30)
            target_data = await amake_request(f"{FMP_STABLE_BASE}/price-target-consensus", params=params_target, timeout=30)
            combined_data = []
            if isinstance(grade_data, list):
                for item in grade_data:
                    item['source'] = 'grade'
                    combined_data.append(item)
            if isinstance(target_data, list):
                for item in target_data:
                    item['source'] = 'price_target'
                    combined_data.append(item)
            return combined_data
        except HTTPClientError as e:
            log.error(f"Error fetching analyst recommendations from FMP for {query.symbol}: {e}")
            raise
        except Exception as e:
            log.error(f"Unexpected error: {e}")
            raise

    @staticmethod
    def transform_data(
        query: AnalystRecommendationsQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[AnalystRecommendationsData]:
        results: List[AnalystRecommendationsData] = []
        for item in data:
            date_val = item.get("date") or (item.get("publishedDate") or "")[:10] or None
            if not date_val:
                continue
            normalized = {
                "symbol": item.get("symbol", query.symbol),
                "date": date_val,
                "analyst_name": item.get("gradingCompany") or item.get("analystName"),
                "analyst_company": item.get("gradingCompany") or item.get("analystCompany"),
                "consensus_grade": item.get("newGrade") or item.get("previousGrade"),
                "priceTarget": item.get("priceTarget") or item.get("adjPriceTarget"),
                "numberOfAnalysts": item.get("numberOfAnalysts") or item.get("numberOfAnalystsOpinions"),
            }
            results.append(AnalystRecommendationsData.model_validate(normalized))
        return results
