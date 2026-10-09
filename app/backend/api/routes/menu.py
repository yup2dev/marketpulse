"""
Menu API Routes
RESTful endpoints for menu management

응답은 프로젝트 표준인 OBBject(`{results, provider, metadata}`)로 통일한다.
단건도 `results` 배열에 담고, 계층 조회는 루트 노드들을 `results` 에 담는다.
에러 처리는 `route_handler` 가 맡는다 — 핸들러마다 있던 try/except 500 래핑을 걷어냈다.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.backend.api.deps import route_handler
from app.backend.core.db import get_db
from app.backend.core.auth.dependencies import require_admin
from app.backend.services.menu_service import MenuService
from data_fetcher.core import OBBject
from index_analyzer.models.orm import User

router = APIRouter(prefix="/menu", tags=["menu"])

_PROVIDER = "db"


# Request/Response Models
class MenuCreate(BaseModel):
    """Menu creation request model"""
    menu_id: str
    pkg_type: str = 'MARKETPULSE'
    menu_name: str
    menu_level: int
    menu_icon: Optional[str] = None
    menu_parent_id: Optional[str] = None
    menu_path: str
    menu_script: Optional[str] = None
    user_type_cd: Optional[str] = None
    menu_desc: Optional[str] = None
    display_seq: int = 0
    use_yn: str = 'Y'
    first_page_yn: str = 'N'


class MenuUpdate(BaseModel):
    """Menu update request model"""
    menu_name: Optional[str] = None
    menu_icon: Optional[str] = None
    menu_path: Optional[str] = None
    menu_script: Optional[str] = None
    menu_desc: Optional[str] = None
    display_seq: Optional[int] = None
    use_yn: Optional[str] = None
    first_page_yn: Optional[str] = None


@router.get("/list")
@route_handler
def get_menu_list(
    pkg_type: str = Query('MARKETPULSE', description="Package type"),
    db: Session = Depends(get_db)
):
    """
    Get all active menus (flat list)

    Args:
        pkg_type: Package type filter
        db: Database session

    Returns:
        List of menu objects
    """
    menus = MenuService.get_all_menus(db, pkg_type)
    return OBBject(results=[menu.to_dict() for menu in menus], provider=_PROVIDER)


@router.get("/hierarchy")
@route_handler
def get_menu_hierarchy(
    pkg_type: str = Query('MARKETPULSE', description="Package type"),
    db: Session = Depends(get_db)
):
    """
    Get hierarchical menu structure

    Args:
        pkg_type: Package type filter
        db: Database session

    Returns:
        Nested menu structure
    """
    # 트리 구조 — results 에는 루트 노드들이 담기고, 각 노드가 children 을 갖는다.
    return OBBject(results=MenuService.get_menu_hierarchy(db, pkg_type), provider=_PROVIDER)


@router.get("/user/{user_type_cd}")
@route_handler
def get_menus_by_user_type(
    user_type_cd: Optional[str] = None,
    pkg_type: str = Query('MARKETPULSE', description="Package type"),
    db: Session = Depends(get_db)
):
    """
    Get menus filtered by user type

    Args:
        user_type_cd: User type code (None for public)
        pkg_type: Package type filter
        db: Database session

    Returns:
        Filtered menu structure
    """
    return OBBject(results=MenuService.get_menus_by_user_type(db, user_type_cd, pkg_type),
                   provider=_PROVIDER)


@router.get("/first-page")
@route_handler
def get_first_page(
    pkg_type: str = Query('MARKETPULSE', description="Package type"),
    db: Session = Depends(get_db)
):
    """
    Get the default first page menu

    Args:
        pkg_type: Package type filter
        db: Database session

    Returns:
        First page menu object
    """
    menu = MenuService.get_first_page(db, pkg_type)
    if not menu:  # Default fallback
        return OBBject(results=[{"menu_path": "professional", "menu_name": "Dashboard"}],
                       provider=_PROVIDER, metadata={"fallback": True})
    return OBBject(results=[menu.to_dict()], provider=_PROVIDER)


@router.get("/{menu_id}")
@route_handler
def get_menu_by_id(
    menu_id: str,
    db: Session = Depends(get_db)
):
    """
    Get menu by ID

    Args:
        menu_id: Menu identifier
        db: Database session

    Returns:
        Menu object
    """
    menu = MenuService.get_menu_by_id(db, menu_id)
    if not menu:
        raise HTTPException(status_code=404, detail=f"Menu '{menu_id}' not found")
    return OBBject(results=[menu.to_dict(include_children=True)], provider=_PROVIDER)


@router.post("/create")
@route_handler
def create_menu(
    menu_data: MenuCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin)
):
    """
    Create new menu (admin only)

    Args:
        menu_data: Menu creation data
        db: Database session

    Returns:
        Created menu object
    """
    # Check if menu already exists
    existing = MenuService.get_menu_by_id(db, menu_data.menu_id)
    if existing:
        raise HTTPException(status_code=400, detail=f"Menu '{menu_data.menu_id}' already exists")

    menu = MenuService.create_menu(db, menu_data.model_dump())
    return OBBject(results=[menu.to_dict()], provider=_PROVIDER)


@router.put("/update/{menu_id}")
@route_handler
def update_menu(
    menu_id: str,
    menu_data: MenuUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin)
):
    """
    Update existing menu (admin only)

    Args:
        menu_id: Menu identifier
        menu_data: Menu update data
        db: Database session

    Returns:
        Updated menu object
    """
    # Filter out None values
    update_data = {k: v for k, v in menu_data.model_dump().items() if v is not None}

    menu = MenuService.update_menu(db, menu_id, update_data)
    if not menu:
        raise HTTPException(status_code=404, detail=f"Menu '{menu_id}' not found")

    return OBBject(results=[menu.to_dict()], provider=_PROVIDER)


@router.delete("/delete/{menu_id}")
@route_handler
def delete_menu(
    menu_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin)
):
    """
    Delete menu (soft delete - sets use_yn='N')

    Args:
        menu_id: Menu identifier
        db: Database session

    Returns:
        Success status
    """
    success = MenuService.delete_menu(db, menu_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Menu '{menu_id}' not found")

    return OBBject(results=[], provider=_PROVIDER, metadata={"deleted": menu_id})
