"""사용자 API 키 관리 — 백엔드 DB에 암호화 저장(웹에서 관리).

key-only provider(FRED/FMP/Polygon/AlphaVantage/KIS)는 서버에서 이 키로 호출한다.
키는 사용자별로 DB에 Fernet 암호화되어 저장되며, 원문은 절대 응답하지 않는다(마스킹).

Yahoo/WhaleWisdom 같은 로컬 실행 provider는 키가 필요 없고 사용자 PC Fetcher에서
실행되므로 이 화면의 대상이 아니다.
"""
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.backend.core.auth.dependencies import get_current_active_user
from app.backend.services import user_key_service
from app.backend.models.orm import User

router = APIRouter()


class KeyRequest(BaseModel):
    provider: str
    api_key: Optional[str] = None
    fields: Optional[Dict[str, str]] = None


@router.get("/keys", summary="내 API 키 상태(마스킹) 조회")
def list_keys(user: User = Depends(get_current_active_user)) -> Dict[str, Any]:
    return {"keys": user_key_service.list_status(str(user.user_id))}


@router.post("/keys", summary="내 API 키 저장(암호화)")
def set_key(req: KeyRequest, user: User = Depends(get_current_active_user)) -> Dict[str, str]:
    try:
        user_key_service.set_key(
            str(user.user_id), req.provider, api_key=req.api_key, fields=req.fields
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"status": "ok", "provider": req.provider.lower()}


class KeyTestRequest(BaseModel):
    api_key: Optional[str] = None
    fields: Optional[Dict[str, str]] = None


@router.post("/keys/{provider}/test", summary="API 키 동작 확인 (저장 전 값 또는 저장된 키)")
async def test_key(
    provider: str,
    req: Optional[KeyTestRequest] = None,
    user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """provider 카탈로그의 key_test(가장 싼 호출)를 이 키로 실제 실행한다. 캐시는 쓰지 않는다.

    키를 넘기지 않으면 저장된 키로 검증한다. 결과는 HTTP 200 + {ok, message} —
    키가 틀린 것은 요청 오류가 아니라 검증 결과이므로.
    """
    from data_fetcher.provider_catalog import key_test_for
    from data_fetcher.query_executor import QueryExecutor

    provider = provider.lower()
    test = key_test_for(provider)
    if test is None:
        return {"ok": None, "provider": provider, "message": "이 provider는 키 검증을 지원하지 않습니다"}

    if req and req.fields:
        creds = {k: v.strip() for k, v in req.fields.items() if v and v.strip()}
    elif req and req.api_key and req.api_key.strip():
        creds = {"api_key": req.api_key.strip()}
    else:
        creds = user_key_service.get_credentials(str(user.user_id), provider)
    if not creds:
        return {"ok": False, "provider": provider, "message": "등록된 키가 없습니다"}

    try:
        await QueryExecutor.fetch(provider, test["model"], test["params"], credentials=creds, ttl=0)
    except Exception as exc:  # noqa: BLE001 — 어떤 실패든 '키로 호출 불가'로 보고
        cause = exc.__cause__ or exc
        return {"ok": False, "provider": provider, "message": str(cause)[:300] or type(cause).__name__}
    return {"ok": True, "provider": provider, "message": "키가 정상 동작합니다"}


@router.delete("/keys/{provider}", summary="내 API 키 삭제")
def delete_key(provider: str, user: User = Depends(get_current_active_user)) -> Dict[str, str]:
    if not user_key_service.delete_key(str(user.user_id), provider):
        raise HTTPException(status_code=404, detail=f"no key for '{provider}'")
    return {"status": "deleted", "provider": provider.lower()}
