"""
Notes API Routes
사용자 메모 CRUD 엔드포인트
"""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from app.backend.database.db_dependency import get_db
from app.backend.auth.dependencies import get_current_active_user
from index_analyzer.models.orm import User, UserNote

router = APIRouter(prefix="/notes", tags=["notes"])


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
async def get_notes(
    ticker_cd: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    q = db.query(UserNote).filter(UserNote.user_id == current_user.user_id)
    if ticker_cd:
        q = q.filter(UserNote.ticker_cd == ticker_cd.upper())
    notes = q.order_by(UserNote.pinned.desc(), UserNote.updated_at.desc()).all()
    return {"success": True, "data": [n.to_dict() for n in notes]}


@router.post("")
async def create_note(
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
    return {"success": True, "data": note.to_dict()}


@router.put("/{note_id}")
async def update_note(
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
    return {"success": True, "data": note.to_dict()}


@router.delete("/{note_id}")
async def delete_note(
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
    return {"success": True, "message": "Note deleted"}
