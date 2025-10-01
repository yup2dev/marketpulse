import os
import yaml
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path

log = logging.getLogger("multiseed-extractor")


class EntityMapper:
    """
    동적 엔티티 매핑 시스템

    설정 방법:
    1. YAML 파일 (entities.yaml)
    2. JSON 파일
    3. 환경변수 (ENTITIES_CONFIG_PATH)
    4. 런타임 추가 (add_entity 메소드)
    """

    def __init__(self, config_path: Optional[str] = None):
        """
        Args:
            config_path: entities.yaml 경로 (기본값: ./entities.yaml)
        """
        self.entity_db: Dict[str, Dict[str, Any]] = {
            "companies": {},
            "commodities": {},
            "macro": {}
        }

        # 설정 파일 로드
        if config_path is None:
            config_path = os.environ.get("ENTITIES_CONFIG_PATH", "./entities.yaml")

        self.config_path = Path(config_path)
        self._load_from_file()

    def _load_from_file(self):
        """YAML 파일에서 엔티티 로드"""
        if not self.config_path.exists():
            log.warning(f"Entity config not found: {self.config_path}. Using empty database.")
            return

        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}

            # 각 카테고리별 로드
            for category in ["companies", "commodities", "macro"]:
                if category in data:
                    for entity_name, entity_data in data[category].items():
                        self.add_entity(
                            category=category,
                            name=entity_name,
                            metadata=entity_data
                        )

            total = sum(len(v) for v in self.entity_db.values())
            log.info(f"Loaded {total} entities from {self.config_path}")

        except Exception as e:
            log.error(f"Failed to load entity config: {e}")

    def add_entity(self, category: str, name: str, metadata: Dict[str, Any]):
        """
        런타임에 엔티티 추가

        Args:
            category: "companies", "commodities", "macro"
            name: 엔티티 이름
            metadata: {"ticker": "NVDA", "sector": "Semiconductors", "aliases": [...]}
        """
        if category not in self.entity_db:
            log.warning(f"Unknown category: {category}")
            return

        self.entity_db[category][name] = metadata

    def remove_entity(self, category: str, name: str) -> bool:
        """엔티티 제거"""
        if category in self.entity_db and name in self.entity_db[category]:
            del self.entity_db[category][name]
            return True
        return False

    def map_tokens(self, tokens: List[str]) -> Dict[str, Any]:
        """토큰에서 엔티티 매칭"""
        tokset = set(t.lower() for t in tokens)
        found: Dict[str, Any] = {"companies": [], "commodities": [], "macro": []}

        for cat, items in self.entity_db.items():
            for name, meta in items.items():
                aliases = meta.get("aliases", [])
                if any(alias.lower() in tokset for alias in aliases):
                    found[cat].append({"name": name, **meta})

        return found

    def search_entity(self, query: str) -> List[Dict[str, Any]]:
        """엔티티 검색"""
        query_lower = query.lower()
        results = []

        for cat, items in self.entity_db.items():
            for name, meta in items.items():
                # 이름 또는 별칭에 쿼리 포함
                if query_lower in name.lower():
                    results.append({"category": cat, "name": name, **meta})
                    continue

                aliases = meta.get("aliases", [])
                if any(query_lower in alias.lower() for alias in aliases):
                    results.append({"category": cat, "name": name, **meta})

        return results

    def get_entity(self, category: str, name: str) -> Optional[Dict[str, Any]]:
        """특정 엔티티 조회"""
        return self.entity_db.get(category, {}).get(name)

    def get_all_tickers(self) -> List[str]:
        """모든 티커 목록 반환"""
        tickers = []

        # 기업 티커
        for meta in self.entity_db.get("companies", {}).values():
            if "ticker" in meta:
                tickers.append(meta["ticker"])

        # 원자재 심볼
        for meta in self.entity_db.get("commodities", {}).values():
            if "symbol" in meta:
                tickers.append(meta["symbol"])

        # 매크로 지표
        for meta in self.entity_db.get("macro", {}).values():
            if "ticker" in meta:
                tickers.append(meta["ticker"])

        return tickers

    def get_sector_tickers(self, sector: str) -> List[str]:
        """특정 섹터의 티커 목록"""
        tickers = []
        for meta in self.entity_db.get("companies", {}).values():
            if meta.get("sector") == sector and "ticker" in meta:
                tickers.append(meta["ticker"])
        return tickers

    def export_to_yaml(self, output_path: str):
        """현재 엔티티 DB를 YAML로 내보내기"""
        with open(output_path, "w", encoding="utf-8") as f:
            yaml.dump(self.entity_db, f, allow_unicode=True, sort_keys=False)
        log.info(f"Exported entities to {output_path}")

    def reload(self):
        """설정 파일 다시 로드"""
        self.entity_db = {"companies": {}, "commodities": {}, "macro": {}}
        self._load_from_file()

    def get_stats(self) -> Dict[str, int]:
        """통계 정보"""
        return {
            "companies": len(self.entity_db.get("companies", {})),
            "commodities": len(self.entity_db.get("commodities", {})),
            "macro": len(self.entity_db.get("macro", {})),
            "total": sum(len(v) for v in self.entity_db.values())
        }


# 레거시 호환성 - 기존 하드코딩 방식
class EntityMapperLegacy:
    """기존 하드코딩 방식 (하위 호환성)"""
    ENTITY_DB = {
        "companies": {
            "nvidia": {"aliases": ["nvda", "엔비디아", "nvidia"], "ticker": "NVDA", "sector": "Semiconductors"},
            "tsmc": {"aliases": ["tsmc", "taiwan semiconductor", "대만반도체"], "ticker": "TSM", "sector": "Semiconductors"},
            "samsung electronics": {"aliases": ["samsung", "삼성전자", "005930"], "ticker": "005930.KS", "sector": "Semiconductors"},
            "intel": {"aliases": ["intel", "인텔"], "ticker": "INTC", "sector": "Semiconductors"},
            "amd": {"aliases": ["amd", "어드밴스트 마이크로 디바이시스"], "ticker": "AMD", "sector": "Semiconductors"},
        },
        "commodities": {
            "crude oil": {"aliases": ["oil", "wti", "브렌트", "원유"], "symbol": "CL=F"},
            "gold": {"aliases": ["gold", "xau", "금"], "symbol": "GC=F"},
            "copper": {"aliases": ["copper", "구리"], "symbol": "HG=F"},
        },
        "macro": {
            "us cpi": {"aliases": ["cpi", "inflation", "물가"], "fred": "CPIAUCSL"},
            "10y treasury": {"aliases": ["10y", "tnx", "미국10년물"], "ticker": "^TNX"},
        },
    }

    def map_tokens(self, tokens: List[str]) -> Dict[str, Any]:
        tokset = set(tokens)
        found: Dict[str, Any] = {"companies": [], "commodities": [], "macro": []}
        for cat, items in self.ENTITY_DB.items():
            for name, meta in items.items():
                if any(alias.lower() in tokset for alias in meta["aliases"]):
                    found[cat].append({"name": name, **meta})
        return found