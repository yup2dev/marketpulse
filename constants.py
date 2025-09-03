import os
import re
from re import Pattern
from typing import Tuple

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
LOG_DIR = os.path.join(BASE_DIR, "logs")

# 수집 설정
DEFAULT_MEMO_LIMIT = 50
RETRY_COUNT = 3
RETRY_DELAY = 2  # 초 단위

# 저장 포맷
JSON_ENCODING = "utf-8"
DEFAULT_FILE_SUFFIX = ".json"

# 로깅 설정
DEFAULT_LOG_LEVEL = "INFO"
DEFAULT_WAIT_TIME = 3

EXCLUDED_KEYWORDS = {"sports", "audio", "sport"}

SITES_CONFIG_PATH = os.path.join(BASE_DIR, "sites.yaml")
PEOPLE_CONFIG_PATH = os.path.join(BASE_DIR, "resource", "yaml", "people.yaml")

MONTH_MAP = {
    'january': '01', 'february': '02', 'march': '03', 'april': '04',
    'may': '05', 'june': '06', 'july': '07', 'august': '08',
    'september': '09', 'october': '10', 'november': '11', 'december': '12'
}

PDF_EXT_RE: Pattern[str] = re.compile(r"\.pdf(\?|#|$)", re.IGNORECASE)
MAILTO_JS_RE: Pattern[str] = re.compile(r"^(?:mailto:|javascript:|data:)", re.IGNORECASE)
DEFAULT_LAYOUT_EXCLUDE: Tuple[str, ...] = ("nav", "header", "footer", "aside", "menu")
PDF_MAGIC = b"%PDF-"

COLLECT_MODE = str
