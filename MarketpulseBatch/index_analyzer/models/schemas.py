from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict, Any, Tuple, Optional


@dataclass
class ImageInfo:
    src: str
    alt: str
    is_chart: bool


@dataclass
class ArticleResult:
    url: str
    title: str
    published_time: Optional[str] = None
    text: str = ""
    charts: List[str] = field(default_factory=list)
    depth: int = 0


@dataclass
class SiteConfig:
    name: str
    base_url: Optional[str]
    seed_urls: List[str]
    article_allow: List[str] = field(default_factory=list)
    article_deny: List[str] = field(default_factory=list)


@dataclass
class CrawlConfig:
    max_total: int = 200
    max_depth: int = 3
    max_pages_per_domain: int = 50
    same_domain_only: bool = True
    sleep_between_requests: float = 0.0
    include_html_pages: bool = True
    user_agent: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
    timeout_get: float = 15.0


