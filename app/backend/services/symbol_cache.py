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

    async def _fetch_from_api(self):
        api_key = os.environ.get("FMP_API_KEY", "")
        if not api_key:
            logger.error("FMP_API_KEY not set, cannot fetch symbol list")
            return

        def _do_fetch():
            url = f"{_FMP_BASE}/stock-list"
            resp = requests.get(url, params={"apikey": api_key}, timeout=60)
            resp.raise_for_status()
            return resp.json()

        try:
            raw = await asyncio.get_event_loop().run_in_executor(None, _do_fetch)
        except Exception as e:
            logger.error(f"FMP stock-list API failed: {e}")
            return

        if not isinstance(raw, list):
            logger.error(f"Unexpected FMP response type: {type(raw)}")
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
