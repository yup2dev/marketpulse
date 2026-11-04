"""OpenBB 이식 provider 가 참조하는 시스템 설정/캐시 경로 (최소 구현).

OpenBB 는 system_settings.json 에서 프록시/SSL/API prefix 를 읽지만, 이 프로젝트에는
해당 설정이 없으므로 빈 http 설정과 기본 prefix 를 반환한다.
"""
import os
import tempfile
from typing import Any, Dict


def get_user_cache_directory() -> str:
    """캐시 디렉토리(OS 임시 디렉토리 하위)."""
    path = os.path.join(tempfile.gettempdir(), "marketpulse_provider_cache")
    os.makedirs(path, exist_ok=True)
    return path


class _PythonSettings:
    @staticmethod
    def model_dump() -> Dict[str, Any]:
        return {"http": {}}


class _ApiSettings:
    prefix: str = "/api/v1"


class _SystemSettings:
    python_settings = _PythonSettings()
    api_settings = _ApiSettings()


class SystemService:
    """OpenBB SystemService 최소 스텁."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self.system_settings = _SystemSettings()


__all__ = ["SystemService", "get_user_cache_directory"]
