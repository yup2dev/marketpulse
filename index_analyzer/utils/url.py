"""Shared URL helper utilities"""
from urllib.parse import urlparse
from .logging import get_logger

log = get_logger(__name__)


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
