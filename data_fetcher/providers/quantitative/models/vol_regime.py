"""Vol Regime Fetcher — 스팟 기반 실현변동성 국면 (내재변동성 대체 지표).

⚠️ 내재변동성/리스크리버설이 아니다. 무료 IV 소스가 없어서 쓰는 대체 지표이고,
   선행성을 잃는다는 게 핵심 한계다. 배경과 해석 주의사항은 standard model
   도큐스트링(vol_regime.py)을 반드시 먼저 읽을 것.

기본값은 USD/JPY(JPY=X) — 엔 캐리 모니터용.
"""
import logging
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from data_fetcher.abstract_provider.abstract.base_fetchers import ComputeFetcher
from data_fetcher.abstract_provider.standard_models.vol_regime import (
    VolRegimeData,
    VolRegimeQueryParams,
)
from data_fetcher.providers.quantitative._data import load_ohlc

log = logging.getLogger(__name__)

#: 연율화 계수 (거래일 기준)
_TRADING_DAYS = 252
#: Parkinson 추정량 상수 — 1 / (4 ln 2)
_PARKINSON_C = 1.0 / (4.0 * np.log(2.0))


class QuantVolRegimeQueryParams(VolRegimeQueryParams):
    """실현변동성 국면 조회 파라미터 (standard VolRegime 경유)."""


class QuantVolRegimeData(VolRegimeData):
    """일자별 실현변동성 국면 (standard VolRegime 경유)."""


def _round(value: Any, digits: int = 2) -> Optional[float]:
    if value is None or pd.isna(value):
        return None
    return round(float(value), digits)


class QuantVolRegimeFetcher(ComputeFetcher[QuantVolRegimeQueryParams, QuantVolRegimeData]):
    """실현변동성(단기/장기/Parkinson) + 기간구조 비율 + 수익률 왜도."""

    require_credentials = False

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> QuantVolRegimeQueryParams:
        return QuantVolRegimeQueryParams(**params)

    @staticmethod
    def extract_data(
        query: QuantVolRegimeQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        if query.window_short >= query.window_long:
            raise ValueError(
                f"window_short ({query.window_short}) must be < "
                f"window_long ({query.window_long})"
            )

        df = load_ohlc(query.symbol, query.start_date, query.end_date)
        close = df["Close"].astype(float)
        log_ret = np.log(close / close.shift(1))

        if len(log_ret.dropna()) <= query.window_long:
            raise ValueError(
                f"window_long ({query.window_long}) must be < data length "
                f"({len(log_ret.dropna())}) for {query.symbol}"
            )

        annualise = np.sqrt(_TRADING_DAYS) * 100.0
        rv_short = log_ret.rolling(query.window_short).std(ddof=1) * annualise
        rv_long = log_ret.rolling(query.window_long).std(ddof=1) * annualise

        # Parkinson: sqrt( 1/(4 ln2) * mean( (ln(H/L))^2 ) ) — 고가/저가만 쓰는 추정량.
        # FX 심볼은 H/L이 비거나 0인 날이 있어 그런 날은 제외하고 롤링 평균을 낸다.
        high, low = df["High"].astype(float), df["Low"].astype(float)
        hl = np.log((high / low).where((high > 0) & (low > 0)))
        parkinson = (
            np.sqrt(_PARKINSON_C * (hl ** 2).rolling(query.window_short).mean()) * annualise
        )

        skew = log_ret.rolling(query.window_short).skew()
        term_ratio = rv_short / rv_long

        frame = pd.DataFrame({
            "rv_short": rv_short,
            "rv_long": rv_long,
            "parkinson": parkinson,
            "term_ratio": term_ratio,
            "skew": skew,
            "close": close,
        }).dropna(subset=["rv_short", "rv_long"])

        return {
            "points": [
                {
                    # row는 pd.Series라 속성 접근(row.skew)은 컬럼이 아니라 동명의
                    # 메서드(Series.skew)를 잡는다. 반드시 인덱싱으로 읽을 것.
                    "date": idx.date().isoformat(),
                    "rv_short": _round(row["rv_short"]),
                    "rv_long": _round(row["rv_long"]),
                    "parkinson": _round(row["parkinson"]),
                    "term_ratio": _round(row["term_ratio"], 3),
                    "skew": _round(row["skew"], 3),
                    "close": _round(row["close"], 4),
                }
                for idx, row in frame.iterrows()
            ]
        }

    @staticmethod
    def transform_data(
        query: QuantVolRegimeQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> List[QuantVolRegimeData]:
        return [QuantVolRegimeData(**p) for p in data["points"]]
