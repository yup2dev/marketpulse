import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

log = logging.getLogger("multiseed-extractor")


@dataclass
class ImpactPrediction:
    """영향 예측"""
    source: str
    target: str
    expected_direction: str  # "up", "down", "neutral"
    confidence: float
    lag_days: int
    reasoning: str
    magnitude: Optional[float] = None  # 예상 변화율 (%)


class CausalityInference:
    """
    인과관계 추론 엔진
    Granger Causality + Rule-based 인과관계 추론
    예: "CPI 상승 → 금리 인상 → 테크주 하락"
    """

    # 인과관계 규칙 데이터베이스
    CAUSAL_RULES = {
        # 매크로 지표 → 섹터
        "cpi_up": {
            "trigger": "CPI",
            "direction": "up",
            "threshold": 0.3,  # 최소 변화율 (%)
            "effects": [
                {
                    "target": "^GSPC",  # S&P 500
                    "direction": "down",
                    "confidence": 0.65,
                    "lag": 5,
                    "magnitude": -0.5
                },
                {
                    "target": "GC=F",  # Gold
                    "direction": "up",
                    "confidence": 0.7,
                    "lag": 2,
                    "magnitude": 1.0
                },
                {
                    "target": "tech_sector",
                    "direction": "down",
                    "confidence": 0.7,
                    "lag": 3,
                    "magnitude": -1.5
                }
            ]
        },

        # 금리 상승 → 주식
        "interest_rate_up": {
            "trigger": "^TNX",  # 10Y Treasury
            "direction": "up",
            "threshold": 0.1,
            "effects": [
                {
                    "target": "tech_sector",
                    "direction": "down",
                    "confidence": 0.75,
                    "lag": 2,
                    "magnitude": -2.0
                },
                {
                    "target": "financial_sector",
                    "direction": "up",
                    "confidence": 0.65,
                    "lag": 1,
                    "magnitude": 1.0
                }
            ]
        },

        # 섹터 리더 → 팔로워 (반도체)
        "nvda_move": {
            "trigger": "NVDA",
            "direction": "any",
            "threshold": 3.0,
            "effects": [
                {
                    "target": "AMD",
                    "direction": "same",
                    "confidence": 0.82,
                    "lag": 1,
                    "magnitude_ratio": 0.75
                },
                {
                    "target": "TSM",
                    "direction": "same",
                    "confidence": 0.78,
                    "lag": 1,
                    "magnitude_ratio": 0.65
                },
                {
                    "target": "INTC",
                    "direction": "same",
                    "confidence": 0.60,
                    "lag": 2,
                    "magnitude_ratio": 0.50
                },
                {
                    "target": "SMCI",
                    "direction": "same",
                    "confidence": 0.70,
                    "lag": 1,
                    "magnitude_ratio": 1.2
                }
            ]
        },

        # 유가 → 에너지/항공
        "oil_up": {
            "trigger": "CL=F",  # Crude Oil
            "direction": "up",
            "threshold": 5.0,
            "effects": [
                {
                    "target": "energy_sector",
                    "direction": "up",
                    "confidence": 0.80,
                    "lag": 1,
                    "magnitude": 2.0
                },
                {
                    "target": "airline_sector",
                    "direction": "down",
                    "confidence": 0.70,
                    "lag": 2,
                    "magnitude": -1.5
                }
            ]
        }
    }

    # 섹터 구성 종목
    SECTOR_TICKERS = {
        "tech_sector": ["NVDA", "AMD", "INTC", "TSM", "AAPL", "MSFT", "GOOGL"],
        "financial_sector": ["JPM", "BAC", "GS", "MS", "WFC"],
        "energy_sector": ["XOM", "CVX", "COP", "SLB"],
        "airline_sector": ["DAL", "UAL", "AAL", "LUV"]
    }

    def __init__(self, market_hub=None):
        """
        Args:
            market_hub: MarketDataHub 인스턴스 (옵션)
        """
        self.market = market_hub

    def predict_impact(
        self,
        trigger_symbol: str,
        trigger_change: float,
        window_days: int = 14
    ) -> List[ImpactPrediction]:
        """특정 자산 변동이 다른 자산에 미칠 영향 예측"""
        predictions = []

        # 변화 방향
        direction = "up" if trigger_change > 0 else "down" if trigger_change < 0 else "neutral"

        # Rule-based 추론
        for rule_key, rule in self.CAUSAL_RULES.items():
            # 트리거 매칭
            if not self._matches_trigger(trigger_symbol, rule["trigger"]):
                continue

            # 방향 확인
            rule_direction = rule["direction"]
            if rule_direction != "any" and rule_direction != direction:
                continue

            # 임계값 확인
            if abs(trigger_change) < rule.get("threshold", 0):
                continue

            # 효과 적용
            for effect in rule["effects"]:
                target = effect["target"]
                expected_dir = effect["direction"]

                # "same" 방향은 트리거와 동일
                if expected_dir == "same":
                    expected_dir = direction

                # 크기 계산
                magnitude = None
                if "magnitude" in effect:
                    magnitude = effect["magnitude"]
                elif "magnitude_ratio" in effect:
                    magnitude = trigger_change * effect["magnitude_ratio"]

                # 섹터 확장
                if target.endswith("_sector"):
                    tickers = self.SECTOR_TICKERS.get(target, [])
                    for ticker in tickers:
                        pred = ImpactPrediction(
                            source=trigger_symbol,
                            target=ticker,
                            expected_direction=expected_dir,
                            confidence=effect["confidence"],
                            lag_days=effect["lag"],
                            reasoning=f"{trigger_symbol} {direction} {trigger_change:+.2f}% → {target} sector effect",
                            magnitude=magnitude
                        )
                        predictions.append(pred)
                else:
                    pred = ImpactPrediction(
                        source=trigger_symbol,
                        target=target,
                        expected_direction=expected_dir,
                        confidence=effect["confidence"],
                        lag_days=effect["lag"],
                        reasoning=f"{trigger_symbol} {direction} {trigger_change:+.2f}% → causal rule",
                        magnitude=magnitude
                    )
                    predictions.append(pred)

        # 신뢰도 기준 정렬
        predictions.sort(key=lambda x: x.confidence, reverse=True)

        log.info(f"Predicted {len(predictions)} impacts from {trigger_symbol} {trigger_change:+.2f}%")
        return predictions

    def _matches_trigger(self, symbol: str, trigger: str) -> bool:
        """트리거 매칭"""
        # 정확한 매칭
        if symbol == trigger:
            return True

        # 섹터 매칭 (심볼이 해당 섹터에 속하는지)
        if trigger.endswith("_sector"):
            tickers = self.SECTOR_TICKERS.get(trigger, [])
            return symbol in tickers

        return False

    def analyze_chain_reaction(
        self,
        initial_trigger: str,
        initial_change: float,
        max_depth: int = 3
    ) -> List[ImpactPrediction]:
        """연쇄 반응 분석 (A → B → C → D)"""
        all_predictions = []
        processed = set()

        # BFS 방식으로 연쇄 효과 추적
        queue = [(initial_trigger, initial_change, 0)]
        processed.add(initial_trigger)

        while queue:
            trigger, change, depth = queue.pop(0)

            if depth >= max_depth:
                continue

            # 직접 영향 예측
            predictions = self.predict_impact(trigger, change)

            for pred in predictions:
                # 중복 제거
                if pred.target not in processed:
                    all_predictions.append(pred)
                    processed.add(pred.target)

                    # 2차 효과 큐에 추가
                    if pred.magnitude and depth < max_depth - 1:
                        queue.append((pred.target, pred.magnitude, depth + 1))

        return all_predictions

    def add_custom_rule(self, rule_key: str, rule: Dict[str, Any]):
        """커스텀 인과관계 규칙 추가"""
        self.CAUSAL_RULES[rule_key] = rule
        log.info(f"Added custom causal rule: {rule_key}")

    def get_sector_tickers(self, sector: str) -> List[str]:
        """섹터 구성 종목 조회"""
        return self.SECTOR_TICKERS.get(sector, [])