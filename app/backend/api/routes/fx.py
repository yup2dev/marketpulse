"""환율 API — 일일 배치로 적재된 mbs_in_fx_stbd 기반 (요청 시 외부 호출 없음)."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.backend.core.db import get_db
from app.backend.services.fx_service import FXRateNotFound, get_rate
from data_fetcher.core import OBBject

router = APIRouter(prefix="/fx", tags=["fx"])


@router.get("/rate")
def get_fx_rate(
    base: str = Query("USD", min_length=3, max_length=3),
    quote: str = Query("KRW", min_length=3, max_length=3),
    on: Optional[date] = Query(None, description="이 날짜 이전 가장 최근 영업일 환율 (기본: 최신)"),
    db: Session = Depends(get_db),
) -> OBBject:
    try:
        fx = get_rate(db, base, quote, on)
    except FXRateNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return OBBject(results=[fx.as_dict()], provider="db")
