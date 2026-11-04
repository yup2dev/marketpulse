"""
URL Classifier — renamed from url_classifier.py.
URLHelper is now canonical in utils.url; re-exported here for backward compat.
"""
import re
from dataclasses import dataclass, field
from typing import Set, Iterable, Optional
from urllib.parse import urlparse

# Re-export URLHelper from utils so existing importers of this module still work
from ..utils.url import URLHelper  # noqa: F401


@dataclass
class CategoryPolicy:
    """도메인 전역 또는 사이트별 정책."""
    category_slugs: Set[str] = field(default_factory=lambda: {
        "world", "news", "business", "markets", "technology", "tech", "sports", "sport",
        "entertainment", "politics", "economy", "finance", "opinion", "culture",
        "science", "health", "life", "lifestyle", "travel", "autos",
        "us", "uk", "asia", "europe", "china", "india", "korea", "japan", "africa", "middleeast",
        "americas", "australia", "united-kingdom", "middle-east",
        "menu", "nav", "navigation", "sitemap", "archive", "category", "categories",
        "section", "sections", "topic", "topics", "tag", "tags",
        "videos", "photos", "gallery", "media", "audio", "podcast", "tv-shows", "movies",
        "celebrities", "video", "podcasts",
        "tech", "media", "investing", "markets-now", "nightcap", "premarkets", "after-hours",
        "fear-and-greed", "financial-calculators", "innovate", "work-transformed",
        "fitness", "food", "sleep", "mindfulness", "relationships",
        "foreseeable-future", "mission-ahead", "innovative-cities", "inside-africa",
        "paris-olympics-2024", "president-donald-trump-47", "ukraine", "israel",
        "all-shows", "schedule", "5-things", "chasing-life", "the-assignment",
        "one-thing", "tug-of-war", "political-briefing", "axe-files",
        "all-there-is-with-anderson-cooper", "weather-video",
        "latin_america", "middle_east", "northern_ireland_politics", "scotland_politics",
        "wales_politics", "ai-v-the-mind", "antarctica", "australia-and-pacific",
        "caribbean", "central-america", "north-america", "south-america",
        "to-the-ends-of-the-earth", "war-in-ukraine", "bbcindepth", "bbcverify",
        "in_pictures", "topics", "destinations", "worlds-table", "cultural-experiences",
        "adventures", "specialist", "natural-wonders", "weather-science", "solutions",
        "sustainable-business", "green-living", "arts-in-motion", "executive-lounge",
        "technology-of-business", "future-of-business", "film-tv", "entertainment-news",
        "categories", "stations",
        "games", "play", "cnn-crossword", "jumble-crossword-daily", "photo-shuffle",
        "sudoblock", "daily-sudoku",
        "about", "contact", "privacy", "terms", "policy", "advertise",
        "subscribe", "newsletter", "rss", "feed", "settings", "account", "follow",
        "newsletters", "profiles", "cnn-leadership",
    })
    ignore_slugs: Set[str] = field(default_factory=lambda: {"en", "ko", "kr", "us", "gb", "intl"})
    article_positive_patterns: Iterable[re.Pattern] = field(default_factory=lambda: (
        re.compile(r"/\d{4}/\d{2}/\d{2}/"),
        re.compile(r"/\d{6,}/"),
        re.compile(r"-\d{6,}$"),
    ))
    category_negative_patterns: Iterable[re.Pattern] = field(default_factory=lambda: (
        re.compile(r"/(category|section|topics?|tags?)(/|$)", re.I),
        re.compile(r"/page/\d+(/|$)", re.I),
        re.compile(r"[?&](page|p)=\d+\b", re.I),
        re.compile(r"/(menu|nav|sitemap|archive)", re.I),
        re.compile(r"/(video|photo|gallery|image|media)s?(/|$)", re.I),
        re.compile(r"\.(pdf|doc|docx|xls|xlsx|zip|rar)$", re.I),
        re.compile(r"/(podcasts?|audio)(/[^/]+)?$", re.I),
        re.compile(r"/(games?|play)/[^/]+$", re.I),
        re.compile(r"/(tv|schedule|shows)/", re.I),
        re.compile(r"/(live-tv|live-news)(/|$)", re.I),
        re.compile(r"/destinations?(/[^/]+)?$", re.I),
        re.compile(r"_politics?$", re.I),
        re.compile(r"/\w+/\w+_\w+$", re.I),
    ))


class URLClassifier:
    """URL 분류기: 'category' | 'article' | 'unknown'"""

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
        segs = [s for s in segs if s not in self.policy.ignore_slugs]
        if not segs:
            return True
        last = segs[-1]
        if self.is_category_slug(last):
            return True
        for pat in self.policy.category_negative_patterns:
            if pat.search(p.path) or pat.search(p.query or ""):
                return True
        if p.path.endswith("/"):
            depth = len(segs)
            if depth <= 3:
                return True
        return False

    def like_article(self, url: str) -> bool:
        p = urlparse(url)
        if self.is_home(url):
            return False
        path = p.path
        for pat in self.policy.article_positive_patterns:
            if pat.search(path):
                return True
        last = self._last_segment(path)
        if last:
            if re.match(r'\d{4}-\d{2}-\d{2}', last):
                return True
            hyphen_rule = (last.count('-') >= 3)
            alnum = re.sub(r"[^a-z0-9]", "", last.lower())
            has_alpha = any(c.isalpha() for c in alnum)
            has_digit = any(c.isdigit() for c in alnum)
            alnum_rule = (has_alpha and has_digit and len(alnum) >= 10)
            numeric_rule = last.isdigit() and len(last) >= 6
            if hyphen_rule or alnum_rule or numeric_rule:
                return True
        if self.like_category(url):
            return False
        segs = self._segments(path)
        return len(segs) >= 3

    def classify(self, url: str) -> str:
        if self.like_article(url):
            return "article"
        if self.like_category(url):
            return "category"
        return "unknown"
