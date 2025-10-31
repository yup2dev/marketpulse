import re
import logging
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from collections import Counter

from ..models.chart_data import ChartMetadata

log = logging.getLogger("multiseed-extractor")

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
    np = None
    log.warning("opencv-python not installed. Image processing functionality disabled.")


class ImageAnalyzer:
    """이미지/차트 분석기 (OCR + 패턴 인식)"""

    # 차트 타입 감지 키워드
    CHART_TYPE_KEYWORDS = {
        "candlestick": ["candlestick", "candle", "ohlc", "캔들"],
        "line": ["line chart", "line graph", "trend", "라인"],
        "bar": ["bar chart", "bar graph", "histogram", "막대"],
        "pie": ["pie chart", "pie graph", "파이"],
        "heatmap": ["heatmap", "heat map", "히트맵"],
    }

    # 추세 감지 키워드
    TREND_KEYWORDS = {
        "upward": ["up", "increase", "rise", "growth", "bull", "상승", "증가"],
        "downward": ["down", "decrease", "fall", "decline", "bear", "하락", "감소"],
        "sideways": ["flat", "stable", "consolidation", "range", "횡보", "보합"],
    }

    def __init__(self, tesseract_path: Optional[str] = None):
        """
        Args:
            tesseract_path: Tesseract 실행 파일 경로 (Windows: "C:/Program Files/Tesseract-OCR/tesseract.exe")
        """
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
            # 1. OCR로 텍스트 추출
            extracted_text = self._extract_text(image_path)

            # 2. 숫자 추출
            detected_values = self._extract_numbers(extracted_text)

            # 3. 차트 타입 감지
            chart_type = self._detect_chart_type(extracted_text, image_path)

            # 4. 색상 분석
            dominant_colors = self._analyze_colors(image_path)

            # 5. 추세 감지
            trend = self._detect_trend(extracted_text, dominant_colors)

            # 6. 패턴 감지 (선택)
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
        """OCR로 텍스트 추출"""
        if not self.has_ocr:
            return ""

        try:
            img = Image.open(image_path)
            # 이미지 전처리 (선택)
            # img = img.convert('L')  # Grayscale
            text = pytesseract.image_to_string(img, lang='eng+kor')
            return text.strip()
        except Exception as e:
            log.warning(f"OCR failed for {image_path}: {e}")
            return ""

    def _extract_numbers(self, text: str) -> List[float]:
        """텍스트에서 숫자/가격 추출"""
        # 패턴: 123, 1,234, 1234.56, $1,234.56, etc.
        pattern = r'[\d,]+\.?\d*'
        matches = re.findall(pattern, text)

        values = []
        for match in matches:
            try:
                # 쉼표 제거 후 float 변환
                val = float(match.replace(',', ''))
                # 너무 작거나 큰 값 제외 (연도 등)
                if 0.001 < val < 1_000_000_000:
                    values.append(val)
            except ValueError:
                continue

        return values

    def _detect_chart_type(self, text: str, image_path: Path) -> str:
        """차트 타입 감지"""
        text_lower = text.lower()

        # 키워드 매칭
        for chart_type, keywords in self.CHART_TYPE_KEYWORDS.items():
            if any(kw in text_lower for kw in keywords):
                return chart_type

        # 이미지 분석 기반 (선택)
        if self.has_cv2:
            # TODO: 색상 패턴, 선 감지 등으로 차트 타입 추론
            pass

        return "unknown"

    def _analyze_colors(self, image_path: Path) -> List[str]:
        """주요 색상 분석"""
        if not self.has_cv2:
            return []

        try:
            img = cv2.imread(str(image_path))
            if img is None:
                return []

            # RGB로 변환
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

            # 색상 히스토그램 (간단 버전)
            pixels = img_rgb.reshape(-1, 3)

            # K-means 클러스터링으로 주요 색상 추출 (생략하고 간단히)
            # 여기서는 평균 색상만 반환
            avg_color = pixels.mean(axis=0).astype(int)
            hex_color = self._rgb_to_hex(avg_color)

            return [hex_color]

        except Exception as e:
            log.warning(f"Color analysis failed: {e}")
            return []

    def _detect_trend(self, text: str, colors: List[str]) -> Optional[str]:
        """추세 감지"""
        text_lower = text.lower()

        # 텍스트 키워드 기반
        for trend, keywords in self.TREND_KEYWORDS.items():
            if any(kw in text_lower for kw in keywords):
                return trend

        # 색상 기반 (간단한 휴리스틱)
        # 녹색 계열 -> 상승, 빨간색 계열 -> 하락
        if colors:
            for color in colors:
                if color:
                    # 간단히 첫 번째 색상만 체크
                    r, g, b = self._hex_to_rgb(color)
                    if g > r and g > b:  # 녹색 우세
                        return "upward"
                    elif r > g and r > b:  # 빨간색 우세
                        return "downward"

        return None

    def _detect_pattern(self, text: str) -> Optional[str]:
        """차트 패턴 감지 (간단 버전)"""
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
        """RGB를 HEX로 변환"""
        return "#{:02x}{:02x}{:02x}".format(int(rgb[0]), int(rgb[1]), int(rgb[2]))

    @staticmethod
    def _hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
        """HEX를 RGB로 변환"""
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))