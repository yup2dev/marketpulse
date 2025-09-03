import json
import re
import os
import yaml
import logging

from datetime import datetime
from constants import DEFAULT_LOG_LEVEL

logging.basicConfig(level=DEFAULT_LOG_LEVEL)
logger = logging.getLogger(__name__)


def load_site(config_path: str) -> dict:
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def preprocess_text(text: str) -> str:
    return text.strip().lower()


def filter_urls_by_keyword(urls, keywords):
    pattern = re.compile('|'.join(keywords), re.IGNORECASE)
    return [url for url in urls if pattern.search(url)]


def save_json(data, filepath: str, ensure_dir=True, indent=2):
    # 디렉토리가 없으면 생성
    if ensure_dir:
        os.makedirs(os.path.dirname(filepath), exist_ok=True)

    # datetime 객체를 ISO 8601 형식으로 변환하는 함수
    def datetime_converter(o):
        if isinstance(o, datetime):
            return o.isoformat()  # ISO 포맷으로 변환
        if isinstance(o, type(None)):
            return None  # None을 처리

    # 파일 저장
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=indent, default=datetime_converter)

    logger.info(f"[+] JSON saved to {filepath}")


def load_json(filepath: str, encoding: str = "utf-8") -> dict:
    """
    지정된 경로의 JSON 파일을 불러와 Python 객체로 반환합니다.
    """
    try:
        with open(filepath, "r", encoding=encoding) as f:
            return json.load(f)
    except FileNotFoundError:
        logging.error("Can not find file: {filepath}")
        return {}
    except json.JSONDecodeError as e:
        logging.error(f"Failed to Decode JSON: {filepath}, Error: {e}")
        return {}


# def ensure_openai_api_key():
#     base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
#     dotenv_path = os.path.join(base_dir, ".env")
#     load_dotenv(dotenv_path)
#     openai.api_key = os.getenv("OPENAI_API_KEY")