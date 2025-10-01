import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

log = logging.getLogger("multiseed-extractor")

# Optional dependencies
try:
    import pandas as pd
    import numpy as np
    from scipy.stats import pearsonr, spearmanr
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False
    log.warning("pandas or scipy not installed. Correlation analysis disabled.")


@dataclass
class CorrelationResult:
    """상관관계 분석 결과"""
    symbol_a: str
    symbol_b: str
    correlation: float
    p_value: float
    strength: str  # "strong", "moderate", "weak"
    method: str = "pearson"  # "pearson" or "spearman"
    period_start: Optional[str] = None
    period_end: Optional[str] = None


class CorrelationEngine:
    """상관관계 분석 엔진"""

    def __init__(self, market_hub):
        """
        Args:
            market_hub: MarketDataHub 인스턴스
        """
        self.market = market_hub
        self.has_scipy = HAS_SCIPY

    def analyze_pair(
        self,
        symbol_a: str,
        symbol_b: str,
        start: datetime,
        end: datetime,
        method: str = "pearson"
    ) -> Optional[CorrelationResult]:
        """두 종목 간 상관계수 계산"""
        if not self.has_scipy:
            log.error("scipy not installed. Cannot perform correlation analysis.")
            return None

        try:
            # 데이터 수집
            data_a = self._fetch_price_data(symbol_a, start, end)
            data_b = self._fetch_price_data(symbol_b, start, end)

            if data_a is None or data_b is None:
                log.warning(f"Failed to fetch data for {symbol_a} or {symbol_b}")
                return None

            if len(data_a) == 0 or len(data_b) == 0:
                log.warning(f"Empty data for {symbol_a} or {symbol_b}")
                return None

            # DataFrame 생성
            df_a = pd.DataFrame(data_a)
            df_b = pd.DataFrame(data_b)

            # 인덱스 설정 (날짜)
            df_a['t'] = pd.to_datetime(df_a['t'])
            df_b['t'] = pd.to_datetime(df_b['t'])
            df_a.set_index('t', inplace=True)
            df_b.set_index('t', inplace=True)

            # Close 가격만 추출
            prices_a = df_a['c']
            prices_b = df_b['c']

            # 시계열 정렬 & NaN 제거 (inner join)
            merged = pd.merge(prices_a, prices_b, left_index=True, right_index=True, how='inner')

            if len(merged) < 2:
                log.warning(f"Not enough data points for correlation: {len(merged)}")
                return None

            # 상관계수 계산
            if method.lower() == "pearson":
                corr, p_value = pearsonr(merged.iloc[:, 0], merged.iloc[:, 1])
            elif method.lower() == "spearman":
                corr, p_value = spearmanr(merged.iloc[:, 0], merged.iloc[:, 1])
            else:
                log.error(f"Unknown correlation method: {method}")
                return None

            # 강도 분류
            strength = self._classify_strength(abs(corr))

            result = CorrelationResult(
                symbol_a=symbol_a,
                symbol_b=symbol_b,
                correlation=corr,
                p_value=p_value,
                strength=strength,
                method=method,
                period_start=start.strftime("%Y-%m-%d"),
                period_end=end.strftime("%Y-%m-%d")
            )

            log.info(f"Correlation {symbol_a} vs {symbol_b}: {corr:.3f} ({strength})")
            return result

        except Exception as e:
            log.error(f"Correlation analysis failed: {e}")
            return None

    def find_related_assets(
        self,
        symbol: str,
        candidates: List[str],
        start: datetime,
        end: datetime,
        threshold: float = 0.5,
        method: str = "pearson"
    ) -> List[CorrelationResult]:
        """한 종목과 상관관계 높은 자산 탐색"""
        results = []

        for candidate in candidates:
            if candidate == symbol:
                continue

            result = self.analyze_pair(symbol, candidate, start, end, method)
            if result and abs(result.correlation) >= threshold:
                results.append(result)

        # 상관계수 절댓값 기준으로 정렬
        results.sort(key=lambda x: abs(x.correlation), reverse=True)
        return results

    def _fetch_price_data(
        self,
        symbol: str,
        start: datetime,
        end: datetime
    ) -> Optional[List[Dict[str, Any]]]:
        """가격 데이터 수집"""
        try:
            # MarketDataHub 사용
            from ..data import YahooProvider
            provider = YahooProvider()
            data = provider.fetch(symbol, start, end)
            return data
        except Exception as e:
            log.error(f"Failed to fetch data for {symbol}: {e}")
            return None

    @staticmethod
    def _classify_strength(abs_corr: float) -> str:
        """상관관계 강도 분류"""
        if abs_corr >= 0.7:
            return "strong"
        elif abs_corr >= 0.4:
            return "moderate"
        else:
            return "weak"

    def batch_analyze(
        self,
        symbols: List[str],
        start: datetime,
        end: datetime,
        method: str = "pearson"
    ) -> List[CorrelationResult]:
        """여러 종목 간 전체 상관관계 행렬 계산"""
        results = []

        for i, symbol_a in enumerate(symbols):
            for symbol_b in symbols[i+1:]:
                result = self.analyze_pair(symbol_a, symbol_b, start, end, method)
                if result:
                    results.append(result)

        return results