import logging
from dataclasses import asdict
from typing import List, Dict, Any, Set
from urllib.parse import urlparse

from .models.schemas import SiteConfig, CrawlConfig, AnalysisConfig, ArticleResult
from .crawling import Crawler, URLClassifier
from .parsing import Parser, ArticleHeuristics
from .analysis import NLPAnalyzer, EntityMapper
from .data import MarketDataHub, RelatedDataPlanner
from .crawling.url_classifier import URLHelper

log = logging.getLogger("multiseed-extractor")


def _canon(u: str) -> str:
    u = URLHelper.canonical(u)
    return u[:-1] if u.endswith("/") else u


def is_homepage(url: str, base_url: str | None) -> bool:
    """해당 사이트의 홈(메인)인지 판별: 루트(/) 또는 base_url 과 동일."""
    if not base_url:
        p = urlparse(url)
        return (p.path == "" or p.path == "/") and not p.query
    return _canon(url) == _canon(base_url)


LIST_LIKE_RE = __import__('re').compile(
    r"/(category|section|tag|tags|topic|topics|list|lists|archive|page/\d+)(/|$)|\b(page|p)=\d+\b",
    __import__('re').I
)


def looks_like_list_page(url: str) -> bool:
    return bool(LIST_LIKE_RE.search(url))


class Pipeline:
    def __init__(self, ccfg: CrawlConfig, acfg: AnalysisConfig, heur: ArticleHeuristics, cls: URLClassifier) -> None:
        self.ccfg = ccfg
        self.acfg = acfg
        self.crawler = Crawler(ccfg, heur, cls, max_depth=ccfg.max_depth)
        self.market = MarketDataHub()
        self.nlp = NLPAnalyzer(acfg)
        self.mapper = EntityMapper()
        self.planner = RelatedDataPlanner(acfg)

    def process_article(self, url: str, depth: int) -> ArticleResult | None:
        http = self.crawler.http
        html = http.get_html(url, timeout=self.ccfg.timeout_get)
        if not html:
            return None
        p = Parser(url, html)
        title = p.extract_title()
        published = p.extract_published_time()
        text = p.extract_main_text()
        imgs, charts = p.extract_images()

        if len(charts) == 0:
            imgs = []

        tokens = self.nlp.tokenize(text)
        summary = self.nlp.summarize(text)
        topw = self.nlp.top_words(tokens)
        percents = self.nlp.percent_mentions(text) if len(charts) == 0 else []
        sentiment = self.nlp.simple_sentiment(text)
        mapped = self.mapper.map_tokens(tokens)
        plan = self.planner.build(mapped, published, sentiment)
        series = self.market.fetch_series(plan)
        return ArticleResult(
            url=url,
            title=title,
            published_at=(published.isoformat() if published else None),
            summary=summary,
            top_words=topw,
            percents=percents,
            sentiment=sentiment,
            images=imgs,
            charts=charts,
            mapped=mapped,
            related_data_plan=plan,
            fetched_series=series,
            depth=depth,
        )

    def run(self, sites: List[SiteConfig]) -> Dict[str, Any]:
        results: List[Dict[str, Any]] = []

        # --------- 제외 집합 구성 (seed + base_url) ----------
        exclude_urls: Set[str] = set()
        base_by_domain: Dict[str, str] = {}
        seed_list: List[str] = []

        for s in sites:
            if s.base_url:
                exclude_urls.add(_canon(s.base_url))
                base_by_domain[URLHelper.domain(s.base_url)] = s.base_url
            for u in s.seed_urls:
                seed_list.append(u)
                exclude_urls.add(_canon(u))

        # --------- 크롤링 & 필터링 ----------
        for url, depth in self.crawler.discover(seed_list):
            # (a) 시드/베이스 제외
            if _canon(url) in exclude_urls:
                continue
            # (b) 메인 페이지(홈) 제외
            dom = URLHelper.domain(url)
            base_for_domain = base_by_domain.get(dom)
            if is_homepage(url, base_for_domain):
                continue
            # (c) 리스트/카테고리/태그/페이징 제외(선택)
            if looks_like_list_page(url):
                continue

            ar = self.process_article(url, depth)
            if ar:
                d = asdict(ar)
                d["images"] = [asdict(i) for i in ar.images]
                d["charts"] = [asdict(i) for i in ar.charts]
                results.append(d)

        return {"seed_count": len(seed_list), "results": results}