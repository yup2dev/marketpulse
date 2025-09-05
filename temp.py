from __future__ import annotations

import os
import re
import json
import math
import yaml
import logging
import requests
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Tuple, Optional, Pattern, Iterable, Deque, Set, Iterator
from urllib.parse import urljoin, urldefrag, urlparse
from collections import Counter, deque
from datetime import datetime, timedelta, timezone
from bs4 import BeautifulSoup

log = logging.getLogger("multiseed-extractor")
if not log.handlers:
    h = logging.StreamHandler()
    h.setFormatter(logging.Formatter("[%(levelname)s] %(message)s"))
    log.addHandler(h)
log.setLevel(logging.INFO)

try:
    import yfinance as yf  # noqa: F401
except Exception:
    yf = None
    log.info("yahoo finance is not installed")

try:
    from tvDatafeed import TvDatafeed, Interval  # type: ignore
except Exception:
    TvDatafeed = None
    Interval = None

try:
    from constant import SITES_CONFIG_PATH as _CONST_SITES_CFG  # type: ignore
except Exception:
    _CONST_SITES_CFG = os.environ.get("SITES_CONFIG_PATH", "./sites.yaml")


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)
DEFAULT_PARSER = "lxml"

PDF_EXT_RE: Pattern[str] = re.compile(r"\.pdf(?:[?#]|$)", re.I)
MAILTO_JS_RE: Pattern[str] = re.compile(r"^(?:mailto:|javascript:)", re.I)

CHART_HINT_RE: Pattern[str] = re.compile(
    r"(chart|graph|figure|plot|trend|diagram|index|price|candlestick|heatmap|tradingview|highcharts|echarts|"
    r"차트|그래프|도표|캔들)", re.I
)

PERCENT_RE: Pattern[str] = re.compile(r"(?P<value>\d{1,3}(?:\.\d+)?)\s*%")
SENT_SPLIT_RE: Pattern[str] = re.compile(r"(?<=[\.!?])\s+|(?<=다\.)\s+|(?<=요\.)\s+")
TOKEN_RE: Pattern[str] = re.compile(r"[A-Za-z가-힣]+")

STOPWORDS = {
    # en
    "the","a","an","of","and","to","in","for","on","at","by","with","from","that","this","is","are","be","as","it","its","was","were","or","if","not","we","you","they","their","our","i",
    # ko
    "그리고","또한","하지만","그러나","이는","이에","에서","으로","에게","하고","하며","및","등","대한","것","수","등의","있다","없는","됐다","했다","된다","하는","부터","더","가장",
}

LIST_LIKE_RE = re.compile(
    r"/(category|section|tag|tags|topic|topics|list|lists|archive|page/\d+)(/|$)|\b(page|p)=\d+\b",
    re.I
)


@dataclass
class ImageInfo:
    src: str
    alt: str
    is_chart: bool


@dataclass
class ArticleResult:
    url: str
    title: str
    published_at: Optional[str]
    summary: str
    top_words: List[Tuple[str,int]]
    percents: List[Dict[str, Any]]
    sentiment: str
    images: List[ImageInfo]
    charts: List[ImageInfo]
    mapped: Dict[str, Any]
    related_data_plan: Dict[str, Any]
    fetched_series: Dict[str, Any]


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
    max_depth: int = 2
    max_pages_per_domain: int = 50
    same_domain_only: bool = True
    sleep_between_requests: float = 0.0
    include_html_pages: bool = True
    user_agent: str = USER_AGENT
    timeout_get: float = 15.0


@dataclass
class AnalysisConfig:
    top_k_words: int = 20
    summary_sentences: int = 3
    data_window_days: int = 7
    min_word_freq: int = 3


class URLHelper:
    @staticmethod
    def canonical(u: str) -> str:
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
        try:
            return URLHelper.canonical(urljoin(base, href))
        except Exception:
            return ""


def _canon(u: str) -> str:
    u = URLHelper.canonical(u)
    return u[:-1] if u.endswith("/") else u


