"""
Menu API Routes
RESTful endpoints for menu management
"""
import sys
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

try:
    from app.backend.database.db_dependency import get_db
    from app.backend.services.menu_service import MenuService
except ModuleNotFoundError:
    from database.db_dependency import get_db
    from services.menu_service import MenuService

router = APIRouter(prefix="/menu", tags=["menu"])


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


@router.get("/list", response_model=List[Dict[str, Any]])
async def get_menu_list(
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
    try:
        menus = MenuService.get_all_menus(db, pkg_type)
        return [menu.to_dict() for menu in menus]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch menus: {str(e)}")


@router.get("/hierarchy", response_model=List[Dict[str, Any]])
async def get_menu_hierarchy(
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
    try:
        return MenuService.get_menu_hierarchy(db, pkg_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to build menu hierarchy: {str(e)}")


@router.get("/user/{user_type_cd}", response_model=List[Dict[str, Any]])
async def get_menus_by_user_type(
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
    try:
        return MenuService.get_menus_by_user_type(db, user_type_cd, pkg_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch user menus: {str(e)}")


@router.get("/first-page")
async def get_first_page(
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
    try:
        menu = MenuService.get_first_page(db, pkg_type)
        if not menu:
            return {"menu_path": "professional", "menu_name": "Dashboard"}  # Default fallback
        return menu.to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch first page: {str(e)}")


@router.get("/{menu_id}")
async def get_menu_by_id(
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
    try:
        menu = MenuService.get_menu_by_id(db, menu_id)
        if not menu:
            raise HTTPException(status_code=404, detail=f"Menu '{menu_id}' not found")
        return menu.to_dict(include_children=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch menu: {str(e)}")


@router.post("/create")
async def create_menu(
    menu_data: MenuCreate,
    db: Session = Depends(get_db)
):
    """
    Create new menu (admin only)

    Args:
        menu_data: Menu creation data
        db: Database session

    Returns:
        Created menu object
    """
    try:
        # Check if menu already exists
        existing = MenuService.get_menu_by_id(db, menu_data.menu_id)
        if existing:
            raise HTTPException(status_code=400, detail=f"Menu '{menu_data.menu_id}' already exists")

        menu = MenuService.create_menu(db, menu_data.model_dump())
        return {"success": True, "menu": menu.to_dict()}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create menu: {str(e)}")


@router.put("/update/{menu_id}")
async def update_menu(
    menu_id: str,
    menu_data: MenuUpdate,
    db: Session = Depends(get_db)
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
    try:
        # Filter out None values
        update_data = {k: v for k, v in menu_data.model_dump().items() if v is not None}

        menu = MenuService.update_menu(db, menu_id, update_data)
        if not menu:
            raise HTTPException(status_code=404, detail=f"Menu '{menu_id}' not found")

        return {"success": True, "menu": menu.to_dict()}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update menu: {str(e)}")


@router.delete("/delete/{menu_id}")
async def delete_menu(
    menu_id: str,
    db: Session = Depends(get_db)
):
    """
    Delete menu (soft delete - sets use_yn='N')

    Args:
        menu_id: Menu identifier
        db: Database session

    Returns:
        Success status
    """
    try:
        success = MenuService.delete_menu(db, menu_id)
        if not success:
            raise HTTPException(status_code=404, detail=f"Menu '{menu_id}' not found")

        return {"success": True, "message": f"Menu '{menu_id}' deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete menu: {str(e)}")
