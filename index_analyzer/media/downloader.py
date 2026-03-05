"""Image downloader — renamed from image_downloader.py."""
import hashlib
import requests
from pathlib import Path
from typing import List, Optional, Union
from concurrent.futures import ThreadPoolExecutor, as_completed

from ..models.schemas import ImageInfo
from ..utils.logging import get_logger

log = get_logger(__name__)


class ImageDownloader:
    """이미지 다운로더 (병렬 처리 지원)"""

    def __init__(
        self,
        storage_path: Union[str, Path] = "./data/images",
        max_workers: int = 5,
        timeout: float = 15.0,
    ):
        self.storage = Path(storage_path) if isinstance(storage_path, str) else storage_path
        self.storage.mkdir(parents=True, exist_ok=True)
        self.max_workers = max_workers
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })

    def download(self, url: str, article_id: str, prefix: str = "img") -> Optional[Path]:
        """단일 이미지 다운로드"""
        try:
            url_hash = hashlib.md5(url.encode()).hexdigest()[:12]
            ext = self._get_extension(url)
            filename = f"{article_id}_{prefix}_{url_hash}{ext}"
            filepath = self.storage / filename

            if filepath.exists():
                log.debug(f"Image already exists: {filepath}")
                return filepath

            response = self.session.get(url, timeout=self.timeout, stream=True)
            response.raise_for_status()

            with open(filepath, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            log.info(f"Downloaded: {url} -> {filepath}")
            return filepath

        except Exception as e:
            log.warning(f"Failed to download {url}: {e}")
            return None

    def download_batch(self, images: List[ImageInfo], article_id: str) -> List[Optional[Path]]:
        """배치 다운로드 (병렬 처리)"""
        if not images:
            return []

        results = []
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {}
            for img in images:
                prefix = "chart" if img.is_chart else "img"
                future = executor.submit(self.download, img.src, article_id, prefix)
                futures[future] = img.src

            for future in as_completed(futures):
                url = futures[future]
                try:
                    result = future.result()
                    results.append(result)
                except Exception as e:
                    log.error(f"Error downloading {url}: {e}")
                    results.append(None)

        return results

    @staticmethod
    def _get_extension(url: str) -> str:
        url_clean = url.split("?")[0].split("#")[0]
        common_exts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"]
        for ext in common_exts:
            if url_clean.lower().endswith(ext):
                return ext
        return ".jpg"

    def clear_storage(self):
        """저장소 전체 삭제"""
        import shutil
        if self.storage.exists():
            shutil.rmtree(self.storage)
            self.storage.mkdir(parents=True, exist_ok=True)
            log.info(f"Cleared storage: {self.storage}")
