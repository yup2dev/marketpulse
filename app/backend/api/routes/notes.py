"""
Notes API Routes
사용자 메모 CRUD 엔드포인트

응답은 프로젝트 표준인 OBBject(`{results, provider, metadata}`)로 통일한다.
단건도 `results` 배열에 담는다 — 프론트가 엔드포인트마다 다른 껍데기를 알 필요가 없다.
"""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from app.backend.api.deps import route_handler
from app.backend.core.db import get_db
from app.backend.core.auth.dependencies import get_current_active_user
from data_fetcher.core import OBBject
from index_analyzer.models.orm import User, UserNote

router = APIRouter(prefix="/notes", tags=["notes"])

_PROVIDER = "db"


class CreateNoteRequest(BaseModel):
    ticker_cd: Optional[str] = None
    title: Optional[str] = None
    content: str = ""
    color: str = "default"


class UpdateNoteRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    color: Optional[str] = None
    pinned: Optional[bool] = None
    ticker_cd: Optional[str] = None


@router.get("")
@route_handler
def get_notes(
    ticker_cd: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    q = db.query(UserNote).filter(UserNote.user_id == current_user.user_id)
    if ticker_cd:
        q = q.filter(UserNote.ticker_cd == ticker_cd.upper())
    notes = q.order_by(UserNote.pinned.desc(), UserNote.updated_at.desc()).all()
    return OBBject(results=[n.to_dict() for n in notes], provider=_PROVIDER)


@router.post("")
@route_handler
def create_note(
    request: CreateNoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    note = UserNote(
        note_id=str(uuid.uuid4()),
        user_id=current_user.user_id,
        ticker_cd=request.ticker_cd.upper() if request.ticker_cd else None,
        title=request.title,
        content=request.content,
        color=request.color,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return OBBject(results=[note.to_dict()], provider=_PROVIDER)


@router.put("/{note_id}")
@route_handler
def update_note(
    note_id: str,
    request: UpdateNoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    note = db.query(UserNote).filter(
        UserNote.note_id == note_id,
        UserNote.user_id == current_user.user_id,
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    if request.title is not None:
        note.title = request.title
    if request.content is not None:
        note.content = request.content
    if request.color is not None:
        note.color = request.color
    if request.pinned is not None:
        note.pinned = request.pinned
    if request.ticker_cd is not None:
        note.ticker_cd = request.ticker_cd.upper() if request.ticker_cd else None

    note.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(note)
    return OBBject(results=[note.to_dict()], provider=_PROVIDER)


@router.delete("/{note_id}")
@route_handler
def delete_note(
    note_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    note = db.query(UserNote).filter(
        UserNote.note_id == note_id,
        UserNote.user_id == current_user.user_id,
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    db.delete(note)
    db.commit()
    return OBBject(results=[], provider=_PROVIDER, metadata={"deleted": note_id})
