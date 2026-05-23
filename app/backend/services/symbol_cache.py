"""
In-memory symbol cache for fast autocomplete.

Loads the full stock list from FMP once at startup, refreshes daily.
Search is pure in-memory prefix + substring matching — no API calls.
"""
import asyncio
import logging
import os
import json
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger(__name__)

_CACHE_FILE = Path(__file__).parent.parent.parent.parent / "data" / "symbol_cache.json"
_FMP_BASE = "https://financialmodelingprep.com/stable"
_REFRESH_INTERVAL = 86400  # 24h


class SymbolCache:
    def __init__(self):
        self._symbols: List[Dict[str, str]] = []
        self._by_symbol: Dict[str, Dict[str, str]] = {}
        self._loaded_at: float = 0
        self._loading: bool = False

    @property
    def is_loaded(self) -> bool:
        return len(self._symbols) > 0

    @property
    def is_stale(self) -> bool:
        return (time.time() - self._loaded_at) > _REFRESH_INTERVAL

    async def ensure_loaded(self):
        if self.is_loaded and not self.is_stale:
            return
        if self._loading:
            return
        await self.load()

    async def load(self):
        self._loading = True
        try:
            if self._load_from_file():
                if not self.is_stale:
                    logger.info(f"Symbol cache loaded from file: {len(self._symbols)} symbols")
                    return

            await self._fetch_from_api()
        except Exception as e:
            logger.error(f"Failed to load symbol cache: {e}")
            if not self.is_loaded:
                self._load_from_file()
        finally:
            self._loading = False

    def _load_from_file(self) -> bool:
        try:
            if _CACHE_FILE.exists():
                data = json.loads(_CACHE_FILE.read_text(encoding="utf-8"))
                self._symbols = data.get("symbols", [])
                self._loaded_at = data.get("loaded_at", 0)
                self._build_index()
                return len(self._symbols) > 0
        except Exception as e:
            logger.warning(f"Failed to read cache file: {e}")
        return False

    def _save_to_file(self):
        try:
            _CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                "loaded_at": self._loaded_at,
                "count": len(self._symbols),
                "symbols": self._symbols,
            }
            _CACHE_FILE.write_text(
                json.dumps(payload, ensure_ascii=False),
                encoding="utf-8",
            )
            logger.info(f"Symbol cache saved: {len(self._symbols)} symbols")
        except Exception as e:
            logger.warning(f"Failed to save cache file: {e}")

    # 무료 플랜에서 stock-list 대신 사용할 기본 심볼 시드 (fallback)
    _SEED_SYMBOLS = [
        {"symbol": "AAPL",  "name": "Apple Inc.",               "exchange": "NASDAQ", "type": "stock"},
        {"symbol": "MSFT",  "name": "Microsoft Corporation",    "exchange": "NASDAQ", "type": "stock"},
        {"symbol": "NVDA",  "name": "NVIDIA Corporation",       "exchange": "NASDAQ", "type": "stock"},
        {"symbol": "GOOGL", "name": "Alphabet Inc.",            "exchange": "NASDAQ", "type": "stock"},
        {"symbol": "GOOG",  "name": "Alphabet Inc. Class C",    "exchange": "NASDAQ", "type": "stock"},
        {"symbol": "AMZN",  "name": "Amazon.com Inc.",          "exchange": "NASDAQ", "type": "stock"},
        {"symbol": "META",  "name": "Meta Platforms Inc.",      "exchange": "NASDAQ", "type": "stock"},
        {"symbol": "TSLA",  "name": "Tesla Inc.",               "exchange": "NASDAQ", "type": "stock"},
        {"symbol": "BRK.B", "name": "Berkshire Hathaway Inc.",  "exchange": "NYSE",   "type": "stock"},
        {"symbol": "JPM",   "name": "JPMorgan Chase & Co.",     "exchange": "NYSE",   "type": "stock"},
        {"symbol": "V",     "name": "Visa Inc.",                "exchange": "NYSE",   "type": "stock"},
        {"symbol": "MA",    "name": "Mastercard Inc.",          "exchange": "NYSE",   "type": "stock"},
        {"symbol": "JNJ",   "name": "Johnson & Johnson",        "exchange": "NYSE",   "type": "stock"},
        {"symbol": "XOM",   "name": "Exxon Mobil Corporation",  "exchange": "NYSE",   "type": "stock"},
        {"symbol": "UNH",   "name": "UnitedHealth Group Inc.",  "exchange": "NYSE",   "type": "stock"},
        {"symbol": "WMT",   "name": "Walmart Inc.",             "exchange": "NYSE",   "type": "stock"},
        {"symbol": "LLY",   "name": "Eli Lilly and Company",    "exchange": "NYSE",   "type": "stock"},
        {"symbol": "AVGO",  "name": "Broadcom Inc.",            "exchange": "NASDAQ", "type": "stock"},
        {"symbol": "AMD",   "name": "Advanced Micro Devices",   "exchange": "NASDAQ", "type": "stock"},
        {"symbol": "ORCL",  "name": "Oracle Corporation",       "exchange": "NYSE",   "type": "stock"},
        {"symbol": "INTC",  "name": "Intel Corporation",        "exchange": "NASDAQ", "type": "stock"},
        {"symbol": "CRM",   "name": "Salesforce Inc.",          "exchange": "NYSE",   "type": "stock"},
        {"symbol": "NFLX",  "name": "Netflix Inc.",             "exchange": "NASDAQ", "type": "stock"},
        {"symbol": "ADBE",  "name": "Adobe Inc.",               "exchange": "NASDAQ", "type": "stock"},
        {"symbol": "QCOM",  "name": "QUALCOMM Inc.",            "exchange": "NASDAQ", "type": "stock"},
        {"symbol": "TXN",   "name": "Texas Instruments Inc.",   "exchange": "NASDAQ", "type": "stock"},
        {"symbol": "PYPL",  "name": "PayPal Holdings Inc.",     "exchange": "NASDAQ", "type": "stock"},
        {"symbol": "COST",  "name": "Costco Wholesale Corp.",   "exchange": "NASDAQ", "type": "stock"},
        {"symbol": "PEP",   "name": "PepsiCo Inc.",             "exchange": "NASDAQ", "type": "stock"},
        {"symbol": "KO",    "name": "The Coca-Cola Company",    "exchange": "NYSE",   "type": "stock"},
        {"symbol": "PG",    "name": "Procter & Gamble Co.",     "exchange": "NYSE",   "type": "stock"},
        {"symbol": "BAC",   "name": "Bank of America Corp.",    "exchange": "NYSE",   "type": "stock"},
        {"symbol": "GS",    "name": "Goldman Sachs Group Inc.", "exchange": "NYSE",   "type": "stock"},
        {"symbol": "MS",    "name": "Morgan Stanley",           "exchange": "NYSE",   "type": "stock"},
        {"symbol": "CVX",   "name": "Chevron Corporation",      "exchange": "NYSE",   "type": "stock"},
        {"symbol": "HD",    "name": "The Home Depot Inc.",      "exchange": "NYSE",   "type": "stock"},
        {"symbol": "DIS",   "name": "The Walt Disney Company",  "exchange": "NYSE",   "type": "stock"},
        {"symbol": "UBER",  "name": "Uber Technologies Inc.",   "exchange": "NYSE",   "type": "stock"},
        {"symbol": "SPOT",  "name": "Spotify Technology S.A.", "exchange": "NYSE",   "type": "stock"},
        {"symbol": "SHOP",  "name": "Shopify Inc.",             "exchange": "NYSE",   "type": "stock"},
        {"symbol": "SQ",    "name": "Block Inc.",               "exchange": "NYSE",   "type": "stock"},
        {"symbol": "PLTR",  "name": "Palantir Technologies",    "exchange": "NYSE",   "type": "stock"},
        {"symbol": "ARM",   "name": "Arm Holdings plc",         "exchange": "NASDAQ", "type": "stock"},
        {"symbol": "SMCI",  "name": "Super Micro Computer",     "exchange": "NASDAQ", "type": "stock"},
        {"symbol": "SPY",   "name": "SPDR S&P 500 ETF Trust",  "exchange": "NYSE",   "type": "etf"},
        {"symbol": "QQQ",   "name": "Invesco QQQ Trust",        "exchange": "NASDAQ", "type": "etf"},
        {"symbol": "IWM",   "name": "iShares Russell 2000 ETF", "exchange": "NYSE",   "type": "etf"},
        {"symbol": "GLD",   "name": "SPDR Gold Shares",         "exchange": "NYSE",   "type": "etf"},
        {"symbol": "TLT",   "name": "iShares 20+ Year Treasury","exchange": "NASDAQ", "type": "etf"},
        {"symbol": "VIX",   "name": "CBOE Volatility Index",    "exchange": "INDEX",  "type": "index"},
    ]

    async def _fetch_from_api(self):
        api_key = os.environ.get("FMP_API_KEY", "")
        if not api_key:
            logger.warning("FMP_API_KEY not set — using seed symbol list for autocomplete")
            self._use_seed_fallback()
            return

        def _do_fetch():
            url = f"{_FMP_BASE}/stock-list"
            resp = requests.get(url, params={"apikey": api_key}, timeout=60)
            resp.raise_for_status()
            return resp.json()

        try:
            raw = await asyncio.get_event_loop().run_in_executor(None, _do_fetch)
        except Exception as e:
            logger.warning(
                f"FMP stock-list unavailable ({e}) — "
                "free tier may not include this endpoint; using seed symbol list"
            )
            self._use_seed_fallback()
            return

        if not isinstance(raw, list):
            logger.warning(f"Unexpected FMP stock-list response: {type(raw)} — using seed fallback")
            self._use_seed_fallback()
            return

        symbols = []
        for item in raw:
            symbol = item.get("symbol", "")
            name = item.get("name", "")
            if not symbol:
                continue
            symbols.append({
                "symbol": symbol,
                "name": name,
                "exchange": item.get("exchangeShortName", "") or item.get("exchange", ""),
                "type": item.get("type", ""),
            })

        if symbols:
            self._symbols = symbols
            self._loaded_at = time.time()
            self._build_index()
            self._save_to_file()
            logger.info(f"Symbol cache refreshed from API: {len(symbols)} symbols")

    def _use_seed_fallback(self):
        """API를 사용할 수 없을 때 정적 시드 리스트로 캐시를 채웁니다."""
        if not self.is_loaded:
            self._symbols = list(self._SEED_SYMBOLS)
            self._loaded_at = time.time()
            self._build_index()
            logger.info(f"Symbol cache seeded with {len(self._symbols)} fallback symbols")

    def _build_index(self):
        self._by_symbol = {s["symbol"].upper(): s for s in self._symbols}

    def search(self, query: str, limit: int = 10) -> List[Dict[str, str]]:
        if not query or not self._symbols:
            return []

        q = query.upper().strip()

        exact = self._by_symbol.get(q)

        prefix_matches = []
        substring_matches = []

        for s in self._symbols:
            sym_upper = s["symbol"].upper()
            name_upper = (s.get("name") or "").upper()

            if sym_upper == q:
                continue
            elif sym_upper.startswith(q):
                prefix_matches.append(s)
            elif q in sym_upper or q in name_upper:
                substring_matches.append(s)

            if len(prefix_matches) >= limit * 3:
                break

        prefix_matches.sort(key=lambda x: (
            0 if (x.get("exchange") or "") in ("NASDAQ", "NYSE") else 1,
            1 if "." in x["symbol"] else 0,
            len(x["symbol"]),
        ))

        substring_matches.sort(key=lambda x: (
            0 if (x.get("exchange") or "") in ("NASDAQ", "NYSE") else 1,
            len(x["symbol"]),
        ))

        results = []
        if exact:
            results.append(exact)
        results.extend(prefix_matches)
        results.extend(substring_matches)

        return results[:limit]


_instance = SymbolCache()


def get_symbol_cache() -> SymbolCache:
    return _instance
