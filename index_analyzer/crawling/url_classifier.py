import re
from dataclasses import dataclass, field
from typing import Set, Iterable, Optional
from urllib.parse import urlparse


@dataclass
class CategoryPolicy:
    """도메인 전역 또는 사이트별 정책."""
    # 카테고리로 취급할 마지막 세그먼트 화이트리스트
    category_slugs: Set[str] = field(default_factory=lambda: {
        "world", "news", "business", "markets", "technology", "tech", "sports", "sport",
        "entertainment", "politics", "economy", "finance", "opinion", "culture",
        "science", "health", "life", "lifestyle", "travel", "autos",
        # 지역/판 구분도 카테고리처럼 취급
        "us", "uk", "asia", "europe", "china", "india", "korea", "japan", "africa", "middleeast",
    })
    # 무시할 세그먼트(언어/국가/로케일 같은 prefix)
    ignore_slugs: Set[str] = field(default_factory=lambda: {"en", "ko", "kr", "us", "gb", "intl"})
    # 기사 신호(있으면 기사 가능성 증가)
    article_positive_patterns: Iterable[re.Pattern] = field(default_factory=lambda: (
        re.compile(r"/\d{4}/\d{2}/\d{2}/"),    # /YYYY/MM/DD/
        re.compile(r"/\d{6,}/"),               # 숫자 ID
        re.compile(r"-\d{6,}$"),               # 끝에 숫자 ID가 붙은 slug
    ))
    # 카테고리 신호(있으면 카테고리 가능성 증가)
    category_negative_patterns: Iterable[re.Pattern] = field(default_factory=lambda: (
        re.compile(r"/(category|section|topics?|tags?)(/|$)", re.I),
        re.compile(r"/page/\d+(/|$)", re.I),
        re.compile(r"[?&](page|p)=\d+\b", re.I),
        re.compile(r"/(invest_list|company_list|market_info_list|item_list)\.naver", re.I),  # 네이버 목록 페이지
    ))


class URLClassifier:
    """
    규칙:
      - 마지막 세그먼트가 category_slugs 중 하나면 '카테고리'
      - 마지막 세그먼트가 슬래시-only(= 루트)도 '메인/카테고리' 취급
      - 기사 양의 신호가 있으면 기사 후보
      - 카테고리 음의 신호가 있으면 카테고리 후보
      - 충돌 시: (카테고리 신호 > 기사 신호) 우선
    """
    def __init__(self, policy: Optional[CategoryPolicy] = None) -> None:
        self.policy = policy or CategoryPolicy()

    @staticmethod
    def _last_segment(path: str) -> str:
        segs = [s for s in path.split("/") if s]
        return segs[-1].lower() if segs else ""

    @staticmethod
    def _segments(path: str):
        return [s.lower() for s in path.split("/") if s]

    def is_home(self, url: str) -> bool:
        p = urlparse(url)
        return (p.path == "" or p.path == "/") and not p.query

    def is_category_slug(self, slug: str) -> bool:
        return slug in self.policy.category_slugs

    def like_category(self, url: str) -> bool:
        p = urlparse(url)
        if self.is_home(url):
            return True
        segs = self._segments(p.path)
        # ignore 슬러그 제거
        segs = [s for s in segs if s not in self.policy.ignore_slugs]
        if not segs:
            return True
        last = segs[-1]
        # 마지막 세그먼트가 명시된 카테고리면 카테고리 취급
        if self.is_category_slug(last):
            return True
        # 명시적 카테고리 패턴(페이지네이션/태그/섹션 등)
        for pat in self.policy.category_negative_patterns:
            if pat.search(p.path) or pat.search(p.query or ""):
                return True
        # 디렉터리로 끝나는 경로(= 마지막이 빈 세그먼트)도 카테고리 성향
        if p.path.endswith("/"):
            # 예: /business/ 처럼 깊이 1~2 디렉토리인 경우는 카테고리 가능성↑
            depth = len(segs)
            if depth <= 3:
                return True
        return False

    def like_article(self, url: str) -> bool:
        p = urlparse(url)
        if self.is_home(url):
            return False
        path = p.path
        # 먼저 카테고리 신호가 있으면 기사 아님
        if self.like_category(url):
            return False
        # 기사 양의 신호(날짜/숫자ID 등) + 사용자 정의 마지막 슬러그 규칙
        last = self._last_segment(path)
        if last:
            hyphen_rule = (last.count('-') >= 3)
            alnum = re.sub(r"[^a-z0-9]", "", last.lower())
            has_alpha = any(c.isalpha() for c in alnum)
            has_digit = any(c.isdigit() for c in alnum)
            alnum_rule = (has_alpha and has_digit and len(alnum) >= 10)
            numeric_rule = last.isdigit()
            if hyphen_rule or alnum_rule or numeric_rule:
                return True
        # 기존 긍정 패턴
        for pat in self.policy.article_positive_patterns:
            if pat.search(path):
                return True
        # fallback: 깊이가 충분하고 파일형(슬래시로 끝나지 않음)
        segs = self._segments(path)
        return (len(segs) >= 2) and (not path.endswith("/"))

    def classify(self, url: str) -> str:
        """
        returns: 'category' | 'article' | 'unknown'
        """
        if self.like_category(url):
            return "category"
        if self.like_article(url):
            return "article"
        return "unknown"


class URLHelper:
    @staticmethod
    def canonical(u: str) -> str:
        from urllib.parse import urldefrag
        if not isinstance(u, str):
            return ""
        u = u.strip()
        if not u:
            return ""
        clean, _ = urldefrag(u)
        return clean

    @staticmethod
    def domain(u: str) -> str:
        try:
            return urlparse(u).netloc.lower()
        except Exception:
            return ""

    @staticmethod
    def abs(base: str, href: str) -> str:
        from urllib.parse import urljoin
        try:
            return URLHelper.canonical(urljoin(base, href))
        except Exception:
            return ""