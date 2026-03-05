"""
Polygon.io Order Book Fetcher
Aggregates recent NBBO quotes into bid/ask price levels.
Falls back to snapshot endpoint if quotes are unavailable.
"""
import os
import logging
import requests
from collections import defaultdict

log = logging.getLogger(__name__)

POLYGON_BASE = "https://api.polygon.io"


def _tick(price: float) -> float:
    """Standard US equity tick size."""
    if price >= 1:
        return 0.01
    return 0.0001


def fetch_stock_orderbook(symbol: str) -> dict:
    """
    Build an approximate order book for a US stock using Polygon.io.

    Strategy:
      1. Fetch recent NBBO quotes via /v3/quotes/{ticker} and aggregate by price level.
         Each price level keeps the maximum observed size (avoids double-counting).
      2. If that fails, fall back to the snapshot endpoint for best bid/ask only.

    Returns:
        {
          "symbol": str,
          "bids": [{"price": float, "size": int}, ...],   # descending
          "asks": [{"price": float, "size": int}, ...],   # ascending
          "best_bid": float | None,
          "best_ask": float | None,
          "source": "quotes" | "snapshot" | "error",
        }
    """
    api_key = os.getenv("POLYGON_API_KEY", "")

    # ── 1. Try v3/quotes ───────────────────────────────────────────────────────
    try:
        url = f"{POLYGON_BASE}/v3/quotes/{symbol}"
        resp = requests.get(
            url,
            params={"limit": 300, "order": "desc", "apiKey": api_key},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            results = data.get("results", [])

            if results:
                best_bid = results[0].get("bid_price")
                best_ask = results[0].get("ask_price")
                ref_price = best_ask or best_bid or 100.0
                tick = _tick(ref_price)

                bid_levels: dict[float, float] = defaultdict(float)
                ask_levels: dict[float, float] = defaultdict(float)

                for q in results:
                    bp, bs = q.get("bid_price", 0), q.get("bid_size", 0)
                    ap, as_ = q.get("ask_price", 0), q.get("ask_size", 0)
                    if bp > 0 and bs > 0:
                        lvl = round(round(bp / tick) * tick, 6)
                        bid_levels[lvl] = max(bid_levels[lvl], bs)
                    if ap > 0 and as_ > 0:
                        lvl = round(round(ap / tick) * tick, 6)
                        ask_levels[lvl] = max(ask_levels[lvl], as_)

                bids = sorted(
                    [{"price": p, "size": int(s)} for p, s in bid_levels.items()],
                    key=lambda x: x["price"], reverse=True
                )[:15]
                asks = sorted(
                    [{"price": p, "size": int(s)} for p, s in ask_levels.items()],
                    key=lambda x: x["price"]
                )[:15]

                return {
                    "symbol": symbol,
                    "bids": bids,
                    "asks": asks,
                    "best_bid": best_bid,
                    "best_ask": best_ask,
                    "source": "quotes",
                }
    except Exception as e:
        log.warning(f"[orderbook] v3/quotes failed for {symbol}: {e}")

    # ── 2. Fallback: snapshot ──────────────────────────────────────────────────
    try:
        url = f"{POLYGON_BASE}/v2/snapshot/locale/us/markets/stocks/tickers/{symbol}"
        resp = requests.get(url, params={"apiKey": api_key}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            ticker = data.get("ticker", {})
            lq = ticker.get("lastQuote", {})

            best_bid = lq.get("p") or lq.get("bp")
            best_ask = lq.get("P") or lq.get("ap")
            bid_size = int((lq.get("s") or lq.get("bs") or 0))
            ask_size = int((lq.get("S") or lq.get("as") or 0))

            bids = [{"price": best_bid, "size": bid_size}] if best_bid else []
            asks = [{"price": best_ask, "size": ask_size}] if best_ask else []

            return {
                "symbol": symbol,
                "bids": bids,
                "asks": asks,
                "best_bid": best_bid,
                "best_ask": best_ask,
                "source": "snapshot",
            }
    except Exception as e:
        log.warning(f"[orderbook] snapshot failed for {symbol}: {e}")

    return {"symbol": symbol, "bids": [], "asks": [], "best_bid": None, "best_ask": None, "source": "error"}