def is_homepage(url: str, base_url: Optional[str]) -> bool:
    """해당 사이트의 홈(메인)인지 판별: 루트(/) 또는 base_url 과 동일."""
    if not base_url:
        p = urlparse(url)
        return (p.path == "" or p.path == "/") and not p.query
    return _canon(url) == _canon(base_url)


def looks_like_list_page(url: str) -> bool:
    return bool(LIST_LIKE_RE.search(url))


class HttpClient:
    def __init__(self, ua: str = USER_AGENT) -> None:
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.8,ko;q=0.7",
        })

    def get_html(self, url: str, referer: Optional[str] = None, timeout: float = 15.0) -> Optional[str]:
        try:
            headers = {"Referer": referer} if referer else None
            r = self.session.get(url, timeout=timeout, allow_redirects=True, headers=headers)
            if r.status_code >= 400:
                return None
            ct = (r.headers.get("Content-Type") or "").lower()
            if "html" not in ct and "<html" not in (r.text or "").lower():
                return None
            return r.text
        except Exception:
            return None


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
            ("meta", {"property":"article:published_time"}, "content"),
            ("meta", {"name":"pubdate"}, "content"),
            ("meta", {"name":"date"}, "content"),
            ("meta", {"itemprop":"datePublished"}, "content"),
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
        for sel in ("nav","header","footer","aside","script","style","noscript"):
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
            src = URLHelper.abs(self.base_url, src)
            if not src:
                continue
            alt = (img.get("alt") or img.get("title") or "").strip()
            cls = " ".join(img.get("class", [])).lower()
            parents = " ".join(" ".join(p.get("class", [])) for p in img.parents if hasattr(p, "get")).lower()
            is_chart = any([
                CHART_HINT_RE.search(src),
                CHART_HINT_RE.search(alt),
                CHART_HINT_RE.search(cls),
                CHART_HINT_RE.search(parents),
            ])
            info = ImageInfo(src=src, alt=alt, is_chart=is_chart)
            if img.get(is_chart):
                # 차트 내 이미지는 3개 이하로
                if len(charts if is_chart else imgs) < 3:
                    (charts if is_chart else imgs).append(info)
        return imgs, charts


class ArticleHeuristics:
    def __init__(self, allow: Tuple[Pattern[str], ...], deny: Tuple[Pattern[str], ...]) -> None:
        self.allow = allow
        self.deny = deny

    @staticmethod
    def compile(ps: Iterable[str]) -> Tuple[Pattern[str], ...]:
        out: List[Pattern[str]] = []
        for p in ps:
            try:
                out.append(re.compile(p, re.IGNORECASE))
            except Exception as e:
                log.warning("Bad regex '%s': %s", p, e)
        return tuple(out)

    def looks_like_article(self, url: str, html: Optional[str]) -> bool:
        path = urlparse(url).path
        segs = [s for s in path.split("/") if s]

        if not segs:
            return False

        last = segs[-1]

        if last.count("-") >= 3:
            return True
        if len(last) > 10 and re.search(r"[a-zA-Z]", last) and re.search(r"\d", last):
            return True
        if last.isdigit():
            return True
        if html:
            try:
                soup = BeautifulSoup(html, "lxml")
                mt = soup.find("meta", {"property": "og:type"})
                if mt and (mt.get("content") or "").lower().strip() == "article":
                    return True
            except Exception:
                pass

        return False


