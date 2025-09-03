from typing import Iterable, List, Optional, Set
from urllib.parse import urlparse, urljoin
import re
import time
import requests
from bs4 import BeautifulSoup

PDF_EXT = re.compile(r"\.pdf(\?|#|$)", re.I)
UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/124.0 Safari/537.36"
}


def same_domain(url: str, base_domain: str) -> bool:
    try:
        host = urlparse(url).netloc
        # 정확한 서픽스 매칭(서브도메인 허용, 동명이인 도메인 차단)
        return host == base_domain or host.endswith("." + base_domain)
    except Exception:
        return False


def _looks_like_pdf_content_type(ct: Optional[str]) -> bool:
    if not ct:
        return False
    ct = ct.lower()
    return "application/pdf" in ct or "application/x-pdf" in ct


def _has_pdf_magic_bytes(url: str, timeout: float = 10.0) -> bool:
    try:
        with requests.get(url, headers=UA, timeout=timeout, stream=True, allow_redirects=True) as r:
            r.raise_for_status()
            chunk = next(r.iter_content(chunk_size=8_192), b"")
            return chunk.startswith(b"%PDF-")
    except Exception:
        return False


def is_pdf_url(u: str) -> bool:
    if PDF_EXT.search(u):
        return True
    try:
        r = requests.head(u, headers=UA, timeout=10, allow_redirects=True)
        if _looks_like_pdf_content_type(r.headers.get("Content-Type")):
            return True
    except Exception:
        pass
    return _has_pdf_magic_bytes(u, timeout=10)


def extract_links(html: str, base_url: str) -> List[str]:
    soup = BeautifulSoup(html, "lxml")
    for tag in soup.select("nav, header, footer, aside, menu"):
        tag.decompose()

    out: List[str] = []
    for a in soup.select("a[href]"):
        href = a.get("href")
        if not href:
            continue
        u = urljoin(base_url, href)
        if u.startswith(("mailto:", "javascript:")):
            continue
        out.append(u)
    return out


def discover_urls(
    seeds: List[str],
    base_domain: Optional[str] = None,
    max_total: int = 50,
    max_pages_per_domain: int = 25,
    sleep_between: float = 0.8,
) -> Iterable[str]:
    visited: Set[str] = set()
    per_domain: dict[str, int] = {}
    q: List[str] = list(dict.fromkeys(seeds))
    total = 0

    while q and total < max_total:
        url = q.pop(0)
        if url in visited:
            continue
        visited.add(url)

        d = urlparse(url).netloc
        if base_domain and not same_domain(url, base_domain):
            continue
        if per_domain.get(d, 0) >= max_pages_per_domain:
            continue

        try:
            if is_pdf_url(url):
                yield url
                total += 1
                time.sleep(sleep_between)
                continue

            r = requests.get(url, headers=UA, timeout=12, allow_redirects=True)
            if r.status_code >= 400 or not r.text:
                continue

            per_domain[d] = per_domain.get(d, 0) + 1

            # 현재 페이지도 결과에 포함(원치 않으면 제거)
            yield url
            total += 1
            if total >= max_total:
                break

            for link in extract_links(r.text, url):
                if link not in visited:
                    if not base_domain or same_domain(link, base_domain):
                        q.append(link)

            time.sleep(sleep_between)

        except Exception:
            continue
