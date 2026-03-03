"""
Multi-threaded BFS crawler — renamed from multi_thread_crawler.py.
"""
import logging
import threading
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Set, Tuple, Optional, Dict
from bs4 import BeautifulSoup

from ..models.schemas import CrawlConfig, ArticleResult
from ..utils.http import HttpClient
from ..utils.url import URLHelper
from .classifier import URLClassifier
from ..parsing.parser import Parser
from ..parsing.heuristics import ArticleHeuristics

log = logging.getLogger("multi-thread-crawler")

DEFAULT_PARSER = "lxml"


class MultiThreadCrawler:
    """
    멀티스레드 BFS 크롤러
    - 여러 seed URL을 동시에 BFS 탐색
    - 기사 본문만 크롤링 (메뉴/카테고리 제외)
    - 차트 이미지만 선별 수집
    """

    def __init__(
        self,
        config: CrawlConfig,
        heuristics: ArticleHeuristics,
        classifier: URLClassifier,
        max_workers: int = 10,
    ):
        self.config = config
        self.heuristics = heuristics
        self.classifier = classifier
        self.max_workers = max_workers
        self.http = HttpClient(config.user_agent)

        self.lock = threading.Lock()
        self.visited: Set[str] = set()
        self.queue: deque = deque()
        self.results: List[ArticleResult] = []

    def crawl(self, seed_urls: List[str]) -> List[ArticleResult]:
        """멀티스레드로 seed URL들을 BFS 크롤링"""
        for seed in seed_urls:
            canonical = URLHelper.canonical(seed)
            if canonical:
                with self.lock:
                    if canonical not in self.visited:
                        self.visited.add(canonical)
                        self.queue.append((canonical, 0))

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = []

            while self.queue or futures:
                while self.queue and len(futures) < self.max_workers * 2:
                    url, depth = self.queue.popleft()
                    future = executor.submit(self._process_url, url, depth)
                    futures.append(future)

                if futures:
                    done, futures = self._wait_for_completion(futures)

                    for future in done:
                        try:
                            child_urls = future.result()
                            if child_urls:
                                self._add_to_queue(child_urls)
                        except Exception as e:
                            log.error(f"Thread error: {e}")

                if len(self.results) >= self.config.max_total:
                    log.info(f"Reached max_total limit: {self.config.max_total}")
                    break

        return self.results

    def _process_url(self, url: str, depth: int) -> List[Tuple[str, int]]:
        if depth > self.config.max_depth:
            return []

        label = self.classifier.classify(url)

        if label == "category":
            log.debug(f"[Category] {url}")
            return self._extract_links(url, depth)

        if label == "article":
            log.info(f"[Article] {url}")
            self._process_article(url, depth)
            return self._extract_links(url, depth)

        html = self.http.get_html(url, timeout=self.config.timeout_get)
        if html and self.heuristics.looks_like_article(url, html):
            log.info(f"[Article - Heuristic] {url}")
            self._process_article(url, depth, html=html)
            return self._extract_links(url, depth, html=html)

        return self._extract_links(url, depth, html=html)

    def _process_article(self, url: str, depth: int, html: str = None):
        if not html:
            html = self.http.get_html(url, timeout=self.config.timeout_get)
        if not html:
            return

        parser = Parser(url, html)
        title = parser.extract_title()
        published_time = parser.extract_published_time()
        main_text = parser.extract_main_text()
        _, charts = parser.extract_images()

        article = ArticleResult(
            url=url,
            title=title,
            published_time=published_time,
            text=main_text,
            charts=[chart.src for chart in charts],
            depth=depth,
        )

        with self.lock:
            self.results.append(article)
            log.info(f"Saved article: {title[:50]}...")

    def _extract_links(self, url: str, depth: int, html: str = None) -> List[Tuple[str, int]]:
        if not html:
            html = self.http.get_html(url, timeout=self.config.timeout_get)
        if not html:
            return []

        soup = BeautifulSoup(html, DEFAULT_PARSER)
        child_urls = []

        for a in soup.find_all("a", href=True):
            href = a.get("href", "").strip()
            if not href:
                continue

            child_url = URLHelper.abs(url, href)
            if not child_url:
                continue

            if self.config.same_domain_only:
                if URLHelper.domain(child_url) != URLHelper.domain(url):
                    continue

            with self.lock:
                if child_url not in self.visited:
                    self.visited.add(child_url)
                    child_urls.append((child_url, depth + 1))

        return child_urls

    def _add_to_queue(self, urls: List[Tuple[str, int]]):
        with self.lock:
            for url, depth in urls:
                self.queue.append((url, depth))

    def _wait_for_completion(self, futures):
        done = set()
        pending = set(futures)
        try:
            for future in as_completed(futures, timeout=5.0):
                done.add(future)
                pending.discard(future)
        except Exception:
            pass
        return done, list(pending)
