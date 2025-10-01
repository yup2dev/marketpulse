import re
import logging
from typing import List, Optional, Dict
from datetime import datetime

from ..models.report import TargetPrice

log = logging.getLogger("multiseed-extractor")


class TargetPriceExtractor:
    """목표주가 추출기 (정규식 + NER 기반)"""

    # 목표주가 패턴
    TARGET_PRICE_PATTERNS = [
        # 영어 패턴
        r"target\s+price[:\s]+\$?\s?([0-9][0-9,\.]+)",
        r"TP[:\s]+\$?\s?([0-9][0-9,\.]+)",
        r"price\s+target[:\s]+\$?\s?([0-9][0-9,\.]+)",
        r"target[:\s]+\$?\s?([0-9][0-9,\.]+)",

        # 한글 패턴
        r"목표\s*주가[:\s：]+\$?\s?([0-9][0-9,\.]+)",
        r"목표가[:\s：]+\$?\s?([0-9][0-9,\.]+)",
        r"TP[:\s：]+([0-9][0-9,\.]+)\s*원",
    ]

    # 브로커/증권사 패턴
    BROKER_PATTERNS = [
        # 영어
        r"(Goldman\s+Sachs|Morgan\s+Stanley|JP\s*Morgan|Bank\s+of\s+America|Citi|Barclays|Credit\s+Suisse|UBS|Deutsche\s+Bank)",
        r"(Jefferies|Piper\s+Sandler|Wedbush|Oppenheimer|Raymond\s+James|Stifel|Cowen)",

        # 한글
        r"(삼성증권|미래에셋증권|NH투자증권|키움증권|한국투자증권|KB증권|신한투자증권|하나금융투자|대신증권|유안타증권)",
    ]

    # 통화 패턴
    CURRENCY_PATTERNS = {
        "USD": [r"\$", r"USD", r"US\$", r"dollar"],
        "KRW": [r"원", r"KRW", r"₩"],
        "EUR": [r"€", r"EUR", r"euro"],
        "GBP": [r"£", r"GBP", r"pound"],
    }

    def __init__(self):
        # 정규식 컴파일
        self.price_patterns = [re.compile(p, re.I) for p in self.TARGET_PRICE_PATTERNS]
        self.broker_patterns = [re.compile(p, re.I) for p in self.BROKER_PATTERNS]

    def extract(self, text: str, source_url: Optional[str] = None) -> List[TargetPrice]:
        """텍스트에서 목표주가 정보 추출"""
        results = []

        # 문장 단위로 분리
        sentences = self._split_sentences(text)

        for sent in sentences:
            # 목표주가 찾기
            price_match = self._find_target_price(sent)
            if not price_match:
                continue

            value = price_match["value"]
            currency = price_match["currency"]

            # 브로커 찾기 (같은 문장 또는 인접 문장)
            broker = self._find_broker(sent)

            # 날짜 찾기
            date = self._find_date(sent)

            # 컨텍스트 (해당 문장 + 전후 문장)
            context = sent[:200]  # 최대 200자

            target_price = TargetPrice(
                value=value,
                currency=currency,
                broker=broker or "Unknown",
                date=date or datetime.now().strftime("%Y-%m-%d"),
                context=context,
                source_url=source_url
            )

            results.append(target_price)
            log.info(f"Found target price: {value} {currency} from {broker}")

        return results

    def _split_sentences(self, text: str) -> List[str]:
        """문장 분리"""
        # 간단한 문장 분리 (개선 가능)
        sentences = re.split(r'[.!?。！？]\s+', text)
        return [s.strip() for s in sentences if len(s.strip()) > 10]

    def _find_target_price(self, text: str) -> Optional[Dict]:
        """목표주가 찾기"""
        for pattern in self.price_patterns:
            match = pattern.search(text)
            if match:
                try:
                    price_str = match.group(1).replace(',', '')
                    value = float(price_str)

                    # 통화 감지
                    currency = self._detect_currency(text)

                    return {"value": value, "currency": currency}
                except (ValueError, IndexError):
                    continue

        return None

    def _detect_currency(self, text: str) -> str:
        """통화 감지"""
        for currency, patterns in self.CURRENCY_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, text, re.I):
                    return currency

        # 기본값
        return "USD"

    def _find_broker(self, text: str) -> Optional[str]:
        """브로커/증권사 찾기"""
        for pattern in self.broker_patterns:
            match = pattern.search(text)
            if match:
                return match.group(1).strip()

        return None

    def _find_date(self, text: str) -> Optional[str]:
        """날짜 찾기"""
        # ISO 형식: 2025-09-15
        iso_pattern = r"(\d{4}-\d{2}-\d{2})"
        match = re.search(iso_pattern, text)
        if match:
            return match.group(1)

        # 영어 형식: September 15, 2025
        en_pattern = r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})"
        match = re.search(en_pattern, text, re.I)
        if match:
            month_map = {
                "january": "01", "february": "02", "march": "03", "april": "04",
                "may": "05", "june": "06", "july": "07", "august": "08",
                "september": "09", "october": "10", "november": "11", "december": "12"
            }
            month = month_map.get(match.group(1).lower(), "01")
            day = match.group(2).zfill(2)
            year = match.group(3)
            return f"{year}-{month}-{day}"

        return None

    def aggregate_target_prices(self, target_prices: List[TargetPrice]) -> Dict:
        """목표주가 집계 (평균, 최고, 최저, 중앙값)"""
        if not target_prices:
            return {
                "count": 0,
                "average": None,
                "median": None,
                "max": None,
                "min": None,
                "by_broker": {}
            }

        values = [tp.value for tp in target_prices]

        # 중앙값
        sorted_values = sorted(values)
        n = len(sorted_values)
        median = sorted_values[n // 2] if n % 2 == 1 else (sorted_values[n // 2 - 1] + sorted_values[n // 2]) / 2

        # 브로커별 집계
        by_broker = {}
        for tp in target_prices:
            if tp.broker not in by_broker:
                by_broker[tp.broker] = []
            by_broker[tp.broker].append(tp.value)

        return {
            "count": len(values),
            "average": sum(values) / len(values),
            "median": median,
            "max": max(values),
            "min": min(values),
            "by_broker": {broker: sum(vals) / len(vals) for broker, vals in by_broker.items()}
        }