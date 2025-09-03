from __future__ import annotations
from dataclasses import dataclass, field
from typing import Callable, Dict, Iterable, Iterator, List, Optional, Pattern, Set, Tuple
from urllib.parse import urljoin, urlparse
import re
import time
import requests
from bs4 import BeautifulSoup


# -----------------------------
# Config & Rules
# -----------------------------

@dataclass
class CrawlConfig:
    base_domain: Optional[str] = None                 # e.g., "rollcall.com" (None = no constraint)
    same_domain_only: bool = True                     # if True and base_domain=None, restrict to seed's domain(s)
    max_total: int = 200
    max_pages_per_domain: int = 50
    max_depth: int = 10
    sleep_between: float = 0.6                        # polite delay (seconds)
    include_html_pages_in_results: bool = True        # also yield visited HTML pages

    timeout_get: int = 12
    timeout_head: int = 10
    user_agent: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    )

    # Collection mode: 'all' | 'pdf_only' | 'html_only'
    collect_mode: str = "all"

    # Global layout selectors to remove before link extraction
    layout_exclude_selectors: str = "nav, header, footer, aside, menu"

    # Link prefixes to always skip
    skip_prefixes: Tuple[str, ...] = ("mailto:", "javascript:")

    # Patterns for allow/deny URL filtering (applied after absolutizing)
    allow_patterns: List[Pattern] = field(default_factory=list)
    deny_patterns: List[Pattern] = field(default_factory=list)

    # robots.txt handling (simple off by default to keep deps minimal)
    respect_robots: bool = False

    # PDF heuristic
    pdf_regex: Pattern = field(default_factory=lambda: re.compile(r"\.pdf(\?|#|$)", re.I))


# Per-domain behavior overrides & hooks
@dataclass
class DomainRule:
    # Optional per-domain allow/deny patterns (regex)
    allow: List[Pattern] = field(default_factory=list)
    deny: List[Pattern] = field(default_factory=list)

    # Replace/augment the default layout removal CSS selectors
    layout_exclude_selectors: Optional[str] = None

    # Optional custom link post-filter: (url) -> bool
    link_filter: Optional[Callable[[str], bool]] = None

    # Optional link mapper: transform or expand each extracted link
    #   mapper(url) -> Iterable[str]
    link_mapper: Optional[Callable[[str], Iterable[str]]] = None

    # Request/response hooks
    before_request: Optional[Callable[[str], None]] = None
    after_response: Optional[Callable[[requests.Response], None]] = None

    # Override PDF detection (return True/False/None). None = fall back to default
    is_pdf_override: Optional[Callable[[str], Optional[bool]]] = None


# -----------------------------
# Crawler
# -----------------------------

