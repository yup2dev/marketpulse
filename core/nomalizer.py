from typing import Dict
from datetime import timezone


def normalize_record(rec: Dict) -> Dict:
    # ToDo published_at 처리
    return rec