class NLPAnalyzer:
    def __init__(self, acfg: AnalysisConfig) -> None:
        self.acfg = acfg

    @staticmethod
    def tokenize(text: str) -> List[str]:
        toks = [t.lower() for t in TOKEN_RE.findall(text)]
        return [t for t in toks if t not in STOPWORDS and len(t) > 1]

    def top_words(self, tokens: List[str]) -> List[Tuple[str,int]]:
        cnt = Counter(tokens)
        # 상위 top_k_words 내에서 빈도 self.acfg.min_word_freq 미만은 제외
        return [(w, c) for (w, c) in cnt.most_common(self.acfg.top_k_words) if c >= self.acfg.min_word_freq]

    def summarize(self, text: str) -> str:
        sents = re.split(SENT_SPLIT_RE, text)
        tokens = self.tokenize(text)
        freqs = Counter(tokens)
        scored: List[Tuple[float, str]] = []
        for s in sents:
            if not s or len(s) < 20:
                continue
            score = sum(freqs.get(tok, 0) for tok in self.tokenize(s))
            if score:
                scored.append((score, s.strip()))
        scored.sort(reverse=True, key=lambda x: x[0])
        return " ".join([s for _, s in scored[:self.acfg.summary_sentences]])

    @staticmethod
    def percent_mentions(text: str) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for m in PERCENT_RE.finditer(text):
            val = float(m.group("value"))
            start, end = m.span()
            ctx = text[max(0, start-40): min(len(text), end+40)]
            out.append({"value": val, "context": ctx})
        return out

    @staticmethod
    def simple_sentiment(text: str) -> str:
        pos = {"positive","good","improve","growth","rally","up","increase","beat","strong","expand","record","surge","bull","호재","상승","개선","강세","확대","증가"}
        neg = {"negative","bad","decline","drop","down","miss","weak","recession","fall","risk","bear","악재","하락","둔화","약세","축소","감소"}
        tl = NLPAnalyzer.tokenize(text)
        p = sum(1 for t in tl if t in pos)
        n = sum(1 for t in tl if t in neg)
        if p > n*1.2 and p >= 2:
            return "good"
        if n > p*1.2 and n >= 2:
            return "bad"
        return "neutral"


class EntityMapper:
    ENTITY_DB = {
        "companies": {
            "nvidia": {"aliases": ["nvda","엔비디아","nvidia"], "ticker": "NVDA", "sector": "Semiconductors"},
            "tsmc": {"aliases": ["tsmc","taiwan semiconductor","대만반도체"], "ticker": "TSM", "sector": "Semiconductors"},
            "samsung electronics": {"aliases": ["samsung","삼성전자","005930"], "ticker": "005930.KS", "sector": "Semiconductors"},
            "intel": {"aliases": ["intel","인텔"], "ticker": "INTC", "sector": "Semiconductors"},
            "amd": {"aliases": ["amd","어드밴스트 마이크로 디바이시스"], "ticker": "AMD", "sector": "Semiconductors"},
        },
        "commodities": {
            "crude oil": {"aliases": ["oil","wti","브렌트","원유"], "symbol": "CL=F"},
            "gold": {"aliases": ["gold","xau","금"], "symbol": "GC=F"},
            "copper": {"aliases": ["copper","구리"], "symbol": "HG=F"},
        },
        "macro": {
            "us cpi": {"aliases": ["cpi","inflation","물가"], "fred": "CPIAUCSL"},
            "10y treasury": {"aliases": ["10y","tnx","미국10년물"], "ticker": "^TNX"},
        },
    }

    def map_tokens(self, tokens: List[str]) -> Dict[str, Any]:
        tokset = set(tokens)
        found: Dict[str, Any] = {"companies": [], "commodities": [], "macro": []}
        for cat, items in self.ENTITY_DB.items():
            for name, meta in items.items():
                if any(alias.lower() in tokset for alias in meta["aliases"]):
                    found[cat].append({"name": name, **meta})
        return found


class RelatedDataPlanner:
    def __init__(self, acfg: AnalysisConfig) -> None:
        self.acfg = acfg

    def build(self, mapped: Dict[str, Any], base_time: Optional[datetime], sentiment: str) -> Dict[str, Any]:
        if not base_time:
            base_time = datetime.now(timezone.utc)
        start = base_time - timedelta(days=self.acfg.data_window_days)
        end = base_time + timedelta(days=self.acfg.data_window_days)
        plan = {"window": {"start": start.isoformat(), "end": end.isoformat()}, "targets": [], "recommend": []}
        for c in mapped.get("companies", []):
            plan["targets"].append({"type": "equity", "ticker": c.get("ticker"), "sector": c.get("sector")})
        for cm in mapped.get("commodities", []):
            plan["targets"].append({"type": "commodity", "symbol": cm.get("symbol")})
        for m in mapped.get("macro", []):
            t = {"type": "macro"}
            if m.get("fred"): t["fred_series"] = m["fred"]
            if m.get("ticker"): t["ticker"] = m["ticker"]
            plan["targets"].append(t)
        if sentiment == "good":
            seen = {c.get("sector") for c in mapped.get("companies", []) if c.get("sector")}
            plan["recommend"] = sorted([s for s in seen if s])
        elif sentiment == "bad":
            plan["recommend"] = ["Defensives", "Utilities", "Gold"]
        return plan


