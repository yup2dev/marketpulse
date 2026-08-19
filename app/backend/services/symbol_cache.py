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


# 주요 지수 — DB 유니버스(stock_list)에는 개별 종목만 있고 지수가 없어서 검색에 안 잡혔다.
# Advanced Chart 등 TickerSearch를 쓰는 모든 화면에서 지수를 못 고르던 원인이라 여기서 보충한다.
# name에 영문·한글 별칭을 같이 넣어야 search()의 name 부분일치로 양쪽 다 걸린다
# (search는 symbol 또는 name에 대해서만 매칭한다).
_INDICES: List[Dict[str, str]] = [
    {"symbol": "^GSPC",  "name": "S&P 500 에스앤피500",              "exchange": "INDEX", "currency": "USD", "type": "index"},
    {"symbol": "^IXIC",  "name": "NASDAQ Composite 나스닥 종합",      "exchange": "INDEX", "currency": "USD", "type": "index"},
    {"symbol": "^DJI",   "name": "Dow Jones 다우존스 산업평균",        "exchange": "INDEX", "currency": "USD", "type": "index"},
    {"symbol": "^RUT",   "name": "Russell 2000 러셀2000",            "exchange": "INDEX", "currency": "USD", "type": "index"},
    {"symbol": "^VIX",   "name": "CBOE Volatility Index VIX 변동성",  "exchange": "INDEX", "currency": "USD", "type": "index"},
    {"symbol": "^N225",  "name": "Nikkei 225 닛케이225 일본",         "exchange": "INDEX", "currency": "JPY", "type": "index"},
    {"symbol": "^TOPX",  "name": "TOPIX 토픽스 일본",                 "exchange": "INDEX", "currency": "JPY", "type": "index"},
    {"symbol": "^FTSE",  "name": "FTSE 100 영국 런던",                "exchange": "INDEX", "currency": "GBP", "type": "index"},
    {"symbol": "^GDAXI", "name": "DAX 독일 닥스",                     "exchange": "INDEX", "currency": "EUR", "type": "index"},
    {"symbol": "^FCHI",  "name": "CAC 40 프랑스",                     "exchange": "INDEX", "currency": "EUR", "type": "index"},
    {"symbol": "^STOXX50E", "name": "Euro Stoxx 50 유로스톡스50",     "exchange": "INDEX", "currency": "EUR", "type": "index"},
    {"symbol": "^HSI",   "name": "Hang Seng 항셍 홍콩",               "exchange": "INDEX", "currency": "HKD", "type": "index"},
    {"symbol": "000001.SS", "name": "SSE Composite 상해종합 중국",    "exchange": "INDEX", "currency": "CNY", "type": "index"},
    {"symbol": "^KS11",  "name": "KOSPI 코스피 한국",                 "exchange": "INDEX", "currency": "KRW", "type": "index"},
    {"symbol": "^KQ11",  "name": "KOSDAQ 코스닥 한국",                "exchange": "INDEX", "currency": "KRW", "type": "index"},
    {"symbol": "^BSESN", "name": "SENSEX 인도 센섹스",                "exchange": "INDEX", "currency": "INR", "type": "index"},
    {"symbol": "^AXJO",  "name": "ASX 200 호주",                      "exchange": "INDEX", "currency": "AUD", "type": "index"},
    {"symbol": "^BVSP",  "name": "Bovespa 브라질 보베스파",           "exchange": "INDEX", "currency": "BRL", "type": "index"},
    {"symbol": "^TNX",   "name": "US 10Y Treasury Yield 미국10년물",  "exchange": "INDEX", "currency": "USD", "type": "index"},
    {"symbol": "DX-Y.NYB", "name": "US Dollar Index 달러인덱스 DXY",  "exchange": "INDEX", "currency": "USD", "type": "index"},
]


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
                logger.info(f"Symbol cache loaded from DB universe: {len(symbols)} symbols")
            else:
                logger.warning("Symbol cache: DB universe returned no symbols")
        except Exception as e:
            symbols = []
            logger.error(f"Failed to load symbol cache from DB universe: {e}")
        finally:
            self._loading = False

        # 지수는 DB 유니버스와 무관하게 항상 제공한다 — DB 적재가 실패해도 지수 검색은 살아 있어야
        # Advanced Chart에서 최소한 지수는 고를 수 있다. 지수를 앞에 둬야 동점 시 먼저 노출된다.
        self._symbols = _INDICES + symbols
        self._loaded_at = time.time()
        self._build_index()

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
