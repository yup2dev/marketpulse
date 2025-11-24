"""API Credentials Management Utility"""
import os
import logging
from pathlib import Path
from typing import Optional, Dict, Any

log = logging.getLogger(__name__)

# .env 파일 로드 (python-dotenv 사용)
try:
    from dotenv import load_dotenv

    # 프로젝트 루트에서 .env 파일 찾기
    # data_fetcher/utils/api_keys.py -> index_analyzer/.env
    current_file = Path(__file__)
    project_root = current_file.parent.parent.parent  # utils -> data_fetcher -> index_analyzer
    env_file = project_root / ".env"

    if env_file.exists():
        load_dotenv(dotenv_path=env_file)
        log.debug(f"Loaded .env file from {env_file}")
    else:
        log.warning(f".env file not found at {env_file}")

except ImportError:
    log.warning("python-dotenv not installed. Environment variables must be set manually.")
except Exception as e:
    log.warning(f"Error loading .env file: {e}")


class CredentialsError(Exception):
    """API 자격증명 오류"""
    pass


def get_api_key(
    credentials: Optional[Dict[str, str]] = None,
    api_name: str = "API",
    env_var: str = None
) -> str:
    """
    API 키 조회 - credentials 딕셔너리 또는 환경 변수에서

    Args:
        credentials: API 키를 포함한 딕셔너리 (예: {"api_key": "..."})
        api_name: API 이름 (오류 메시지용)
        env_var: 환경 변수 이름 (credentials가 없을 때 조회)

    Returns:
        API 키 문자열

    Raises:
        CredentialsError: API 키가 없을 경우
    """
    api_key = None

    # 1. credentials 딕셔너리에서 조회
    if credentials and isinstance(credentials, dict):
        api_key = credentials.get('api_key') or credentials.get('key')

    # 2. 환경 변수에서 조회
    if not api_key and env_var:
        api_key = os.getenv(env_var)

    if not api_key:
        env_hint = f" Set {env_var} environment variable." if env_var else ""
        raise CredentialsError(
            f"{api_name} API key is required.{env_hint}"
        )

    return api_key


def validate_credentials(
    credentials: Optional[Dict[str, str]],
    required_keys: list,
    api_name: str = "API"
) -> Dict[str, str]:
    """
    필수 자격증명 검증

    Args:
        credentials: 자격증명 딕셔너리
        required_keys: 필수 키 목록
        api_name: API 이름 (오류 메시지용)

    Returns:
        검증된 자격증명 딕셔너리

    Raises:
        CredentialsError: 필수 키가 없을 경우
    """
    if not credentials:
        raise CredentialsError(f"{api_name} credentials are required")

    missing_keys = [key for key in required_keys if key not in credentials]

    if missing_keys:
        raise CredentialsError(
            f"{api_name} credentials missing: {', '.join(missing_keys)}"
        )

    return credentials


def get_credentials_from_env(
    api_name: str,
    required_env_vars: Dict[str, str] = None
) -> Dict[str, str]:
    """
    환경 변수에서 자격증명 로드

    Args:
        api_name: API 이름 (로깅용)
        required_env_vars: {"credential_key": "ENV_VAR_NAME"} 맵
                          (예: {"api_key": "FRED_API_KEY"})

    Returns:
        자격증명 딕셔너리

    Raises:
        CredentialsError: 필수 환경 변수가 없을 경우
    """
    if not required_env_vars:
        required_env_vars = {"api_key": f"{api_name.upper()}_API_KEY"}

    credentials = {}
    missing_vars = []

    for key, env_var in required_env_vars.items():
        value = os.getenv(env_var)
        if value:
            credentials[key] = value
        else:
            missing_vars.append(env_var)

    if missing_vars:
        raise CredentialsError(
            f"{api_name} credentials not found. "
            f"Set environment variable(s): {', '.join(missing_vars)}"
        )

    return credentials


# 사전 설정된 API별 환경 변수 매핑
API_ENV_MAPPING = {
    'FRED': {
        'api_key': 'FRED_API_KEY'
    },
    'ALPHA_VANTAGE': {
        'api_key': 'ALPHA_VANTAGE_API_KEY'
    },
    'YAHOO': {
        # Yahoo Finance는 API 키 불필요
    },
    'POLYGON': {
        'api_key': 'POLYGON_API_KEY'
    },
    'FMP': {
        'api_key': 'FMP_API_KEY'
    },
}


def get_credentials_for_api(api_name: str) -> Dict[str, str]:
    """
    사전 설정된 API별 자격증명 조회

    Args:
        api_name: API 이름 (FRED, ALPHA_VANTAGE, YAHOO 등)

    Returns:
        자격증명 딕셔너리

    Raises:
        CredentialsError: 자격증명을 찾을 수 없을 경우
    """
    if api_name not in API_ENV_MAPPING:
        raise CredentialsError(f"Unknown API: {api_name}")

    required_env_vars = API_ENV_MAPPING[api_name]

    if not required_env_vars:
        # API 키가 필요 없는 경우
        return {}

    return get_credentials_from_env(api_name, required_env_vars)
