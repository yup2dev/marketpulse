"""Yahoo Finance Company Peers Model (유사 종목)

Yahoo `recommendationsbysymbol` 엔드포인트로 유사 종목 코드를 받고,
종목별 yfinance `info`로 이름·섹터·산업을 채운다.

백엔드 `company_relations` 서비스가 DB(FMP peers)에 관계가 없을 때 fallback으로 쓴다.
"""
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional

import requests

from data_fetcher.abstract_provider.abstract.base_fetchers import YFinanceFetcher
from data_fetcher.abstract_provider.standard_models.company_peers import (
    CompanyPeersData,
    CompanyPeersQueryParams,
)

log = logging.getLogger(__name__)

_RECOMMEND_URL = "https://query2.finance.yahoo.com/v6/finance/recommendationsbysymbol/{symbol}"
_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; MarketPulse/1.0)"}
_INFO_WORKERS = 5


class YFinanceCompanyPeersQueryParams(CompanyPeersQueryParams):
    """유사 종목 조회 파라미터 (standard CompanyPeers 경유)"""


class YFinanceCompanyPeersData(CompanyPeersData):
    """유사 종목 데이터 (standard CompanyPeers 경유)"""


class YFinanceCompanyPeersFetcher(
    YFinanceFetcher[YFinanceCompanyPeersQueryParams, YFinanceCompanyPeersData]
):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> YFinanceCompanyPeersQueryParams:
        return YFinanceCompanyPeersQueryParams(**params)

    @staticmethod
    def extract_data(
        query: YFinanceCompanyPeersQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        base = query.symbol.upper()
        resp = requests.get(_RECOMMEND_URL.format(symbol=base), headers=_HEADERS, timeout=10)
        if resp.status_code != 200:
            log.warning("Yahoo 유사종목 조회 실패 [%s]: HTTP %s", base, resp.status_code)
            return []
        result = (resp.json().get("finance") or {}).get("result") or []
        if not result:
            return []

        symbols: List[str] = []
        for item in result[0].get("recommendedSymbols") or []:
            sym = (item.get("symbol") or "").upper()
            if sym and sym != base and sym not in symbols:
                symbols.append(sym)
        symbols = symbols[: query.limit]

        def _info(sym: str) -> Dict[str, Any]:
            try:
                info = YFinanceFetcher.get_ticker(sym).info or {}
            except Exception as e:  # 개별 종목 실패는 코드만 남긴다
                log.debug("yfinance info 실패 [%s]: %s", sym, e)
                info = {}
            return {
                "symbol": sym,
                "name": info.get("longName") or info.get("shortName"),
                "sector": info.get("sector"),
                "industry": info.get("industry"),
            }

        if not symbols:
            return []
        with ThreadPoolExecutor(max_workers=min(_INFO_WORKERS, len(symbols))) as pool:
            return list(pool.map(_info, symbols))

    @staticmethod
    def transform_data(
        query: YFinanceCompanyPeersQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[YFinanceCompanyPeersData]:
        return [YFinanceCompanyPeersData(**row) for row in data]
