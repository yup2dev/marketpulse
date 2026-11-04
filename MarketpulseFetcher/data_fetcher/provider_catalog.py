"""Provider 카탈로그 — 설정 화면·/api/providers 가 쓰는 provider 표시 정보의 단일 소스.

무엇이 필요한지(credentials)와 무엇을 제공하는지(models)는 ProviderRegistry 가 이미 안다.
여기는 사람이 읽을 정보만 덧붙인다: 표시명, 설명, 키 발급 링크, 키 필드 라벨, 키 검증 호출.
선언형 provider(JSON 스펙)는 스펙의 label/description/key_test 를 그대로 쓴다 — 이 파일 수정 불필요.

키 검증(key_test)은 저장된 키가 실제로 동작하는지 보는 가장 싼 호출이다. 없으면 '검증 미지원'.
"""
from typing import Any, Dict, List, Optional

_INFO: Dict[str, Dict[str, Any]] = {
    "fred": {
        "label": "FRED", "desc": "미국 거시경제 지표 (세인트루이스 연준)",
        "key_docs": "https://fred.stlouisfed.org/docs/api/api_key.html",
        "key_test": {"model": "series", "params": {"series_id": "DGS10", "limit": 1, "sort_order": "desc"}},
    },
    "fmp": {
        "label": "Financial Modeling Prep", "desc": "재무 · 기업 · 애널리스트 데이터",
        "key_docs": "https://site.financialmodelingprep.com/developer/docs",
        "key_test": {"model": "quote", "params": {"symbol": "AAPL"}},
    },
    "polygon": {
        "label": "Polygon.io", "desc": "미국 시세 · 뉴스 · 옵션",
        "key_docs": "https://polygon.io/dashboard/api-keys",
        "key_test": {"model": "news", "params": {"limit": 1}},
    },
    "alphavantage": {
        "label": "Alpha Vantage", "desc": "시세 · 환율 · 암호화폐",
        "key_docs": "https://www.alphavantage.co/support/#api-key",
        "key_test": {"model": "quote", "params": {"symbol": "IBM"}},
    },
    "tiingo": {
        "label": "Tiingo", "desc": "미국 주식 일별 시세",
        "key_docs": "https://www.tiingo.com/account/api/token",
        "key_test": {"model": "stock_price", "params": {"symbol": "AAPL", "start_date": "-7d"}},
    },
    "eia": {
        "label": "US EIA", "desc": "미국 에너지 통계 (원유 재고 · 단기 전망)",
        "key_docs": "https://www.eia.gov/opendata/register.php",
    },
    "kis": {
        "label": "한국투자증권 (KIS)", "desc": "국내주식 실시간 · 1일 랭킹",
        "key_docs": "https://apiportal.koreainvestment.com",
        # 토큰 발급이 분당 1회로 제한돼 검증 호출이 실제 사용을 막을 수 있다 → 검증 생략
    },
    "yahoo": {"label": "Yahoo Finance", "desc": "글로벌 시세 · 재무 (로컬 Fetcher 필요)"},
    "sec": {"label": "SEC EDGAR", "desc": "미국 공시 · 13F · 내부자 거래"},
    "oecd": {"label": "OECD", "desc": "OECD 회원국 거시 지표"},
    "imf": {"label": "IMF", "desc": "IMF 국제 통계"},
    "bls": {"label": "US BLS", "desc": "미국 노동 · 물가 통계"},
    "wsj": {"label": "Wall Street Journal", "desc": "시장 지표"},
    "krx": {"label": "KRX", "desc": "한국거래소 종목 · 시세"},
    "whalewisdom": {"label": "WhaleWisdom", "desc": "기관 13F 보유 현황"},
    "database": {"label": "MarketPulse DB", "desc": "적재된 시세 · 기관 데이터"},
}

_FIELD_LABELS = {"api_key": "API Key", "appkey": "App Key", "appsecret": "App Secret"}


def _spec_for(name: str) -> Optional[Dict[str, Any]]:
    from data_fetcher.providers.declarative.loader import load_specs

    return next((s for s in load_specs() if s.get("name") == name), None)


def provider_info(name: str) -> Dict[str, Any]:
    """표시 정보. 코드 provider는 _INFO, 선언형은 스펙에서."""
    info = dict(_INFO.get(name, {}))
    spec = _spec_for(name) if name not in _INFO else None
    if spec:
        info.setdefault("label", spec.get("label", name))
        info.setdefault("desc", spec.get("description", ""))
        info.setdefault("key_docs", spec.get("key_docs") or spec.get("website"))
        if spec.get("key_test"):
            info["key_test"] = spec["key_test"]
    info.setdefault("label", name.title())
    info.setdefault("desc", "")
    return info


def key_test_for(name: str) -> Optional[Dict[str, Any]]:
    """키 검증 호출 {model, params}. 상대일('-7d', 'today')은 오늘 기준 날짜로 바꿔 돌려준다."""
    test = provider_info(name).get("key_test")
    if not test:
        return None
    from data_fetcher.providers.declarative.loader import resolve_date

    params = {
        k: (resolve_date(v).isoformat() if isinstance(v, str) and (v == "today" or v.startswith("-")) else v)
        for k, v in test.get("params", {}).items()
    }
    return {"model": test["model"], "params": params}


def credential_fields(credentials: List[str]) -> List[Dict[str, str]]:
    return [{"key": c, "label": _FIELD_LABELS.get(c, c.replace("_", " ").title())} for c in credentials]


def provider_catalog() -> List[Dict[str, Any]]:
    """등록된 모든 provider의 카탈로그 (키 필드 · 모델 · 이 provider가 구현하는 개념)."""
    from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry
    from data_fetcher.concepts import CONCEPTS

    concepts_by_provider: Dict[str, List[str]] = {}
    for c in CONCEPTS.values():
        for impl in c.impls:
            ids = concepts_by_provider.setdefault(impl.provider, [])
            if c.id not in ids:
                ids.append(c.id)

    out = []
    for name, prov in sorted(ProviderRegistry.get_all().items()):
        info = provider_info(name)
        out.append({
            "id": name,
            "name": info["label"],
            "description": info["desc"] or prov.description,
            "website": prov.website,
            "key_docs": info.get("key_docs") or prov.website,
            "group": prov.metadata.get("group"),
            "declarative": bool(prov.metadata.get("declarative")),
            "requires_key": prov.requires_credentials(),
            "credentials": credential_fields(prov.credentials),
            "key_testable": bool(info.get("key_test")),
            "models": prov.list_categories(),
            "concepts": concepts_by_provider.get(name, []),
        })
    return out
