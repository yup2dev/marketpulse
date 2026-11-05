"""저장소 경로의 단일 기준점.

웹(MarketpulseWeb) 전용. 배치는 index_analyzer/paths.py 를 따로 갖는다.
`Path(__file__).parent.parent...` 로 루트를 세면 파일 위치가 바뀔 때마다 깨진다.
data/·logs/·.env 는 모두 여기서 가져간다.

MARKETPULSE_ROOT 환경변수로 덮어쓸 수 있다 (Docker 등 레이아웃이 다른 환경).
"""
import os
from pathlib import Path

# MarketpulseWeb/app/backend/core/paths.py → parents[4] = 저장소 루트
REPO_ROOT = Path(os.environ.get("MARKETPULSE_ROOT") or Path(__file__).resolve().parents[4])
DATA_DIR = REPO_ROOT / "data"
DB_PATH = DATA_DIR / "marketpulse.db"
LOG_DIR = REPO_ROOT / "logs"
ENV_FILE = REPO_ROOT / ".env"
