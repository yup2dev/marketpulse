"""Image/chart analyzer — renamed from image_analyzer.py."""
import re
import logging
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from collections import Counter

from ..models.chart import ChartMetadata
from ..utils.logging import get_logger

log = get_logger(__name__)

# Optional dependencies
try:
    from PIL import Image
    import pytesseract
    HAS_OCR = True
except ImportError:
    HAS_OCR = False
    log.warning("PIL or pytesseract not installed. OCR functionality disabled.")

try:
    import cv2
    import numpy as np
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False
    log.warning("opencv-python not installed. Image processing functionality disabled.")


class ImageAnalyzer:
    """이미지/차트 분석기 (OCR + 패턴 인식)"""

    CHART_TYPE_KEYWORDS = {
        "candlestick": ["candlestick", "candle", "ohlc", "캔들"],
        "line": ["line chart", "line graph", "trend", "라인"],
        "bar": ["bar chart", "bar graph", "histogram", "막대"],
        "pie": ["pie chart", "pie graph", "파이"],
        "heatmap": ["heatmap", "heat map", "히트맵"],
    }

    TREND_KEYWORDS = {
        "upward": ["up", "increase", "rise", "growth", "bull", "상승", "증가"],
        "downward": ["down", "decrease", "fall", "decline", "bear", "하락", "감소"],
        "sideways": ["flat", "stable", "consolidation", "range", "횡보", "보합"],
    }

    def __init__(self, tesseract_path: Optional[str] = None):
        self.has_ocr = HAS_OCR
        self.has_cv2 = HAS_CV2

        if tesseract_path and HAS_OCR:
            pytesseract.pytesseract.tesseract_cmd = tesseract_path

    def analyze(self, image_path: Path) -> Optional[ChartMetadata]:
        """차트 이미지 종합 분석"""
        if not image_path.exists():
            log.error(f"Image not found: {image_path}")
            return None

        try:
            extracted_text = self._extract_text(image_path)
            detected_values = self._extract_numbers(extracted_text)
            chart_type = self._detect_chart_type(extracted_text, image_path)
            dominant_colors = self._analyze_colors(image_path)
            trend = self._detect_trend(extracted_text, dominant_colors)
            pattern = self._detect_pattern(extracted_text)

            metadata = ChartMetadata(
                path=image_path,
                chart_type=chart_type,
                extracted_text=extracted_text,
                detected_values=detected_values,
                dominant_colors=dominant_colors,
                trend=trend,
                pattern=pattern,
                metadata={}
            )

            log.info(f"Analyzed: {image_path.name} -> {chart_type}, {len(detected_values)} values")
            return metadata

        except Exception as e:
            log.error(f"Failed to analyze {image_path}: {e}")
            return None

    def _extract_text(self, image_path: Path) -> str:
        if not self.has_ocr:
            return ""
        try:
            img = Image.open(image_path)
            text = pytesseract.image_to_string(img, lang='eng+kor')
            return text.strip()
        except Exception as e:
            log.warning(f"OCR failed for {image_path}: {e}")
            return ""

    def _extract_numbers(self, text: str) -> List[float]:
        pattern = r'[\d,]+\.?\d*'
        matches = re.findall(pattern, text)
        values = []
        for match in matches:
            try:
                val = float(match.replace(',', ''))
                if 0.001 < val < 1_000_000_000:
                    values.append(val)
            except ValueError:
                continue
        return values

    def _detect_chart_type(self, text: str, image_path: Path) -> str:
        text_lower = text.lower()
        for chart_type, keywords in self.CHART_TYPE_KEYWORDS.items():
            if any(kw in text_lower for kw in keywords):
                return chart_type
        return "unknown"

    def _analyze_colors(self, image_path: Path) -> List[str]:
        if not self.has_cv2:
            return []
        try:
            img = cv2.imread(str(image_path))
            if img is None:
                return []
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            pixels = img_rgb.reshape(-1, 3)
            avg_color = pixels.mean(axis=0).astype(int)
            hex_color = self._rgb_to_hex(avg_color)
            return [hex_color]
        except Exception as e:
            log.warning(f"Color analysis failed: {e}")
            return []

    def _detect_trend(self, text: str, colors: List[str]) -> Optional[str]:
        text_lower = text.lower()
        for trend, keywords in self.TREND_KEYWORDS.items():
            if any(kw in text_lower for kw in keywords):
                return trend
        if colors:
            for color in colors:
                if color:
                    r, g, b = self._hex_to_rgb(color)
                    if g > r and g > b:
                        return "upward"
                    elif r > g and r > b:
                        return "downward"
        return None

    def _detect_pattern(self, text: str) -> Optional[str]:
        text_lower = text.lower()
        patterns = {
            "breakout": ["breakout", "break out", "돌파"],
            "support": ["support", "floor", "지지"],
            "resistance": ["resistance", "ceiling", "저항"],
            "triangle": ["triangle", "삼각"],
            "head_and_shoulders": ["head and shoulders", "헤드앤숄더"],
        }
        for pattern, keywords in patterns.items():
            if any(kw in text_lower for kw in keywords):
                return pattern
        return None

    @staticmethod
    def _rgb_to_hex(rgb) -> str:
        return "#{:02x}{:02x}{:02x}".format(int(rgb[0]), int(rgb[1]), int(rgb[2]))

    @staticmethod
    def _hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
