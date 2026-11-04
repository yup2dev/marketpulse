"""Provider 현황 API — 등록된 provider 카탈로그와 '내 키' 설정 상태.

표시 정보·키 필드·모델·구현 개념은 data_fetcher.provider_catalog 가 단일 소스다.
configured 는 운영자 env 가 아니라 **요청 사용자**가 키를 등록했는지(또는 무키 provider)다 —
BYOK 라서 사용자마다 쓸 수 있는 provider가 다르고, 위젯의 기본 provider 선택도 이 값을 본다.
"""
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException

from app.backend.core.auth.dependencies import get_current_active_user
from app.backend.services import user_key_service
from marketpulse_common.models.orm import User

router = APIRouter()

# provider → MACRO/STOCK 분류. Provider.metadata["group"] 이 있으면 그것을 우선한다.
_PROVIDER_GROUP_FALLBACK: Dict[str, str] = {
    "fred": "macro", "bls": "macro", "eia": "macro", "oecd": "macro", "imf": "macro", "bond": "macro",
    "yahoo": "stock", "fmp": "stock", "polygon": "stock", "alphavantage": "stock",
    "tiingo": "stock", "whalewisdom": "stock", "sec": "stock", "wsj": "stock",
    "kis": "stock", "krx": "stock", "nasdaqtrader": "stock", "database": "stock", "db": "stock", "social": "stock",
    "quantitative": "quant", "quantlib": "quant",
}


def _user_catalog(user_id: str) -> List[Dict[str, Any]]:
    from data_fetcher.provider_catalog import provider_catalog

    registered = {k["provider"] for k in user_key_service.list_status(user_id) if k.get("configured")}
    out = []
    for p in provider_catalog():
        p = dict(p)
        p["group"] = p.get("group") or _PROVIDER_GROUP_FALLBACK.get(p["id"], "other")
        p["configured"] = (not p["requires_key"]) or p["id"] in registered
        # 하위 호환: 위젯 provider 셀렉터는 categories(=model 키)로 지원 여부를 판단한다
        p["categories"] = p["models"]
        p["category_count"] = len(p["models"])
        out.append(p)
    return out


@router.get("/providers", summary="provider 카탈로그 + 내 키 설정 현황")
async def list_providers(user: User = Depends(get_current_active_user)) -> Dict[str, Any]:
    providers = _user_catalog(str(user.user_id))
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for p in providers:
        grouped.setdefault(p["group"], []).append(p)
    return {
        "total_providers": len(providers),
        "total_categories": len({m for p in providers for m in p["models"]}),
        "providers": providers,
        "groups": grouped,
    }


@router.get("/providers/{provider_id}", summary="특정 provider 카탈로그")
async def get_provider(provider_id: str, user: User = Depends(get_current_active_user)) -> Dict[str, Any]:
    from data_fetcher.utils.registry import FetcherRegistry

    match = next((p for p in _user_catalog(str(user.user_id)) if p["id"] == provider_id), None)
    if match is None:
        raise HTTPException(status_code=404, detail=f"Provider '{provider_id}' not found")
    match["categories"] = [
        {"category": m, "metadata": FetcherRegistry.get_metadata(m, provider_id)} for m in match["models"]
    ]
    return match
