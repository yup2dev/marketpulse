"""NASDAQ Trader Listing Fetcher — NYSE/NASDAQ 전 종목 (무료·공개)

NASDAQ Trader Symbol Directory 공개 파일을 파싱해 거래소 상장 전 종목을 입수한다.
지수(NASDAQ-100 등) 부분집합이 아니라 거래소 상장 *전체* 유니버스다.

소스 (pipe-delimited, 일 갱신):
    nasdaqlisted.txt  — NASDAQ 상장 종목
    otherlisted.txt   — NYSE / NYSE American / ARCA 등 (Exchange 컬럼으로 구분)

키 불필요(credentials=[]).
"""
import logging
from typing import Any, Dict, List, Optional

import requests

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.abstract_provider.standard_models import (
    StockListQueryParams,
    StockListData,
)

log = logging.getLogger(__name__)

_BASE = "https://www.nasdaqtrader.com/dynamic/SymDir"
_NASDAQ_LISTED = f"{_BASE}/nasdaqlisted.txt"
_OTHER_LISTED = f"{_BASE}/otherlisted.txt"

# otherlisted.txt 의 Exchange 코드 → 거래소 명
_OTHER_EXCHANGE = {
    "A": "NYSE MKT",     # NYSE American (구 AMEX)
    "N": "NYSE",         # New York Stock Exchange
    "P": "NYSE ARCA",
    "Z": "BATS",
    "V": "IEX",
}

# ETF venue(market 파라미터) → otherlisted Exchange 코드.
# 'NASDAQ' 는 nasdaqlisted.txt(ETF=Y)에서 별도 처리.
_ETF_VENUE_TO_CODE = {
    "NYSE_ARCA": "P",
    "NYSE_AMERICAN": "A",
    "CBOE_BZX": "Z",
    "IEX": "V",
}


# ── QueryParams / Data ────────────────────────────────────────────────────────

class NasdaqTraderListingQueryParams(StockListQueryParams):
    """market: 'NASDAQ' | 'NYSE' (otherlisted 의 Exchange='N')"""
    pass


class NasdaqTraderListingData(StockListData):
    """NASDAQ Trader 종목 (StockListData 표준 상속)"""
    pass


# ── Fetcher ───────────────────────────────────────────────────────────────────

class NasdaqTraderListingFetcher(
    Fetcher[NasdaqTraderListingQueryParams, NasdaqTraderListingData]
):
    """NYSE/NASDAQ 전 종목 리스트 Fetcher (무료)"""

    require_credentials = False

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> NasdaqTraderListingQueryParams:
        return NasdaqTraderListingQueryParams(**params)

    @staticmethod
    def _download(url: str) -> List[Dict[str, str]]:
        """pipe-delimited 파일을 dict 리스트로 파싱 (footer 'File Creation Time' 제외)."""
        resp = requests.get(url, timeout=30, headers={"User-Agent": "MarketPulse/1.0"})
        resp.raise_for_status()
        lines = [ln for ln in resp.text.splitlines() if ln.strip()]
        if not lines:
            return []
        header = lines[0].split("|")
        rows: List[Dict[str, str]] = []
        for line in lines[1:]:
            if line.startswith("File Creation Time"):
                continue
            cells = line.split("|")
            if len(cells) != len(header):
                continue
            rows.append(dict(zip(header, cells)))
        return rows

    @classmethod
    def extract_data(
        cls,
        query: NasdaqTraderListingQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        market = (query.market or "NASDAQ").upper()
        want_etf = (query.asset_class or "stock").lower() == "etf"

        # ── ETF ───────────────────────────────────────────────────────────────
        if want_etf:
            if market == "NASDAQ":
                raw = cls._download(_NASDAQ_LISTED)
                out = []
                for r in raw:
                    if r.get("Test Issue") == "Y" or r.get("ETF") != "Y":
                        continue
                    out.append({
                        "ticker_cd": r.get("Symbol", "").strip(),
                        "ticker_nm": r.get("Security Name", "").strip(),
                        "exchange": "NASDAQ",
                    })
                log.info("[NasdaqTrader] NASDAQ ETF %d개", len(out))
                return out

            code = _ETF_VENUE_TO_CODE.get(market)
            if not code:
                raise ValueError(f"Unsupported ETF venue for nasdaqtrader: {market}")
            raw = cls._download(_OTHER_LISTED)
            venue_nm = _OTHER_EXCHANGE.get(code, market)
            out = []
            for r in raw:
                if r.get("Test Issue") == "Y" or r.get("ETF") != "Y":
                    continue
                if r.get("Exchange") != code:
                    continue
                out.append({
                    "ticker_cd": (r.get("ACT Symbol") or r.get("CQS Symbol", "")).strip(),
                    "ticker_nm": r.get("Security Name", "").strip(),
                    "exchange": venue_nm,
                })
            log.info("[NasdaqTrader] %s ETF %d개", market, len(out))
            return out

        # ── Stock ─────────────────────────────────────────────────────────────
        if market == "NASDAQ":
            raw = cls._download(_NASDAQ_LISTED)
            out = []
            for r in raw:
                if r.get("Test Issue") == "Y" or r.get("ETF") == "Y":
                    continue
                out.append({
                    "ticker_cd": r.get("Symbol", "").strip(),
                    "ticker_nm": r.get("Security Name", "").strip(),
                    "exchange": "NASDAQ",
                })
            log.info("[NasdaqTrader] NASDAQ 종목 %d개", len(out))
            return out

        if market == "NYSE":
            raw = cls._download(_OTHER_LISTED)
            out = []
            for r in raw:
                if r.get("Test Issue") == "Y" or r.get("ETF") == "Y":
                    continue
                # NYSE 본 거래소(Exchange 코드 'N')만 — ARCA/AMEX/BATS 제외
                if r.get("Exchange") != "N":
                    continue
                out.append({
                    "ticker_cd": (r.get("ACT Symbol") or r.get("CQS Symbol", "")).strip(),
                    "ticker_nm": r.get("Security Name", "").strip(),
                    "exchange": "NYSE",
                })
            log.info("[NasdaqTrader] NYSE 종목 %d개", len(out))
            return out

        raise ValueError(f"Unsupported market for nasdaqtrader: {market}")

    @staticmethod
    def transform_data(
        query: NasdaqTraderListingQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[NasdaqTraderListingData]:
        asset_type = "etf" if (query.asset_class or "stock").lower() == "etf" else "stock"
        results: List[NasdaqTraderListingData] = []
        for item in data:
            ticker = item.get("ticker_cd", "")
            if not ticker:
                continue
            results.append(
                NasdaqTraderListingData(
                    ticker_cd=ticker,
                    ticker_nm=item.get("ticker_nm") or ticker,
                    asset_type=asset_type,
                    exchange=item.get("exchange"),
                    country="US",
                    curr="USD",
                    is_active=True,
                )
            )
        log.info("[NasdaqTrader] transformed %d %ss", len(results), asset_type)
        return results