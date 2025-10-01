from typing import List, Dict, Any


class EntityMapper:
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