class YahooProvider:
    def fetch(self, ticker: str, start: datetime, end: datetime, interval: str = "1d") -> Optional[List[Dict[str, Any]]]:
        if yf is None:
            log.info("yfinance not available; skipping %s", ticker)
            return None
        try:
            df = yf.download(ticker, start=start.date(), end=end.date() + timedelta(days=1), interval=interval, progress=False)
            if df is None or df.empty:
                return []
            out: List[Dict[str, Any]] = []
            for _, row in df.reset_index().iterrows():
                ts = row["Date"]
                out.append({
                    "t": (ts.isoformat() if hasattr(ts, "isoformat") else str(ts)),
                    "o": float(row.get("Open", math.nan)),
                    "h": float(row.get("High", math.nan)),
                    "l": float(row.get("Low", math.nan)),
                    "c": float(row.get("Close", math.nan)),
                    "v": float(row.get("Volume", math.nan)),
                })
            return out
        except Exception as e:
            log.info("yfinance fetch failed for %s: %s", ticker, e)
            return None


class TradingViewProvider:
    def __init__(self) -> None:
        self.enabled = False
        self.client = None
        if TvDatafeed and Interval:
            user = os.environ.get("TV_USERNAME")
            pw = os.environ.get("TV_PASSWORD")
            if user and pw:
                try:
                    self.client = TvDatafeed(username=user, password=pw)
                    self.enabled = True
                except Exception:
                    self.client = None
                    self.enabled = False

    def fetch(self, symbol: str, exchange: Optional[str], start: datetime, end: datetime, interval: str = "1D") -> Optional[List[Dict[str, Any]]]:
        if not self.enabled or self.client is None:
            log.info("TradingView provider not enabled; skipping %s", symbol)
            return None
        try:
            iv = {
                "1D": Interval.in_1_day,
                "4H": Interval.in_4_hour,
                "1H": Interval.in_1_hour,
            }.get(interval.upper(), Interval.in_1_day)
            df = self.client.get_hist(symbol=symbol, exchange=exchange or "", interval=iv, n_bars=1000)
            if df is None or df.empty:
                return []
            out: List[Dict[str, Any]] = []
            for _, row in df.reset_index().iterrows():
                ts = row["datetime"]
                if ts < start or ts > end:
                    continue
                out.append({
                    "t": ts.isoformat(),
                    "o": float(row.get("open", math.nan)),
                    "h": float(row.get("high", math.nan)),
                    "l": float(row.get("low", math.nan)),
                    "c": float(row.get("close", math.nan)),
                    "v": float(row.get("volume", math.nan)),
                })
            return out
        except Exception as e:
            log.info("TradingView fetch failed for %s: %s", symbol, e)
            return None


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
    def __init__(self, ccfg: CrawlConfig, heur: ArticleHeuristics, classifier: URLClassifier, max_depth: int = 2) -> None:
        self.cfg = ccfg
        self.http = HttpClient(ccfg.user_agent)
        self.heur = heur
        self.cls = classifier
        self.max_depth = max_depth

    def discover(self, seeds: List[str]) -> Iterator[str]:
        norm = [URLHelper.canonical(s) for s in seeds if URLHelper.canonical(s)]
        fr = Frontier()
        for s in norm:
            fr.push(s, 0, None)

        per_domain_fetch: Dict[str, int] = {}
        yielded: Set[str] = set()

        while len(fr) > 0 and sum(per_domain_fetch.values()) < self.cfg.max_total:
            item = fr.pop()
            if not item:
                break
            url, depth, referer = item
            dom = URLHelper.domain(url)

            # 도메인별 cap
            if per_domain_fetch.get(dom, 0) >= self.cfg.max_pages_per_domain:
                continue

            html = self.http.get_html(url, referer=referer, timeout=self.cfg.timeout_get)
            if self.cfg.sleep_between_requests:
                try:
                    import time
                    time.sleep(self.cfg.sleep_between_requests)
                except Exception:
                    pass
            if not html:
                continue

            is_article = False
            if self.cfg.include_html_pages and self.heur.looks_like_article(url, html):
                is_article = True
            elif self.cls.classify(url) == "article":
                is_article = True

            if is_article and url not in yielded:
                yielded.add(url)
                per_domain_fetch[dom] = per_domain_fetch.get(dom, 0) + 1
                yield url

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
                fr.push(child, depth + 1, url)


