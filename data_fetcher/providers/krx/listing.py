"""KRX Listing Fetcher — KOSPI/KOSDAQ 전 종목·ETF (무료, 로그인 불필요)

KRX 데이터 포털(pykrx)이 로그인을 요구하게 되어, 로그인 없는 공개 소스를 사용한다.
  · 주식: KRX KIND 상장법인목록 다운로드 (회사명/종목코드/업종)
  · ETF : Naver Finance etfItemList (전 ETF 코드/명)
키 불필요(credentials=[]).
"""
import logging
from io import StringIO
from typing import Any, Dict, List, Optional

import requests

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.abstract_provider.standard_models import (
    StockListQueryParams,
    StockListData,
)

log = logging.getLogger(__name__)

_VALID_MARKETS = {"KOSPI", "KOSDAQ"}
_KIND_URL = "http://kind.krx.co.kr/corpgeneral/corpList.do"
_KIND_MARKET = {"KOSPI": "stockMkt", "KOSDAQ": "kosdaqMkt"}
_NAVER_ETF_URL = "https://finance.naver.com/api/sise/etfItemList.nhn"
_UA = "Mozilla/5.0 (compatible; MarketPulse/1.0)"


class KRXListingQueryParams(StockListQueryParams):
    """market: 'KOSPI' | 'KOSDAQ' (asset_class='etf' 면 market 무시)"""
    pass


class KRXListingData(StockListData):
    """KRX 종목/ETF (StockListData 표준 상속)"""
    pass


def _fetch_kind_stocks(market: str) -> List[Dict[str, Any]]:
    """KRX KIND 상장법인목록 — KOSPI/KOSDAQ 전 종목."""
    import pandas as pd

    resp = requests.get(
        _KIND_URL,
        params={"method": "download", "marketType": _KIND_MARKET[market]},
        headers={"User-Agent": _UA},
        timeout=30,
    )
    resp.raise_for_status()
    df = pd.read_html(StringIO(resp.text))[0]
    out: List[Dict[str, Any]] = []
    for _, r in df.iterrows():
        code = str(r.get("종목코드", "")).strip().zfill(6)
        name = str(r.get("회사명", "")).strip()
        if not code or not name:
            continue
        sector = r.get("업종")
        out.append({
            "ticker_cd": code,
            "ticker_nm": name,
            "exchange": market,
            "sector": None if sector is None or str(sector) == "nan" else str(sector).strip(),
        })
    log.info("[KRX/KIND] %s 종목 %d개", market, len(out))
    return out


def _fetch_naver_etfs() -> List[Dict[str, Any]]:
    """Naver Finance — KR 전 ETF 코드/명."""
    resp = requests.get(
        _NAVER_ETF_URL,
        headers={"User-Agent": _UA, "Referer": "https://finance.naver.com/"},
        timeout=30,
    )
    resp.raise_for_status()
    items = (resp.json() or {}).get("result", {}).get("etfItemList", [])
    out: List[Dict[str, Any]] = []
    for it in items:
        code = str(it.get("itemcode", "")).strip()
        name = str(it.get("itemname", "")).strip()
        if not code or not name:
            continue
        out.append({"ticker_cd": code, "ticker_nm": name, "exchange": "KRX_ETF"})
    log.info("[KRX/Naver] ETF %d개", len(out))
    return out


class KRXListingFetcher(Fetcher[KRXListingQueryParams, KRXListingData]):
    """KOSPI/KOSDAQ 종목·ETF 리스트 Fetcher (무료, 로그인 불필요)"""

    require_credentials = False

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> KRXListingQueryParams:
        return KRXListingQueryParams(**params)

    @staticmethod
    def extract_data(
        query: KRXListingQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        if (query.asset_class or "stock").lower() == "etf":
            return _fetch_naver_etfs()

        market = (query.market or "KOSPI").upper()
        if market not in _VALID_MARKETS:
            raise ValueError(f"Unsupported market for krx: {market}")
        return _fetch_kind_stocks(market)

    @staticmethod
    def transform_data(
        query: KRXListingQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[KRXListingData]:
        asset_type = "etf" if (query.asset_class or "stock").lower() == "etf" else "stock"
        results: List[KRXListingData] = []
        for item in data:
            ticker = item.get("ticker_cd", "")
            if not ticker:
                continue
            results.append(
                KRXListingData(
                    ticker_cd=ticker,
                    ticker_nm=item.get("ticker_nm") or ticker,
                    asset_type=asset_type,
                    exchange=item.get("exchange"),
                    sector=item.get("sector"),
                    country="KR",
                    curr="KRW",
                    is_active=True,
                )
            )
        log.info("[KRX] transformed %d %ss", len(results), asset_type)
        return results
