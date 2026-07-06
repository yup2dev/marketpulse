"""FMP Revenue Segments — QueryParams + Data + Fetcher"""
import logging
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.revenue_segments import (
    RevenueSegmentDetailData as FMPSegmentData,
    RevenueSegmentsQueryParams,
    RevenueSegmentsData,
)
from data_fetcher.utils.api_keys import get_api_key
from data_fetcher.utils.provider_helpers import amake_json_request as amake_request

log = logging.getLogger(__name__)

FMP_STABLE_BASE = "https://financialmodelingprep.com/stable"
_HEADERS = {'User-Agent': 'MarketPulse/1.0'}


# ── QueryParams / Data (standard RevenueSegments 경유) ─────────────────────────

class FMPRevenueSegmentsQueryParams(RevenueSegmentsQueryParams):
    """매출 세그먼트 조회 파라미터 (standard RevenueSegments 경유)"""


class FMPRevenueSegmentsData(RevenueSegmentsData):
    """제품/지역별 매출 분류 통합 데이터 (standard RevenueSegments 경유)"""


# ── helpers ───────────────────────────────────────────────────────────────────

async def _fetch_raw(endpoint: str, symbol: str, api_key: str) -> List[Dict]:
    try:
        data = await amake_request(
            f'{FMP_STABLE_BASE}/{endpoint}',
            params={'symbol': symbol, 'period': 'annual', 'apikey': api_key},
            headers=_HEADERS,
            timeout=15,
        )
        return data or []
    except Exception as e:
        log.warning(f"FMP segment fetch failed ({endpoint}): {e}")
        return []


def _normalize(raw: List[Dict], limit: int) -> Optional[FMPSegmentData]:
    sorted_raw = sorted(raw, key=lambda x: x.get('date', ''))[-limit:]
    if not sorted_raw:
        return None

    all_segs: set = set()
    for rec in sorted_raw:
        all_segs.update(rec.get('data', {}).keys())
    segments = sorted(all_segs)

    history = []
    for rec in sorted_raw:
        d = rec.get('data', {})
        total = sum(v for v in d.values() if isinstance(v, (int, float)))
        row: Dict[str, Any] = {'date': rec.get('date', ''), 'total': round(total / 1e9, 3)}
        for seg in segments:
            val = d.get(seg)
            row[seg] = round(val / 1e9, 3) if isinstance(val, (int, float)) else None
        history.append(row)

    latest = history[-1] if history else {}
    prior  = history[-2] if len(history) >= 2 else {}
    yoy: Dict[str, Optional[float]] = {}
    for seg in segments:
        cur = latest.get(seg)
        prv = prior.get(seg)
        yoy[seg] = round((cur - prv) / abs(prv) * 100, 1) if (cur is not None and prv and prv != 0) else None

    return FMPSegmentData(segments=segments, history=history, latest=latest, yoy=yoy)


# ── Fetcher ───────────────────────────────────────────────────────────────────

class FMPRevenueSegmentsFetcher(ApiFetcher[FMPRevenueSegmentsQueryParams, FMPRevenueSegmentsData]):

    api_name = "FMP"
    api_key_env = "FMP_API_KEY"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FMPRevenueSegmentsQueryParams:
        return FMPRevenueSegmentsQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: FMPRevenueSegmentsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        api_key = get_api_key(credentials=credentials, api_name='FMP', env_var='FMP_API_KEY')
        return {
            'product': await _fetch_raw('revenue-product-segmentation', query.symbol, api_key),
            'geo':     await _fetch_raw('revenue-geographic-segmentation', query.symbol, api_key),
            'limit':   query.limit,
        }

    @staticmethod
    def transform_data(
        query: FMPRevenueSegmentsQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> List[FMPRevenueSegmentsData]:
        limit   = data.get('limit', query.limit)
        product = _normalize(data.get('product') or [], limit)
        geo     = _normalize(data.get('geo') or [], limit)
        return [FMPRevenueSegmentsData(
            symbol=query.symbol,
            product=product,
            geo=geo,
            has_product=product is not None,
            has_geo=geo is not None,
        )]
