"""Correlation fetcher — 종목 간 일간수익률 상관행렬.

시세는 yfinance를 직접 부르지 않고 `QueryExecutor.fetch("yahoo", "stock_price")`로 받는다.
quantitative provider는 웹 서버에서도 실행되므로, 직접 부르면 서버 고정 IP에서 yfinance를
호출하게 된다(차단/OOM). QueryExecutor를 거치면 서버에서는 yahoo 조회가 사용자 Fetcher(exe)로
위임되고, Fetcher·로컬 배치(leaf)에서는 그대로 직접 실행된다. Fetcher가 꺼져 있으면
RemoteUnavailableError가 그대로 전파되어 라우트에서 503이 된다.

입력 시세는 yahoo stock_price 캐시(TTL 60s)를 타므로 이 모델 자체는 캐시하지 않는다.
"""
import asyncio
import logging
from typing import Any, Dict, List, Mapping, Optional

import numpy as np
import pandas as pd

from data_fetcher.abstract_provider.abstract.base_fetchers import ComputeFetcher
from data_fetcher.abstract_provider.standard_models.quant_analysis import CorrelationData, CorrelationQueryParams

log = logging.getLogger(__name__)


def _items(raw: Any) -> List[Any]:
    return getattr(raw, "result", raw) or []


def _get(item: Any, key: str) -> Any:
    return item.get(key) if isinstance(item, Mapping) else getattr(item, key, None)


def closes_from_prices(items: List[Any]) -> Dict[str, float]:
    """stock_price 결과(pydantic/dict 혼재) → {YYYY-MM-DD: close}."""
    out: Dict[str, float] = {}
    for it in items:
        d, c = _get(it, "date"), _get(it, "close")
        if d is not None and c is not None:
            out[str(d)[:10]] = float(c)
    return out


def correlation_matrix(closes: Dict[str, Dict[str, float]]) -> Dict[str, Any]:
    """{symbol: {date: close}} → {labels, matrix, rows}. 공통 거래일의 일간수익률 기준."""
    series = {sym: pd.Series(c) for sym, c in closes.items() if c}
    if len(series) < 2:
        raise ValueError("Insufficient price data for correlation")

    returns = pd.DataFrame(series).sort_index().pct_change().dropna()
    if returns.shape[0] < 2:
        raise ValueError("Insufficient data for correlation")

    corr = returns.corr()
    labels = list(corr.columns)
    matrix = [
        [round(float(corr.loc[a, b]), 4) if np.isfinite(corr.loc[a, b]) else 0.0 for b in labels]
        for a in labels
    ]
    return {"labels": labels, "matrix": matrix, "rows": int(returns.shape[0])}


class QuantCorrelationFetcher(ComputeFetcher[CorrelationQueryParams, CorrelationData]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> CorrelationQueryParams:
        p = dict(params)
        syms = p.get("symbols") or []
        if isinstance(syms, str):
            syms = syms.split(",")
        # 정규화 + 중복 제거(순서 보존)
        p["symbols"] = list(dict.fromkeys(s.strip().upper() for s in syms if s and s.strip()))
        return CorrelationQueryParams(**p)

    @staticmethod
    async def aextract_data(
        query: CorrelationQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        # 순환 import 방지 — query_executor는 provider 모듈 로드 이후에 필요하다.
        from data_fetcher.query_executor import QueryExecutor

        def _params(sym: str) -> Dict[str, Any]:
            # interval 명시: 미지정 시 2y 이상은 주봉으로 바뀐다(yahoo 기본값 매핑).
            p: Dict[str, Any] = {"symbol": sym, "period": query.period, "interval": "1d"}
            if query.start_date:
                p["start_date"] = str(query.start_date)
            if query.end_date:
                p["end_date"] = str(query.end_date)
            return p

        raws = await asyncio.gather(
            *[QueryExecutor.fetch("yahoo", "stock_price", _params(s)) for s in query.symbols]
        )
        closes = {sym: closes_from_prices(_items(raw)) for sym, raw in zip(query.symbols, raws)}
        result = correlation_matrix(closes)
        result["missing"] = [s for s, c in closes.items() if not c]
        return result

    @staticmethod
    def transform_data(
        query: CorrelationQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> List[CorrelationData]:
        return [CorrelationData.model_validate(data)]