class MarketDataHub:
    def __init__(self) -> None:
        self.yahoo = YahooProvider()
        self.tv = TradingViewProvider()

    def fetch_series(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        out: Dict[str, Any] = {"equity": {}, "commodity": {}, "macro": {}, "tv": {}}
        w = plan.get("window", {})
        try:
            start = datetime.fromisoformat(w.get("start"))
            end = datetime.fromisoformat(w.get("end"))
        except Exception:
            now = datetime.now(timezone.utc)
            start, end = now - timedelta(days=7), now + timedelta(days=7)
        for t in plan.get("targets", []):
            typ = t.get("type")
            if typ == "equity" and t.get("ticker"):
                tk = t["ticker"]
                out["equity"][tk] = self.yahoo.fetch(tk, start, end) or []
                tv_sym = tk.split(".")[0]
                tv_data = self.tv.fetch(tv_sym, None, start, end, "1D")
                if tv_data is not None:
                    out["tv"][tv_sym] = tv_data
            elif typ == "commodity" and t.get("symbol"):
                sym = t["symbol"]
                out["commodity"][sym] = self.yahoo.fetch(sym, start, end) or []
            elif typ == "macro":
                if t.get("ticker"):
                    tk = t["ticker"]
                    out["macro"][tk] = self.yahoo.fetch(tk, start, end) or []
        return out


class Pipeline:
    def __init__(self, ccfg: CrawlConfig, acfg: AnalysisConfig, heur: ArticleHeuristics, cls: URLClassifier) -> None:
        self.ccfg = ccfg
        self.acfg = acfg
        self.crawler = Crawler(ccfg, heur, cls, max_depth=2)
        self.market = MarketDataHub()
        self.nlp = NLPAnalyzer(acfg)
        self.mapper = EntityMapper()
        self.planner = RelatedDataPlanner(acfg)

    def process_article(self, url: str) -> Optional[ArticleResult]:
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
        for url in self.crawler.discover(seed_list):
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

            ar = self.process_article(url)
            if ar:
                d = asdict(ar)
                d["images"] = [asdict(i) for i in ar.images]
                d["charts"] = [asdict(i) for i in ar.charts]
                results.append(d)

        return {"seed_count": len(seed_list), "results": results}


@dataclass
class LoaderConfig:
    sites_config_path: str = _CONST_SITES_CFG


class ConfigLoader:
    @staticmethod
    def load_sites(path: str = _CONST_SITES_CFG) -> List[SiteConfig]:
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
        except FileNotFoundError:
            log.warning("Config file not found: %s", path)
            return []
        except Exception as e:
            log.warning("Config load failed: %s", e)
            return []
        out: List[SiteConfig] = []
        for key, val in (data or {}).items():
            if not isinstance(val, dict):
                continue
            base = val.get("base_url")
            seeds = val.get("seed_urls") or []
            allow = val.get("article_allow") or []
            deny = val.get("article_deny") or []
            seed_list: List[str] = []
            ConfigLoader._add(seed_list, seeds)
            out.append(SiteConfig(name=key, base_url=base, seed_urls=seed_list, article_allow=allow, article_deny=deny))
        return out

    @staticmethod
    def _add(acc: List[str], x: Any) -> None:
        if isinstance(x, str) and x.strip():
            acc.append(x.strip())
        elif isinstance(x, (list, tuple, set)):
            for y in x:
                ConfigLoader._add(acc, y)


@dataclass
class CategoryPolicy:
    """도메인 전역 또는 사이트별 정책."""
    # 카테고리로 취급할 마지막 세그먼트 화이트리스트(= 발견되면 카테고리로 간주)
    category_slugs: Set[str] = field(default_factory=lambda: {
        "world","news","business","markets","technology","tech","sports","sport",
        "entertainment","politics","economy","finance","opinion","culture",
        "science","health","life","lifestyle","travel","autos",
        "international", "europe", "video", "tech", "market", "nightcap", "health",
        "work-transformed", "innovative-cities", "mission-ahead"
        # 지역
        "australia", "asia", "americas", "us","uk","asia","europe","china","india","korea","japan","africa","middleeast",
    })
    # 무시할 세그먼트(언어/국가/로케일 같은 prefix)
    ignore_slugs: Set[str] = field(default_factory=lambda: {"en","ko","kr","us","gb","intl"})
    # 기사 신호(있으면 기사 가능성 증가) – optional
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
    ))


