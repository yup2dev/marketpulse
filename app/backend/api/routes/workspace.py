"""
Workspace API Routes
GET    /api/workspace?screen=dashboard
POST   /api/workspace
PUT    /api/workspace/{id}
DELETE /api/workspace/{id}
POST   /api/workspace/{id}/default
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from app.backend.database.db_dependency import get_db
from app.backend.auth.dependencies import get_current_user
from app.backend.services.workspace_service import WorkspaceService
from index_analyzer.models.orm import UserWorkspace, User

router = APIRouter(prefix="/workspace", tags=["workspace"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class WorkspaceCreate(BaseModel):
    screen: str
    name: str
    layout: Optional[List] = []
    widgets: Optional[List] = []
    is_default: bool = False


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    layout: Optional[List] = None
    widgets: Optional[List] = None


class WorkspaceOut(BaseModel):
    id: str
    user_id: str
    screen: str
    name: str
    is_default: bool
    layout: List
    widgets: List
    created_at: Optional[str]
    updated_at: Optional[str]

    class Config:
        from_attributes = True


# ── Helpers ───────────────────────────────────────────────────────────────────

def _to_out(ws: UserWorkspace) -> dict:
    return ws.to_dict()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("")
def list_workspaces(
    screen: str = Query(..., description="Screen name, e.g. 'dashboard'"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspaces = WorkspaceService.get_workspaces(db, current_user.user_id, screen)
    return [_to_out(ws) for ws in workspaces]


@router.post("", status_code=201)
def create_workspace(
    body: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws = WorkspaceService.create_workspace(
        db=db,
        user_id=current_user.user_id,
        screen=body.screen,
        name=body.name,
        layout=body.layout,
        widgets=body.widgets,
        is_default=body.is_default,
    )
    return _to_out(ws)


@router.put("/{workspace_id}")
def update_workspace(
    workspace_id: str,
    body: WorkspaceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws = WorkspaceService.update_workspace(
        db=db,
        user_id=current_user.user_id,
        workspace_id=workspace_id,
        name=body.name,
        layout=body.layout,
        widgets=body.widgets,
    )
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return _to_out(ws)


@router.delete("/{workspace_id}", status_code=204)
def delete_workspace(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ok = WorkspaceService.delete_workspace(db, current_user.user_id, workspace_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Workspace not found")


@router.post("/{workspace_id}/default")
def set_default_workspace(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws = WorkspaceService.set_default(db, current_user.user_id, workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return _to_out(ws)
