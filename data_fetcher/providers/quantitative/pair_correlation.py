"""Pair Correlation Fetcher — 두 자산 일일 수익률의 롤링 상관계수.

기본값은 USD/JPY(JPY=X) vs 닛케이225(^N225) — 엔 캐리 국면 판정용.
부호가 음(엔 약세=주가 상승)에서 양으로 뒤집히면 언와인드 국면 진입 신호다.
해석상의 한계는 standard model 도큐스트링 참조.
"""
import logging
from typing import Any, Dict, List, Optional

import pandas as pd

from data_fetcher.abstract_provider.abstract.base_fetchers import ComputeFetcher
from data_fetcher.abstract_provider.standard_models.pair_correlation import (
    PairCorrelationData,
    PairCorrelationQueryParams,
)
from data_fetcher.providers.quantitative._data import load_series

log = logging.getLogger(__name__)

#: regime 라벨 임계값 — |corr| 이 이 값을 넘어야 방향성이 있다고 본다.
_REGIME_THRESHOLD = 0.2


class QuantPairCorrelationQueryParams(PairCorrelationQueryParams):
    """롤링 상관 조회 파라미터 (standard PairCorrelation 경유)."""


class QuantPairCorrelationData(PairCorrelationData):
    """일자별 롤링 상관 (standard PairCorrelation 경유)."""


def _regime(corr: float) -> str:
    if corr <= -_REGIME_THRESHOLD:
        return "risk-on"
    if corr >= _REGIME_THRESHOLD:
        return "unwind"
    return "neutral"


class QuantPairCorrelationFetcher(
    ComputeFetcher[QuantPairCorrelationQueryParams, QuantPairCorrelationData]
):
    """두 심볼의 롤링 상관계수 시계열 (yfinance)."""

    require_credentials = False

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> QuantPairCorrelationQueryParams:
        return QuantPairCorrelationQueryParams(**params)

    @staticmethod
    def extract_data(
        query: QuantPairCorrelationQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        _, base_returns = load_series(query.symbol, "close", query.start_date, query.end_date)
        _, bench_returns = load_series(
            query.benchmark, "close", query.start_date, query.end_date
        )

        if query.lag_benchmark:
            # 거래시간이 겹치지 않는 쌍(USD/JPY 24h vs 닛케이 일본장)의 시차 왜곡 점검용
            bench_returns = bench_returns.shift(query.lag_benchmark)

        # 두 시장의 휴장일이 달라 합집합에는 결측이 생긴다 → 양쪽 모두 값이 있는 날만 쓴다.
        merged = pd.concat(
            {"base": base_returns, "bench": bench_returns}, axis=1
        ).dropna()

        if len(merged) <= query.window:
            raise ValueError(
                f"window ({query.window}) must be < overlapping observations ({len(merged)}). "
                f"{query.symbol} / {query.benchmark} 의 공통 거래일이 부족하다."
            )

        corr = merged["base"].rolling(query.window).corr(merged["bench"])
        frame = merged.assign(correlation=corr).dropna(subset=["correlation"])

        return {
            "points": [
                {
                    # row는 pd.Series — 컬럼명이 Series 메서드와 겹칠 수 있으므로
                    # 속성 접근이 아니라 인덱싱으로 읽는다.
                    "date": idx.date().isoformat(),
                    "correlation": round(float(row["correlation"]), 4),
                    "symbol_return_pct": round(float(row["base"]) * 100, 4),
                    "benchmark_return_pct": round(float(row["bench"]) * 100, 4),
                    "regime": _regime(float(row["correlation"])),
                }
                for idx, row in frame.iterrows()
            ]
        }

    @staticmethod
    def transform_data(
        query: QuantPairCorrelationQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> List[QuantPairCorrelationData]:
        return [QuantPairCorrelationData(**p) for p in data["points"]]
