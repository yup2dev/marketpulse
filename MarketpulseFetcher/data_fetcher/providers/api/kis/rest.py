"""한국투자증권(KIS) Open API — REST 공통 (access_token 관리 + GET 헬퍼).

WebSocket용 approval_key(stream.py)와 별개로, REST 조회는 OAuth access_token이
필요하다. 토큰은 24h 유효하므로 (appkey, env)별로 캐시한다.
"""
from __future__ import annotations

import time
import logging
from typing import Any, Dict, Optional

try:
    import httpx
    _HAS_HTTPX = True
except ImportError:
    _HAS_HTTPX = False

log = logging.getLogger(__name__)

REST_URL = {
    "real":  "https://openapi.koreainvestment.com:9443",
    "paper": "https://openapivts.koreainvestment.com:29443",
}

# (appkey, env) → (token, expiry_epoch)
_token_cache: Dict[tuple, tuple] = {}


async def get_access_token(appkey: str, appsecret: str, env: str = "real") -> str:
    """OAuth access_token 발급(캐시). 만료 60초 전이면 재발급."""
    if not _HAS_HTTPX:
        raise ImportError("httpx required: pip install httpx")
    key = (appkey, env)
    cached = _token_cache.get(key)
    if cached and cached[1] > time.time() + 60:
        return cached[0]

    url = f"{REST_URL[env]}/oauth2/tokenP"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(url, json={
            "grant_type": "client_credentials",
            "appkey": appkey,
            "appsecret": appsecret,
        })
        resp.raise_for_status()
        data = resp.json()
    token = data.get("access_token")
    if not token:
        raise RuntimeError(f"KIS access_token 발급 실패: {data}")
    _token_cache[key] = (token, time.time() + int(data.get("expires_in", 86400)))
    return token


async def kis_get(
    path: str,
    tr_id: str,
    params: Dict[str, Any],
    appkey: str,
    appsecret: str,
    env: str = "real",
    tr_cont: str = "",
) -> Dict[str, Any]:
    """KIS REST GET 호출 → JSON. 인증 헤더 자동 구성."""
    if not _HAS_HTTPX:
        raise ImportError("httpx required: pip install httpx")
    token = await get_access_token(appkey, appsecret, env)
    headers = {
        "content-type": "application/json; charset=utf-8",
        "authorization": f"Bearer {token}",
        "appkey": appkey,
        "appsecret": appsecret,
        "tr_id": tr_id,
        "custtype": "P",
        "tr_cont": tr_cont,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{REST_URL[env]}{path}", headers=headers, params=params)
        resp.raise_for_status()
        return resp.json()
