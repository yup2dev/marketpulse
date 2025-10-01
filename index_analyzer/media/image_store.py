import json
import logging
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

log = logging.getLogger("multiseed-extractor")


class ImageStore:
    """이미지 메타데이터 저장소"""

    def __init__(self, metadata_path: Path = Path("./data/images/metadata.json")):
        self.metadata_path = metadata_path
        self.metadata_path.parent.mkdir(parents=True, exist_ok=True)
        self.metadata: Dict[str, Dict] = self._load()

    def _load(self) -> Dict[str, Dict]:
        """메타데이터 파일 로드"""
        if self.metadata_path.exists():
            try:
                with open(self.metadata_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                log.warning(f"Failed to load metadata: {e}")
                return {}
        return {}

    def _save(self):
        """메타데이터 파일 저장"""
        try:
            with open(self.metadata_path, "w", encoding="utf-8") as f:
                json.dump(self.metadata, f, ensure_ascii=False, indent=2)
        except Exception as e:
            log.error(f"Failed to save metadata: {e}")

    def add(self, image_path: Path, article_url: str, is_chart: bool = False, alt: str = ""):
        """이미지 메타데이터 추가"""
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
        """이미지 메타데이터 조회"""
        return self.metadata.get(image_filename)

    def get_by_article(self, article_url: str) -> List[Dict]:
        """특정 기사의 이미지 목록 조회"""
        return [
            meta for meta in self.metadata.values()
            if meta.get("article_url") == article_url
        ]

    def get_charts(self) -> List[Dict]:
        """차트 이미지만 조회"""
        return [
            meta for meta in self.metadata.values()
            if meta.get("is_chart", False)
        ]

    def delete(self, image_filename: str) -> bool:
        """이미지 메타데이터 삭제"""
        if image_filename in self.metadata:
            del self.metadata[image_filename]
            self._save()
            return True
        return False

    def clear(self):
        """전체 메타데이터 삭제"""
        self.metadata = {}
        self._save()
        log.info("Cleared all image metadata")