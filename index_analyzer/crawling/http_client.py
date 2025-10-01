import requests
from typing import Optional


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


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