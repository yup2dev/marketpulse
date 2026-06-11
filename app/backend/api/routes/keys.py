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
from index_analyzer.models.orm import User

router = APIRouter()


class KeyRequest(BaseModel):
    provider: str
    api_key: Optional[str] = None
    fields: Optional[Dict[str, str]] = None


@router.get("/keys", summary="내 API 키 상태(마스킹) 조회")
async def list_keys(user: User = Depends(get_current_active_user)) -> Dict[str, Any]:
    return {"keys": user_key_service.list_status(str(user.user_id))}


@router.post("/keys", summary="내 API 키 저장(암호화)")
async def set_key(req: KeyRequest, user: User = Depends(get_current_active_user)) -> Dict[str, str]:
    try:
        user_key_service.set_key(
            str(user.user_id), req.provider, api_key=req.api_key, fields=req.fields
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"status": "ok", "provider": req.provider.lower()}


@router.delete("/keys/{provider}", summary="내 API 키 삭제")
async def delete_key(provider: str, user: User = Depends(get_current_active_user)) -> Dict[str, str]:
    if not user_key_service.delete_key(str(user.user_id), provider):
        raise HTTPException(status_code=404, detail=f"no key for '{provider}'")
    return {"status": "deleted", "provider": provider.lower()}
