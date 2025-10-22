import re
import logging
from collections import deque
from typing import Deque, Set, Optional, Tuple, List, Iterator, Dict
from bs4 import BeautifulSoup

from ..models.schemas import CrawlConfig
from .http_client import HttpClient
from .url_classifier import URLClassifier, URLHelper

log = logging.getLogger("multiseed-extractor")

DEFAULT_PARSER = "lxml"
PDF_EXT_RE = re.compile(r"\.pdf(?:[?#]|$)", re.I)
MAILTO_JS_RE = re.compile(r"^(?:mailto:|javascript:)", re.I)


class Frontier:
    """
    Crawler (BFS, article-first)
    """
    def __init__(self) -> None:
        self.q: Deque[Tuple[str, int, Optional[str]]] = deque()
        self.seen: Set[str] = set()

    def push(self, url: str, depth: int, referer: Optional[str]) -> bool:
        u = URLHelper.canonical(url)
        if not u or u in self.seen:
            return False
        self.seen.add(u)
        self.q.append((u, depth, referer))
        return True

    def pop(self) -> Optional[Tuple[str, int, Optional[str]]]:
        if not self.q:
            return None
        return self.q.popleft()

    def __len__(self) -> int:
        return len(self.q)


class Crawler:
    def __init__(self, ccfg: CrawlConfig, heur, classifier: URLClassifier, max_depth: int = 2) -> None:
        self.cfg = ccfg
        self.http = HttpClient(ccfg.user_agent)
        self.heur = heur
        self.cls = classifier
        self.max_depth = max_depth
        self.seed_path_prefixes = []  # seed URL 경로 프리픽스 저장

    def discover(self, seeds: List[str]) -> Iterator[Tuple[str, int]]:
        norm = [URLHelper.canonical(s) for s in seeds if URLHelper.canonical(s)]
        fr = Frontier()
        for s in norm:
            fr.push(s, 0, None)
        per_domain_fetch: Dict[str, int] = {}

        # seed URL들의 경로 프리픽스 추출
        from urllib.parse import urlparse
        self.seed_path_prefixes = [urlparse(s).path.rstrip('/') for s in norm]
        log.info(f"Seed path prefixes: {self.seed_path_prefixes}")

        while len(fr) > 0 and sum(per_domain_fetch.values()) < self.cfg.max_total:
            item = fr.pop()
            if not item:
                break
            url, depth, referer = item
            dom = URLHelper.domain(url)
            html = self.http.get_html(url, referer=referer, timeout=self.cfg.timeout_get)
            if not html:
                continue

            log.info(url)
            label = self.cls.classify(url)

            # 'article'로 명확히 분류된 것만 수집
            if label == "article":
                log.info("is Article %s", url)
                yield url, depth
                per_domain_fetch[dom] = per_domain_fetch.get(dom, 0) + 1

            # max_depth 체크: 링크 탐색 전에만 체크
            if depth >= self.cfg.max_depth:
                continue

            soup = BeautifulSoup(html, DEFAULT_PARSER)
            for a in soup.find_all("a", href=True):
                href = (a.get("href") or "").strip()
                if not href or MAILTO_JS_RE.search(href) or PDF_EXT_RE.search(href):
                    continue
                child = URLHelper.abs(url, href)
                if not child:
                    continue
                if self.cfg.same_domain_only and URLHelper.domain(child) != dom:
                    continue

                # seed URL 경로 프리픽스 체크
                if not self._is_within_seed_path(child):
                    continue

                fr.push(child, depth+1, url)

    def _is_within_seed_path(self, url: str) -> bool:
        """
        URL이 seed URL 경로 내에 있는지 체크

        예: seed = https://finance.yahoo.com/news
            OK: https://finance.yahoo.com/news/article-123
            NG: https://finance.yahoo.com/stocks/...
        """
        from urllib.parse import urlparse

        # seed_path_prefixes가 비어있으면 모든 URL 허용
        if not self.seed_path_prefixes:
            return True

        url_path = urlparse(url).path.rstrip('/')

        # 어느 하나의 seed 경로라도 프리픽스로 포함하면 OK
        for seed_prefix in self.seed_path_prefixes:
            if url_path.startswith(seed_prefix):
                return True

        return False