class RuleBasedCrawler:
    def __init__(self, config: CrawlConfig):
        self.cfg = config
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": self.cfg.user_agent})
        self.domain_rules: Dict[str, DomainRule] = {}

        # If same_domain_only and no base_domain provided, seeds' domains will populate this at runtime
        self._allowed_roots: Set[str] = set()

    # ---- Rules ----
    def register_rule(self, domain: str, rule: DomainRule) -> None:
        """
        Register per-domain rule. Domain match is suffix-based (subdomains included).
        Example: "rollcall.com" will match "www.rollcall.com", "sub.rollcall.com".
        """
        self.domain_rules[domain.lower()] = rule

    def _match_rule(self, url: str) -> Optional[DomainRule]:
        host = urlparse(url).netloc.lower()
        for dom, rule in self.domain_rules.items():
            if host == dom or host.endswith("." + dom):
                return rule
        return None

    # ---- Domain constraints ----
    def _host_allowed(self, url: str) -> bool:
        host = urlparse(url).netloc
        if self.cfg.base_domain:
            return host == self.cfg.base_domain or host.endswith("." + self.cfg.base_domain)
        if self.cfg.same_domain_only and self._allowed_roots:
            return host in self._allowed_roots or any(host.endswith("." + r) for r in self._allowed_roots)
        return True

    def _record_seed_domains(self, seeds: List[str]) -> None:
        if not self._allowed_roots and self.cfg.same_domain_only and not self.cfg.base_domain:
            for s in seeds:
                h = urlparse(s).netloc
                if h:
                    # Keep only registrable-ish part: naive; for production use tldextract
                    self._allowed_roots.add(h)

    # ---- Robots (minimal stub) ----
    def _robots_allowed(self, url: str) -> bool:
        # Minimal/no-op unless respect_robots=True
        if not self.cfg.respect_robots:
            return True
        # To implement fully, integrate urllib.robotparser and cache per-domain
        # Keeping as True for now to avoid unexpected block without a parser
        return True

    # ---- PDF detection ----
    def _ct_is_pdf(self, ct: Optional[str]) -> bool:
        if not ct:
            return False
        ct = ct.lower()
        return "application/pdf" in ct or "application/x-pdf" in ct

    def _has_pdf_magic(self, url: str) -> bool:
        try:
            with self.session.get(url, timeout=self.cfg.timeout_head, stream=True, allow_redirects=True) as r:
                r.raise_for_status()
                chunk = next(r.iter_content(chunk_size=8192), b"")
                return chunk.startswith(b"%PDF-")
        except Exception:
            return False

    def is_pdf_url(self, url: str) -> bool:
        rule = self._match_rule(url)
        if rule and rule.is_pdf_override is not None:
            # If override returns True/False use it; if None fall back
            res = rule.is_pdf_override(url)
            if isinstance(res, bool):
                return res

        if self.cfg.pdf_regex.search(url):
            return True
        try:
            r = self.session.head(url, timeout=self.cfg.timeout_head, allow_redirects=True)
            if self._ct_is_pdf(r.headers.get("Content-Type")):
                return True
        except Exception:
            pass
        return self._has_pdf_magic(url)

    # ---- Link extraction ----
    def _extract_links(self, html: str, base_url: str) -> List[str]:
        soup = BeautifulSoup(html, "lxml")

        # Global or per-domain layout exclusion
        rule = self._match_rule(base_url)
        selectors = (rule.layout_exclude_selectors
                     if (rule and rule.layout_exclude_selectors is not None)
                     else self.cfg.layout_exclude_selectors)
        if selectors:
            for t in soup.select(selectors):
                t.decompose()

        links: List[str] = []
        for a in soup.select("a[href]"):
            href = a.get("href")
            if not href:
                continue
            u = urljoin(base_url, href)
            if u.startswith(self.cfg.skip_prefixes):
                continue
            links.append(u)

        # Per-domain link filtering/mapping
        if rule and rule.link_mapper:
            mapped: List[str] = []
            for u in links:
                try:
                    mapped.extend(list(rule.link_mapper(u)))
                except Exception:
                    continue
            links = mapped

        if rule and rule.link_filter:
            links = [u for u in links if rule.link_filter(u)]

        # Global allow/deny
        links = [u for u in links if self._url_allowed_by_patterns(u)]

        return links

    def _url_allowed_by_patterns(self, url: str) -> bool:
        # Apply global allow/deny first
        if self.cfg.allow_patterns:
            if not any(p.search(url) for p in self.cfg.allow_patterns):
                return False
        if any(p.search(url) for p in self.cfg.deny_patterns):
            return False

        # Then domain-level allow/deny
        rule = self._match_rule(url)
        if rule:
            if rule.allow and not any(p.search(url) for p in rule.allow):
                return False
            if any(p.search(url) for p in rule.deny):
                return False
        return True

    # ---- Crawl main ----
    def discover(self, seeds: List[str]) -> Iterator[Tuple[str, str]]:
        """
        BFS-style discovery. Yields (url, kind) where kind in {"pdf", "html"} depending on what was found.
        Respects base_domain/same_domain_only, (optional) robots, allow/deny patterns, and per-domain rules.
        """
        if not seeds:
            return iter(())

        self._record_seed_domains(seeds)

        # queue holds (url, depth)
        q: List[Tuple[str, int]] = []
        seen: Set[str] = set()
        per_domain: Dict[str, int] = {}

        # seed de-dupe preserving order
        for s in list(dict.fromkeys(seeds)):
            q.append((s, 0))

        total = 0

        while q and total < self.cfg.max_total:
            url, depth = q.pop(0)
            if url in seen:
                continue
            seen.add(url)

            if depth > self.cfg.max_depth:
                continue
            if not self._host_allowed(url):
                continue
            if not self._robots_allowed(url):
                continue

            host = urlparse(url).netloc
            if per_domain.get(host, 0) >= self.cfg.max_pages_per_domain:
                continue

            rule = self._match_rule(url)
            if rule and rule.before_request:
                try:
                    rule.before_request(url)
                except Exception:
                    pass

            try:
                # PDF pass (unless html_only)
                if self.cfg.collect_mode != "html_only" and self.is_pdf_url(url):
                    yield (url, "pdf")
                    total += 1
                    time.sleep(self.cfg.sleep_between)
                    continue

                # GET HTML
                r = self.session.get(url, timeout=self.cfg.timeout_get, allow_redirects=True)
                if rule and rule.after_response:
                    try:
                        rule.after_response(r)
                    except Exception:
                        pass

                if r.status_code >= 400 or not r.text:
                    continue

                per_domain[host] = per_domain.get(host, 0) + 1

                # Yield HTML (unless pdf_only)
                if self.cfg.include_html_pages_in_results and self.cfg.collect_mode != "pdf_only":
                    yield (url, "html")
                    total += 1
                    if total >= self.cfg.max_total:
                        break

                # Enqueue children
                for link in self._extract_links(r.text, url):
                    if link not in seen and self._host_allowed(link):
                        q.append((link, depth + 1))

                time.sleep(self.cfg.sleep_between)

            except Exception:
                # swallow network/parse errors
                continue


# -----------------------------
# Example usage
# -----------------------------
if __name__ == "__main__":
    # Build config
    cfg = CrawlConfig(
        base_domain="rollcall.com",           # or None
        same_domain_only=True,                 # if base_domain is None, restrict to seed domains
        max_total=80,
        max_pages_per_domain=40,
        max_depth=6,
        sleep_between=0.5,
        include_html_pages_in_results=True,
        collect_mode="all",                   # 'all' | 'pdf_only' | 'html_only'
    )

    crawler = RuleBasedCrawler(cfg)

    # Per-domain customizations
    crawler.register_rule(
        "rollcall.com",
        DomainRule(
            # Keep Factbase and uploads; block login
            allow=[re.compile(r"/factbase/"), re.compile(r"/uploads?/.*", re.I)],
            deny=[re.compile(r"/wp-login\.php"), re.compile(r"/cart|/checkout")],
            # Remove additional layout blocks if needed
            layout_exclude_selectors="nav, header, footer, aside, menu, .site-footer, .global-header",
            # Only keep http(s)
            link_filter=lambda u: u.startswith("http://") or u.startswith("https://"),
            # Map relative anchors if the site uses weird link patterns (example no-op)
            link_mapper=lambda u: [u],
            # Override PDF detection if the site uses non-standard content types (example: None => fallback)
            is_pdf_override=None,
        )
    )

    seeds = [
        "https://rollcall.com/factbase/trump/search/",
    ]

    for url, kind in crawler.discover(seeds):
        print(kind.upper(), url)