class URLClassifier:
    """
    규칙:
      - 마지막 세그먼트가 category_slugs 중 하나면 '카테고리'(= 기사 아님, 더 탐색)
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

        for s in segs:
            if s not in self.policy.ignore_slugs:
                return True
        # ignore 슬러그 제거 >> 제거가 아닌 여부 확인
        # segs = [s for s in segs if s not in self.policy.ignore_slugs]
        # if not segs:
        #     return True

        last = segs[-1]
        log.info("last tag : %s ", last)
        # 마지막 세그먼트가 명시된 카테고리면 카테고리 취급
        if self.is_category_slug(last):
            return True
        # 명시적 카테고리 패턴(페이지네이션/태그/섹션 등)
        for pat in self.policy.category_negative_patterns:
            if pat.search(p.path) or pat.search(p.query or ""):
                return True
        # 디렉터리로 끝나는 경로(= 마지막이 빈 세그먼트)도 카테고리 성향
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
        # 먼저 카테고리 신호가 있으면 기사 아님
        if self.like_category(url):
            return False
        # 기사 양의 신호(날짜/숫자ID 등)
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


class JSONWriter:
    @staticmethod
    def save(obj: Any, path: str) -> None:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=2)


def run_cli() -> None:
    import argparse
    ap = argparse.ArgumentParser(description="News Multiseed Extractor")
    ap.add_argument("--sites-config", default=_CONST_SITES_CFG)
    ap.add_argument("--max-total", type=int, default=40)
    ap.add_argument("--max-depth", type=int, default=3)
    ap.add_argument("--sleep", type=float, default=1)
    ap.add_argument("--topk", type=int, default=3)
    ap.add_argument("--summary-sents", type=int, default=3)
    ap.add_argument("--window-days", type=int, default=7)
    ap.add_argument("--min-word-freq", type=int, default=3)
    ap.add_argument("--out", default="news_output.json")
    args = ap.parse_args()

    sites = ConfigLoader.load_sites(args.sites_config)
    if not sites:
        log.info("No sites found in %s", args.sites_config)
        return

    # 도메인별 allow/deny 통합
    allows: List[str] = []
    denies: List[str] = []
    for s in sites:
        allows.extend(s.article_allow)
        denies.extend(s.article_deny)

    heur = ArticleHeuristics(
        allow=ArticleHeuristics.compile(allows or [r"/news/|/article/|/story|/research|/report"]),
        deny=ArticleHeuristics.compile(denies or [r"/login|/signin|/account|/m/|/video|/photo|/gallery"]),
    )

    ccfg = CrawlConfig(
        max_total=args.max_total,
        max_depth=args.max_depth,
        sleep_between_requests=args.sleep
    )
    acfg = AnalysisConfig(
        top_k_words=args.topk,
        summary_sentences=args.summary_sents,
        data_window_days=args.window_days,
        min_word_freq=args.min_word_freq
    )

    policy = CategoryPolicy(
        category_slugs={"world", "news", "business", "markets","technology","politics","korea","asia","us","uk"}
    )
    classifier = URLClassifier(policy)

    pipe = Pipeline(ccfg, acfg, heur, classifier)
    result = pipe.run(sites)
    JSONWriter.save(result, args.out)
    print(f"Saved: {args.out}")


if __name__ == "__main__":
    run_cli()