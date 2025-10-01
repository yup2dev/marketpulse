import re
import logging
from typing import Tuple, Iterable, Optional, Pattern
from urllib.parse import urlparse
from bs4 import BeautifulSoup

log = logging.getLogger("multiseed-extractor")
DEFAULT_PARSER = "lxml"


class ArticleHeuristics:
    def __init__(self, allow: Tuple[Pattern[str], ...], deny: Tuple[Pattern[str], ...]) -> None:
        self.allow = allow
        self.deny = deny

    @staticmethod
    def compile(ps: Iterable[str]) -> Tuple[Pattern[str], ...]:
        out = []
        for p in ps:
            try:
                out.append(re.compile(p, re.IGNORECASE))
            except Exception as e:
                log.warning("Bad regex '%s': %s", p, e)
        return tuple(out)

    def looks_like_article(self, url: str, html: Optional[str]) -> bool:
        for d in self.deny:
            if d.search(url):
                return False
        for a in self.allow:
            if a.search(url):
                return True
        # fallback: URL 깊이 기반 휴리스틱
        path = urlparse(url).path
        depth = sum(1 for seg in path.split("/") if seg)
        if depth >= 2 and not path.endswith("/"):
            return True
        # 메타 검사
        if html:
            try:
                soup = BeautifulSoup(html, DEFAULT_PARSER)
                mt = soup.find("meta", {"property": "og:type"})
                if mt and (mt.get("content") or "").lower().strip() == "article":
                    return True
            except Exception:
                pass
        return False