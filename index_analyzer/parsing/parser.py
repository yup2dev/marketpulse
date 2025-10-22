import re
from datetime import datetime
from typing import Optional, Tuple, List
from bs4 import BeautifulSoup

from ..models.schemas import ImageInfo
from ..crawling.url_classifier import URLHelper

DEFAULT_PARSER = "lxml"
CHART_HINT_RE = re.compile(
    r"(chart|graph|figure|plot|trend|diagram|index|price|candlestick|heatmap|tradingview|highcharts|echarts|"
    r"stock|market|trading|technical|indicator|oscillator|moving.?average|"
    r"차트|그래프|도표|캔들|주가|증시|매매|지표)", re.I
)

# 불필요한 이미지 패턴 (광고, 로고, 아이콘 등)
EXCLUDE_IMAGE_RE = re.compile(
    r"(logo|icon|avatar|banner|ad|advertisement|sponsor|thumbnail|"
    r"social|share|profile|user|author|writer|reporter|"
    r"btn_|button|arrow|bullet|divider|spacer|pixel|tracking|"
    r"로고|아이콘|광고|배너|프로필|버튼)", re.I
)


class Parser:
    def __init__(self, base_url: str, html: str):
        self.base_url = base_url
        self.soup = BeautifulSoup(html, DEFAULT_PARSER)

    def extract_title(self) -> str:
        if self.soup.title and self.soup.title.string:
            return self.soup.title.string.strip()
        og = self.soup.find("meta", property="og:title")
        if og and og.get("content"):
            return og["content"].strip()
        h1 = self.soup.find("h1")
        return h1.get_text(strip=True) if h1 else ""

    def extract_published_time(self) -> Optional[datetime]:
        cands = [
            ("meta", {"property": "article:published_time"}, "content"),
            ("meta", {"name": "pubdate"}, "content"),
            ("meta", {"name": "date"}, "content"),
            ("meta", {"itemprop": "datePublished"}, "content"),
            ("time", {"datetime": True}, "datetime"),
        ]
        for tag, attrs, attr_name in cands:
            el = self.soup.find(tag, attrs)
            if el and el.get(attr_name):
                val = el.get(attr_name).strip()
                dt = self._parse_soft(val)
                if dt:
                    return dt
        return None

    @staticmethod
    def _parse_soft(val: str) -> Optional[datetime]:
        try:
            if val.endswith("Z"):
                val = val[:-1] + "+00:00"
            return datetime.fromisoformat(val)
        except Exception:
            pass
        m = re.search(r"(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2})(?::\d{2})?)?", val)
        if m:
            ds = m.group(1)
            ts = m.group(2) or "00:00"
            try:
                return datetime.fromisoformat(f"{ds} {ts}")
            except Exception:
                return None
        return None

    def extract_main_text(self) -> str:
        for sel in ("nav", "header", "footer", "aside", "script", "style", "noscript"):
            for el in self.soup.select(sel):
                el.decompose()
        container = self.soup.find("article") or self.soup.find("main") or self.soup.body or self.soup
        return container.get_text(" ", strip=True)

    def extract_images(self) -> Tuple[List[ImageInfo], List[ImageInfo]]:
        imgs: List[ImageInfo] = []
        charts: List[ImageInfo] = []

        for img in self.soup.find_all("img"):
            src = img.get("src") or img.get("data-src") or img.get("data-original")
            if not src:
                continue

            # Skip data URIs (base64 encoded images, often icons/placeholders)
            if src.startswith("data:"):
                continue

            src = URLHelper.abs(self.base_url, src)
            if not src:
                continue

            alt = (img.get("alt") or img.get("title") or "").strip()
            cls = " ".join(img.get("class", [])).lower()
            parents = " ".join(" ".join(p.get("class", [])) for p in img.parents if hasattr(p, "get")).lower()

            # 차트 여부 판단 (먼저 확인)
            is_chart = any([
                CHART_HINT_RE.search(src),
                CHART_HINT_RE.search(alt),
                CHART_HINT_RE.search(cls),
                CHART_HINT_RE.search(parents),
            ])

            # 불필요한 이미지 제외 (단, 차트는 제외하지 않음)
            # Only check src and cls for exclusion, not parents (too broad)
            # And skip exclusion if it's a chart
            if not is_chart and any([
                EXCLUDE_IMAGE_RE.search(src),
                EXCLUDE_IMAGE_RE.search(alt),
                EXCLUDE_IMAGE_RE.search(cls),
            ]):
                continue

            info = ImageInfo(src=src, alt=alt, is_chart=is_chart)

            # 차트만 수집 (일반 이미지 제외)
            if is_chart and len(charts) < 5:
                charts.append(info)

        return imgs, charts