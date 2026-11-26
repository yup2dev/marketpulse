"""Polygon.io Order Book — 최근 NBBO quote를 가격 레벨로 집계한 근사 호가.

1. /v3/quotes/{ticker} 최근 quote 300건을 tick 단위 레벨로 묶는다
   (레벨별 관측 최대 잔량 — 같은 주문의 중복 합산 방지).
2. 실패하거나 비면 /v2/snapshot 의 lastQuote(최우선 호가 1레벨)로 폴백.
둘 다 실패하면 예외를 올린다(QueryExecutor 서킷브레이커·에러 응답이 처리).
"""
import logging
from collections import defaultdict
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.orderbook import (
    OrderBookData,
    OrderBookQueryParams,
)
from data_fetcher.utils.api_keys import get_api_key
from data_fetcher.utils.provider_helpers import amake_json_request as amake_request

log = logging.getLogger(__name__)

POLYGON_BASE = "https://api.polygon.io"


def _tick(price: float) -> float:
    """미국 주식 표준 호가 단위."""
    return 0.01 if price >= 1 else 0.0001


def aggregate_quotes(results: List[Dict[str, Any]], depth: int) -> Dict[str, Any]:
    """NBBO quote 목록(최신순) → 가격 레벨별 bid/ask."""
    best_bid = results[0].get("bid_price")
    best_ask = results[0].get("ask_price")
    tick = _tick(best_ask or best_bid or 100.0)

    bid_levels: Dict[float, float] = defaultdict(float)
    ask_levels: Dict[float, float] = defaultdict(float)
    for q in results:
        bp, bs = q.get("bid_price") or 0, q.get("bid_size") or 0
        ap, as_ = q.get("ask_price") or 0, q.get("ask_size") or 0
        if bp > 0 and bs > 0:
            lvl = round(round(bp / tick) * tick, 6)
            bid_levels[lvl] = max(bid_levels[lvl], bs)
        if ap > 0 and as_ > 0:
            lvl = round(round(ap / tick) * tick, 6)
            ask_levels[lvl] = max(ask_levels[lvl], as_)

    bids = sorted(({"price": p, "size": int(s)} for p, s in bid_levels.items()),
                  key=lambda x: x["price"], reverse=True)[:depth]
    asks = sorted(({"price": p, "size": int(s)} for p, s in ask_levels.items()),
                  key=lambda x: x["price"])[:depth]
    return {"bids": bids, "asks": asks, "best_bid": best_bid, "best_ask": best_ask, "source": "quotes"}


def from_snapshot(data: Dict[str, Any]) -> Dict[str, Any]:
    """snapshot lastQuote → 최우선 호가 1레벨."""
    lq = (data.get("ticker") or {}).get("lastQuote") or {}
    best_bid = lq.get("p") or lq.get("bp")
    best_ask = lq.get("P") or lq.get("ap")
    bid_size = int(lq.get("s") or lq.get("bs") or 0)
    ask_size = int(lq.get("S") or lq.get("as") or 0)
    return {
        "bids": [{"price": best_bid, "size": bid_size}] if best_bid else [],
        "asks": [{"price": best_ask, "size": ask_size}] if best_ask else [],
        "best_bid": best_bid,
        "best_ask": best_ask,
        "source": "snapshot",
    }


class PolygonOrderBookFetcher(ApiFetcher[OrderBookQueryParams, OrderBookData]):
    """Polygon.io 근사 호가 Fetcher"""

    api_name = "Polygon"
    api_key_env = "POLYGON_API_KEY"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> OrderBookQueryParams:
        q = OrderBookQueryParams(**params)
        q.symbol = q.symbol.upper()
        return q

    @staticmethod
    async def aextract_data(
        query: OrderBookQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        api_key = get_api_key(credentials=credentials, api_name="Polygon.io", env_var="POLYGON_API_KEY")

        try:
            data = await amake_request(
                f"{POLYGON_BASE}/v3/quotes/{query.symbol}",
                params={"limit": 300, "order": "desc", "apiKey": api_key},
                timeout=10,
            )
            results = data.get("results") or []
            if results:
                return aggregate_quotes(results, query.depth)
        except Exception as e:   # 무료 플랜은 quotes 권한이 없다 → snapshot 폴백
            log.warning("[orderbook] v3/quotes failed for %s: %s", query.symbol, e)

        data = await amake_request(
            f"{POLYGON_BASE}/v2/snapshot/locale/us/markets/stocks/tickers/{query.symbol}",
            params={"apiKey": api_key},
            timeout=10,
        )
        return from_snapshot(data)

    @staticmethod
    def transform_data(query: OrderBookQueryParams, data: Dict[str, Any], **kwargs: Any) -> List[OrderBookData]:
        return [OrderBookData(symbol=query.symbol, **data)]
