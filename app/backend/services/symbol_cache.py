"""
In-memory symbol cache for fast autocomplete.

DB 유니버스(stock_list_service.get_stock_list → MBS_IN_STBD_MST, KR+US 전체)에서
종목 목록을 읽어 인메모리 인덱스를 구성한다. 검색은 순수 prefix/substring
매칭 — 외부 API 호출 없음.
"""
import logging
import time
from typing import Dict, List

from app.backend.services._base import to_quote_symbol

logger = logging.getLogger(__name__)

_REFRESH_INTERVAL = 3600  # stocks:all 캐시(1h TTL)와 동일 주기로 재로딩


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
            from app.backend.services.stock_list_service import get_stock_list

            stocks = await get_stock_list()
            symbols = [
                {
                    "symbol":   to_quote_symbol(s["ticker_cd"], s.get("exchange"), s.get("curr")),
                    "name":     s.get("ticker_nm") or s["ticker_cd"],
                    "exchange": s.get("exchange") or "",
                    "currency": s.get("curr") or "USD",
                    "type":     s.get("asset_type") or "stock",
                }
                for s in stocks
                if s.get("ticker_cd")
            ]
            if symbols:
                self._symbols = symbols
                self._loaded_at = time.time()
                self._build_index()
                logger.info(f"Symbol cache loaded from DB universe: {len(symbols)} symbols")
            else:
                logger.warning("Symbol cache: DB universe returned no symbols")
        except Exception as e:
            logger.error(f"Failed to load symbol cache from DB universe: {e}")
        finally:
            self._loading = False

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
