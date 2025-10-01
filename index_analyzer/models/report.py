from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime
from pathlib import Path


@dataclass
class TargetPrice:
    """목표주가 정보"""
    value: float
    currency: str
    broker: str
    date: str
    context: str
    source_url: Optional[str] = None


@dataclass
class CorrelationResult:
    """상관관계 분석 결과"""
    symbol_a: str
    symbol_b: str
    correlation: float
    p_value: float
    strength: str  # "strong", "moderate", "weak"
    period_start: Optional[str] = None
    period_end: Optional[str] = None


@dataclass
class ImpactPrediction:
    """영향 예측"""
    source: str
    target: str
    expected_direction: str  # "up", "down", "neutral"
    confidence: float
    lag_days: int
    reasoning: str


@dataclass
class Insight:
    """핵심 인사이트"""
    category: str  # "valuation", "momentum", "risk", "catalyst"
    title: str
    description: str
    confidence: float
    sources: List[str] = field(default_factory=list)


@dataclass
class AnalystReport:
    """애널리스트 리포트"""
    symbol: str
    period_start: str
    period_end: str
    executive_summary: str
    target_prices: List[TargetPrice]
    sentiment_score: float  # -1 ~ 1
    sentiment_distribution: Dict[str, int]  # {"positive": 10, "neutral": 3, "negative": 2}
    key_insights: List[Insight]
    correlation_analysis: List[CorrelationResult]
    impact_predictions: List[ImpactPrediction]
    charts: List[str]  # 차트 파일 경로
    supporting_articles: List[Dict[str, Any]]
    generated_at: str