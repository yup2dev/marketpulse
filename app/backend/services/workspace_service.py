"""
Workspace Service — CRUD for user workspace layouts
"""
import json
import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session

from index_analyzer.models.orm import UserWorkspace


class WorkspaceService:

    @staticmethod
    def get_workspaces(db: Session, user_id: str, screen: str) -> List[UserWorkspace]:
        return (
            db.query(UserWorkspace)
            .filter(UserWorkspace.user_id == user_id, UserWorkspace.screen == screen)
            .order_by(UserWorkspace.is_default.desc(), UserWorkspace.created_at.asc())
            .all()
        )

    @staticmethod
    def get_workspace(db: Session, user_id: str, workspace_id: str) -> Optional[UserWorkspace]:
        return (
            db.query(UserWorkspace)
            .filter(UserWorkspace.id == workspace_id, UserWorkspace.user_id == user_id)
            .first()
        )

    @staticmethod
    def create_workspace(
        db: Session,
        user_id: str,
        screen: str,
        name: str,
        layout: list = None,
        widgets: list = None,
        is_default: bool = False,
    ) -> UserWorkspace:
        ws = UserWorkspace(
            id=f"ws_{uuid.uuid4().hex[:12]}",
            user_id=user_id,
            screen=screen,
            name=name,
            is_default=is_default,
            layout=json.dumps(layout or []),
            widgets=json.dumps(widgets or []),
        )
        if is_default:
            # Clear other defaults for this screen
            db.query(UserWorkspace).filter(
                UserWorkspace.user_id == user_id,
                UserWorkspace.screen == screen,
                UserWorkspace.is_default == True,
            ).update({'is_default': False})
        db.add(ws)
        db.commit()
        db.refresh(ws)
        return ws

    @staticmethod
    def update_workspace(
        db: Session,
        user_id: str,
        workspace_id: str,
        name: Optional[str] = None,
        layout: Optional[list] = None,
        widgets: Optional[list] = None,
    ) -> Optional[UserWorkspace]:
        ws = WorkspaceService.get_workspace(db, user_id, workspace_id)
        if not ws:
            return None
        if name is not None:
            ws.name = name
        if layout is not None:
            ws.layout = json.dumps(layout)
        if widgets is not None:
            ws.widgets = json.dumps(widgets)
        ws.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(ws)
        return ws

    @staticmethod
    def delete_workspace(db: Session, user_id: str, workspace_id: str) -> bool:
        ws = WorkspaceService.get_workspace(db, user_id, workspace_id)
        if not ws:
            return False
        db.delete(ws)
        db.commit()
        return True

    @staticmethod
    def set_default(db: Session, user_id: str, workspace_id: str) -> Optional[UserWorkspace]:
        ws = WorkspaceService.get_workspace(db, user_id, workspace_id)
        if not ws:
            return None
        # Clear other defaults
        db.query(UserWorkspace).filter(
            UserWorkspace.user_id == user_id,
            UserWorkspace.screen == ws.screen,
            UserWorkspace.is_default == True,
        ).update({'is_default': False})
        ws.is_default = True
        db.commit()
        db.refresh(ws)
        return ws
