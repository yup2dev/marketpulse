"""데이터 개념 API — provider 무관 지표를 '내 키' 기준으로 provider를 골라 조회한다.

    GET /api/concepts                       개념 목록 (국가 · 구현 provider · 내 사용 가능 여부)
    GET /api/concepts/{concept}?country=KOR&period=5y[&provider=oecd]

provider 를 지정하지 않으면 그 국가를 지원하는 구현 중 사용 가능한(키 보유 또는 무키) 첫 구현을
쓴다. 전부 키가 없으면 첫 구현으로 호출해 424(missing_key) 를 돌려 '키 등록' 안내가 뜨게 한다.
정의는 data_fetcher.concepts.CONCEPTS.
"""
from datetime import date
from typing import Any, Callable, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.backend.api.deps import route_handler
from app.backend.core.auth.dependencies import get_current_active_user
from app.backend.services import user_key_service
from data_fetcher.core.obbject import OBBject
from marketpulse_common.models.orm import User

router = APIRouter()


def _availability(user_id: str) -> Callable[[str], bool]:
    """provider → 이 사용자가 쓸 수 있는가 (무키 provider이거나 키 등록)."""
    from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry

    registered = {k["provider"] for k in user_key_service.list_status(user_id) if k.get("configured")}
    providers = ProviderRegistry.get_all()

    def is_available(name: str) -> bool:
        prov = providers.get(name)
        return prov is not None and (not prov.requires_credentials() or name in registered)

    return is_available


@router.get("/concepts", summary="데이터 개념 목록 + 내 사용 가능 provider")
async def list_concepts(user: User = Depends(get_current_active_user)) -> OBBject:
    from data_fetcher.concepts import concept_catalog

    is_available = _availability(str(user.user_id))
    rows = []
    for c in concept_catalog():
        rows.append({**c, "available_providers": [p for p in c["providers"] if is_available(p)]})
    return OBBject(results=rows, provider="concepts")


@router.get("/concepts/{concept_id}/countries", summary="개념이 지원하는 국가 (위젯 국가 셀렉터)")
async def concept_countries(concept_id: str, user: User = Depends(get_current_active_user)) -> OBBject:
    from data_fetcher.concepts import COUNTRY_LABELS, CONCEPTS

    concept = CONCEPTS.get(concept_id)
    if concept is None:
        raise HTTPException(status_code=404, detail=f"알 수 없는 지표 개념: '{concept_id}'")
    is_available = _availability(str(user.user_id))
    rows = [
        {
            "code": c,
            "label": COUNTRY_LABELS.get(c, c),
            "available": any(is_available(i.provider) for i in concept.impls_for(c)),
        }
        for c in concept.countries()
    ]
    return OBBject(results=rows, provider="concepts")


@router.get("/concepts/{concept_id}", summary="데이터 개념 시계열 (provider 자동 선택)")
@route_handler
async def get_concept(
    concept_id: str,
    country: str = "USA",
    period: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    provider: Optional[str] = None,
    user: User = Depends(get_current_active_user),
) -> OBBject:
    from data_fetcher.concepts import ConceptError, fetch_concept

    if period and not start_date:
        from data_fetcher.utils.helpers import parse_period_to_dates

        s, e = parse_period_to_dates(period)
        start_date = date.fromisoformat(str(s)[:10])
        end_date = end_date or date.fromisoformat(str(e)[:10])
    try:
        res: Dict[str, Any] = await fetch_concept(
            concept_id, country, start_date=start_date, end_date=end_date,
            provider=provider or None, is_available=_availability(str(user.user_id)),
        )
    except ConceptError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    # 최신이 위 — /api/data 게이트웨이와 같은 정렬(위젯 표·차트가 같은 규칙을 기대)
    rows = list(reversed(res.pop("rows")))
    return OBBject(results=rows, provider=res["provider"], metadata=res)
