"""Image metadata store — renamed from image_store.py."""
import json
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

from ..utils.logging import get_logger

log = get_logger(__name__)


class ImageStore:
    """이미지 메타데이터 저장소"""

    def __init__(self, metadata_path: Path = Path("./data/images/metadata.json")):
        self.metadata_path = metadata_path
        self.metadata_path.parent.mkdir(parents=True, exist_ok=True)
        self.metadata: Dict[str, Dict] = self._load()

    def _load(self) -> Dict[str, Dict]:
        if self.metadata_path.exists():
            try:
                with open(self.metadata_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                log.warning(f"Failed to load metadata: {e}")
                return {}
        return {}

    def _save(self):
        try:
            with open(self.metadata_path, "w", encoding="utf-8") as f:
                json.dump(self.metadata, f, ensure_ascii=False, indent=2)
        except Exception as e:
            log.error(f"Failed to save metadata: {e}")

    def add(self, image_path: Path, article_url: str, is_chart: bool = False, alt: str = ""):
        key = image_path.name
        self.metadata[key] = {
            "path": str(image_path),
            "article_url": article_url,
            "is_chart": is_chart,
            "alt": alt,
            "added_at": datetime.now().isoformat()
        }
        self._save()

    def get(self, image_filename: str) -> Optional[Dict]:
        return self.metadata.get(image_filename)

    def get_by_article(self, article_url: str) -> List[Dict]:
        return [
            meta for meta in self.metadata.values()
            if meta.get("article_url") == article_url
        ]

    def get_charts(self) -> List[Dict]:
        return [
            meta for meta in self.metadata.values()
            if meta.get("is_chart", False)
        ]

    def delete(self, image_filename: str) -> bool:
        if image_filename in self.metadata:
            del self.metadata[image_filename]
            self._save()
            return True
        return False

    def clear(self):
        self.metadata = {}
        self._save()
        log.info("Cleared all image metadata")
