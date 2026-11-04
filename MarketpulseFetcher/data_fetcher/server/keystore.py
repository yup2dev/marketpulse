"""
로컬 API 키 저장소.

키를 사용자 설정 폴더의 JSON 파일에 보관하고, 로드 시 os.environ에 주입한다.
QueryExecutor는 자격증명을 환경변수(API_ENV_MAPPING)에서 자동 로드하므로,
주입만 해두면 별도 전달 없이 조회가 동작한다.

provider별 자격증명 형태:
    단일 키 provider (fmp/polygon/fred/alphavantage)  → 문자열 1개
    다중 필드 provider (kis: appkey+appsecret)        → {필드명: 값} dict
두 형태를 모두 지원한다. 어떤 필드를 어떤 환경변수로 주입할지는
API_ENV_MAPPING(util/api_keys.py)이 단일 소스로 정의한다.

저장 위치:
    Windows : %APPDATA%\\MarketPulseFetcher\\keys.json
    기타     : ~/.marketpulse_fetcher/keys.json
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional, Union

from data_fetcher.utils.api_keys import API_ENV_MAPPING

log = logging.getLogger(__name__)

# provider 이름(소문자) → API_ENV_MAPPING 키.  QueryExecutor._PROVIDER_TO_ENV_KEY와 동일.
_PROVIDER_TO_ENV_KEY: Dict[str, str] = {
    "fred": "FRED",
    "yahoo": "YAHOO",
    "alphavantage": "ALPHA_VANTAGE",
    "fmp": "FMP",
    "polygon": "POLYGON",
    "kis": "KIS",
}

# provider 저장값: 단일 키 문자열 또는 {필드명: 값} dict.
KeyValue = Union[str, Dict[str, str]]


def _config_dir() -> Path:
    appdata = os.getenv("APPDATA")
    d = Path(appdata) / "MarketPulseFetcher" if appdata else Path.home() / ".marketpulse_fetcher"
    d.mkdir(parents=True, exist_ok=True)
    return d


class KeyStore:
    def __init__(self, path: Optional[Path] = None) -> None:
        self.path = path or (_config_dir() / "keys.json")
        self._keys: Dict[str, KeyValue] = {}
        self.load()

    # ── 영속화 ────────────────────────────────────────────────────────────────
    def load(self) -> None:
        if self.path.exists():
            try:
                self._keys = json.loads(self.path.read_text(encoding="utf-8"))
            except Exception as exc:
                log.warning("[keystore] load failed (%s): %s", self.path, exc)
                self._keys = {}
        for provider, value in self._keys.items():
            self._inject(provider, value)
        log.info("[keystore] loaded %d key(s) from %s", len(self._keys), self.path)

    def _save(self) -> None:
        try:
            self.path.write_text(json.dumps(self._keys, indent=2), encoding="utf-8")
            try:
                os.chmod(self.path, 0o600)  # 소유자만 읽기/쓰기 (POSIX)
            except OSError:
                pass
        except Exception as exc:
            log.warning("[keystore] save failed: %s", exc)

    # ── 환경변수 매핑/주입 ────────────────────────────────────────────────────
    def _env_map(self, provider: str) -> Dict[str, str]:
        """provider → {필드명: 환경변수명}. 키 불필요 provider면 빈 dict."""
        env_key = _PROVIDER_TO_ENV_KEY.get(provider.lower(), provider.upper())
        return dict(API_ENV_MAPPING.get(env_key) or {})

    def _inject(self, provider: str, value: KeyValue) -> None:
        env_map = self._env_map(provider)
        if not env_map:
            return
        if isinstance(value, dict):
            for field, env_var in env_map.items():
                v = value.get(field)
                if v:
                    os.environ[env_var] = v
        else:
            # 단일 문자열 — 매핑의 첫 필드(보통 api_key)에 주입
            env_var = env_map.get("api_key") or next(iter(env_map.values()), None)
            if env_var:
                os.environ[env_var] = value

    def _clear_env(self, provider: str) -> None:
        for env_var in self._env_map(provider).values():
            os.environ.pop(env_var, None)

    # ── 공개 API ──────────────────────────────────────────────────────────────
    def set(self, provider: str, key: str) -> None:
        """단일 키 provider 설정."""
        provider = provider.lower()
        self._keys[provider] = key
        self._inject(provider, key)
        self._save()
        log.info("[keystore] key set for '%s'", provider)

    def set_fields(self, provider: str, fields: Dict[str, str]) -> None:
        """다중 필드 provider 설정 (예: kis → appkey/appsecret).

        기존 값과 병합하므로 일부 필드만 갱신할 수도 있다(빈 값은 무시)."""
        provider = provider.lower()
        cleaned = {k: v.strip() for k, v in fields.items() if v and v.strip()}
        if not cleaned:
            return
        existing = self._keys.get(provider)
        merged = dict(existing) if isinstance(existing, dict) else {}
        merged.update(cleaned)
        self._keys[provider] = merged
        self._inject(provider, merged)
        self._save()
        log.info("[keystore] fields set for '%s': %s", provider, sorted(cleaned))

    def delete(self, provider: str) -> bool:
        provider = provider.lower()
        if provider not in self._keys:
            return False
        self._clear_env(provider)
        del self._keys[provider]
        self._save()
        return True

    def status(self) -> List[Dict[str, object]]:
        """마스킹된 키 상태만 반환 (원문 키는 절대 노출하지 않음)."""
        def _mask(v: str) -> str:
            return f"{v[:4]}…{v[-2:]}" if len(v) > 6 else "***"

        out: List[Dict[str, object]] = []
        for provider, value in self._keys.items():
            if isinstance(value, dict):
                fields = sorted(k for k, v in value.items() if v)
                masked_first = _mask(next((v for v in value.values() if v), ""))
                out.append({
                    "provider": provider,
                    "configured": bool(fields),
                    "masked": masked_first,
                    "fields": fields,
                })
            else:
                out.append({
                    "provider": provider,
                    "configured": True,
                    "masked": _mask(value),
                    "fields": ["api_key"],
                })
        return out
