from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from pathlib import Path


@dataclass
class ChartMetadata:
    """차트 이미지 메타데이터"""
    path: Path
    chart_type: str  # "candlestick", "line", "bar", "pie", "heatmap", "unknown"
    extracted_text: str
    detected_values: List[float] = field(default_factory=list)
    dominant_colors: List[str] = field(default_factory=list)
    trend: Optional[str] = None  # "upward", "downward", "sideways"
    pattern: Optional[str] = None  # "breakout", "support", "resistance", etc.
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ImageAnalysisResult:
    """이미지 분석 결과 (Vision API)"""
    path: Path
    description: str
    detected_objects: List[str] = field(default_factory=list)
    text_content: str = ""
    confidence: float = 0.0
    tags: List[str] = field(default_factory=list)