"""Provider 현황 API — 등록된 fetcher 목록과 API 키 설정 상태."""
import os
from typing import Any, Dict, List

from fastapi import APIRouter

router = APIRouter()

# provider → (display name, required env vars)
_PROVIDER_META: Dict[str, Dict[str, Any]] = {
    "yahoo":        {"name": "Yahoo Finance",   "requires_key": False, "env_vars": []},
    "fred":         {"name": "FRED",            "requires_key": True,  "env_vars": ["FRED_API_KEY"]},
    "fmp":          {"name": "FMP",             "requires_key": True,  "env_vars": ["FMP_API_KEY"]},
    "polygon":      {"name": "Polygon",         "requires_key": True,  "env_vars": ["POLYGON_API_KEY"]},
    "alphavantage": {"name": "Alpha Vantage",   "requires_key": True,  "env_vars": ["ALPHA_VANTAGE_API_KEY"]},
    "whalewisdom":  {"name": "WhaleWisdom",     "requires_key": True,  "env_vars": ["WHALEWISDOM_API_KEY"]},
    "kis":          {"name": "한국투자증권(KIS)", "requires_key": True,  "env_vars": ["KIS_APPKEY", "KIS_APPSECRET"]},
    "sec":          {"name": "SEC EDGAR",       "requires_key": False, "env_vars": []},
    "database":     {"name": "Local Database",  "requires_key": False, "env_vars": []},
    "social":       {"name": "Social Sentiment","requires_key": False, "env_vars": []},
    "bond":         {"name": "Bond Prices",     "requires_key": False, "env_vars": []},
    # OpenBB 이식 provider
    "wsj":          {"name": "Wall Street Journal", "requires_key": False, "env_vars": []},
    "bls":          {"name": "US BLS",          "requires_key": False, "env_vars": ["BLS_API_KEY"]},
    "eia":          {"name": "US EIA",          "requires_key": True,  "env_vars": ["EIA_API_KEY"]},
    "oecd":         {"name": "OECD",            "requires_key": False, "env_vars": []},
    "imf":          {"name": "IMF",             "requires_key": False, "env_vars": []},
}

# provider → MACRO/STOCK 분류. ProviderRegistry.metadata["group"] 가 있으면 그것을 우선한다.
_PROVIDER_GROUP_FALLBACK: Dict[str, str] = {
    "fred": "macro", "bls": "macro", "eia": "macro", "oecd": "macro", "imf": "macro", "bond": "macro",
    "yahoo": "stock", "fmp": "stock", "polygon": "stock", "alphavantage": "stock",
    "tiingo": "stock", "whalewisdom": "stock", "sec": "stock", "wsj": "stock",
    "kis": "stock", "krx": "stock", "nasdaqtrader": "stock", "database": "stock", "db": "stock", "social": "stock",
    "quantitative": "quant", "quantlib": "quant",
}


def _resolve_group(provider_id: str) -> str:
    """provider의 MACRO/STOCK 분류. 등록된 Provider.metadata['group'] 우선, 없으면 fallback."""
    try:
        from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry
        prov = ProviderRegistry.get_all().get(provider_id)
        if prov and prov.metadata.get("group"):
            return prov.metadata["group"]
    except Exception:  # noqa: BLE001
        pass
    return _PROVIDER_GROUP_FALLBACK.get(provider_id, "other")


def _is_key_configured(env_vars: List[str]) -> bool:
    return all(bool(os.getenv(v)) for v in env_vars) if env_vars else True


@router.get("/providers", summary="등록된 provider 목록 및 API 키 설정 현황")
async def list_providers() -> Dict[str, Any]:
    from data_fetcher.utils.registry import FetcherRegistry

    registry_info = FetcherRegistry.get_registry_info()

    # provider별 카테고리 집계
    provider_categories: Dict[str, List[str]] = {}
    for category, cat_info in registry_info["categories"].items():
        for provider in cat_info["providers"]:
            provider_categories.setdefault(provider, []).append(category)

    providers = []
    all_provider_names = set(provider_categories.keys()) | set(_PROVIDER_META.keys())

    for provider_id in sorted(all_provider_names):
        meta = _PROVIDER_META.get(provider_id, {
            "name": provider_id.title(),
            "requires_key": False,
            "env_vars": [],
        })
        env_vars: List[str] = meta["env_vars"]
        configured = _is_key_configured(env_vars)
        categories = sorted(provider_categories.get(provider_id, []))

        providers.append({
            "id": provider_id,
            "name": meta["name"],
            "group": _resolve_group(provider_id),
            "requires_key": meta["requires_key"],
            "configured": configured,
            "categories": categories,
            "category_count": len(categories),
        })

    # MACRO/STOCK 등 group 별로도 묶어서 제공 (프론트 분류 표시용)
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for p in providers:
        grouped.setdefault(p["group"], []).append(p)

    return {
        "total_providers": len(providers),
        "total_categories": registry_info["total_categories"],
        "providers": providers,
        "groups": grouped,
    }


@router.get("/providers/{provider_id}", summary="특정 provider의 카테고리 목록")
async def get_provider(provider_id: str) -> Dict[str, Any]:
    from data_fetcher.utils.registry import FetcherRegistry

    categories = FetcherRegistry.list_providers(provider_id)  # returns [] if not found
    all_categories = FetcherRegistry.list_categories()

    provider_categories = [
        {
            "category": cat,
            "metadata": FetcherRegistry.get_metadata(cat, provider_id),
        }
        for cat in all_categories
        if provider_id in FetcherRegistry.list_providers(cat)
    ]

    meta = _PROVIDER_META.get(provider_id, {
        "name": provider_id.title(),
        "requires_key": False,
        "env_vars": [],
    })
    env_vars: List[str] = meta["env_vars"]

    return {
        "id": provider_id,
        "name": meta["name"],
        "group": _resolve_group(provider_id),
        "requires_key": meta["requires_key"],
        "configured": _is_key_configured(env_vars),
        "categories": provider_categories,
    }
