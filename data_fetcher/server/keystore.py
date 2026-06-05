"""
로컬 API 키 저장소.

키를 사용자 설정 폴더의 JSON 파일에 보관하고, 로드 시 os.environ에 주입한다.
QueryExecutor는 자격증명을 환경변수(API_ENV_MAPPING)에서 자동 로드하므로,
주입만 해두면 별도 전달 없이 조회가 동작한다.

저장 위치:
    Windows : %APPDATA%\\MarketPulseFetcher\\keys.json
    기타     : ~/.marketpulse_fetcher/keys.json
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional

from data_fetcher.utils.api_keys import API_ENV_MAPPING

log = logging.getLogger(__name__)

# provider 이름(소문자) → API_ENV_MAPPING 키.  QueryExecutor._PROVIDER_TO_ENV_KEY와 동일.
_PROVIDER_TO_ENV_KEY: Dict[str, str] = {
    "fred": "FRED",
    "yahoo": "YAHOO",
    "alphavantage": "ALPHA_VANTAGE",
    "fmp": "FMP",
    "polygon": "POLYGON",
}


def _config_dir() -> Path:
    appdata = os.getenv("APPDATA")
    d = Path(appdata) / "MarketPulseFetcher" if appdata else Path.home() / ".marketpulse_fetcher"
    d.mkdir(parents=True, exist_ok=True)
    return d


class KeyStore:
    def __init__(self, path: Optional[Path] = None) -> None:
        self.path = path or (_config_dir() / "keys.json")
        self._keys: Dict[str, str] = {}
        self.load()

    # ── 영속화 ────────────────────────────────────────────────────────────────
    def load(self) -> None:
        if self.path.exists():
            try:
                self._keys = json.loads(self.path.read_text(encoding="utf-8"))
            except Exception as exc:
                log.warning("[keystore] load failed (%s): %s", self.path, exc)
                self._keys = {}
        for provider, key in self._keys.items():
            self._inject(provider, key)
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

    # ── 환경변수 주입 ─────────────────────────────────────────────────────────
    def _env_var(self, provider: str) -> Optional[str]:
        env_key = _PROVIDER_TO_ENV_KEY.get(provider.lower(), provider.upper())
        mapping = API_ENV_MAPPING.get(env_key) or {}
        return mapping.get("api_key")  # 키 불필요 provider(YAHOO 등)면 None

    def _inject(self, provider: str, key: str) -> None:
        env_var = self._env_var(provider)
        if env_var:
            os.environ[env_var] = key

    # ── 공개 API ──────────────────────────────────────────────────────────────
    def set(self, provider: str, key: str) -> None:
        provider = provider.lower()
        self._keys[provider] = key
        self._inject(provider, key)
        self._save()
        log.info("[keystore] key set for '%s'", provider)

    def delete(self, provider: str) -> bool:
        provider = provider.lower()
        if provider not in self._keys:
            return False
        env_var = self._env_var(provider)
        if env_var:
            os.environ.pop(env_var, None)
        del self._keys[provider]
        self._save()
        return True

    def status(self) -> List[Dict[str, object]]:
        """마스킹된 키 상태만 반환 (원문 키는 절대 노출하지 않음)."""
        out: List[Dict[str, object]] = []
        for provider, key in self._keys.items():
            masked = f"{key[:4]}…{key[-2:]}" if len(key) > 6 else "***"
            out.append({"provider": provider, "configured": True, "masked": masked})
        return out
