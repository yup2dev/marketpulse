"""
Menu Service
Business logic for menu management
"""
import sys
from pathlib import Path
from typing import List, Optional, Dict

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from sqlalchemy.orm import Session
from sqlalchemy import and_
from index_analyzer.models.menu import MenuManagement


class MenuService:
    """Service for menu management operations"""

    @staticmethod
    def get_all_menus(db: Session, pkg_type: str = 'MARKETPULSE') -> List[MenuManagement]:
        """
        Get all active menus for a package

        Args:
            db: Database session
            pkg_type: Package type filter

        Returns:
            List of menu objects
        """
        return db.query(MenuManagement).filter(
            and_(
                MenuManagement.pkg_type == pkg_type,
                MenuManagement.use_yn == 'Y'
            )
        ).order_by(
            MenuManagement.menu_level,
            MenuManagement.display_seq
        ).all()

    @staticmethod
    def get_menu_hierarchy(db: Session, pkg_type: str = 'MARKETPULSE') -> List[Dict]:
        """
        Get hierarchical menu structure

        Args:
            db: Database session
            pkg_type: Package type filter

        Returns:
            List of top-level menus with nested children
        """
        menus = MenuService.get_all_menus(db, pkg_type)
        return MenuManagement.build_hierarchy(menus)

    @staticmethod
    def get_menus_by_user_type(
        db: Session,
        user_type_cd: Optional[str] = None,
        pkg_type: str = 'MARKETPULSE'
    ) -> List[Dict]:
        """
        Get menus filtered by user type

        Args:
            db: Database session
            user_type_cd: User type code (None for public menus)
            pkg_type: Package type filter

        Returns:
            List of menus accessible to the user type
        """
        query = db.query(MenuManagement).filter(
            and_(
                MenuManagement.pkg_type == pkg_type,
                MenuManagement.use_yn == 'Y'
            )
        )

        # Filter by user type if specified
        if user_type_cd:
            query = query.filter(
                (MenuManagement.user_type_cd == user_type_cd) |
                (MenuManagement.user_type_cd.is_(None))
            )
        else:
            query = query.filter(MenuManagement.user_type_cd.is_(None))

        menus = query.order_by(
            MenuManagement.menu_level,
            MenuManagement.display_seq
        ).all()

        return MenuManagement.build_hierarchy(menus)

    @staticmethod
    def get_menu_by_id(db: Session, menu_id: str) -> Optional[MenuManagement]:
        """
        Get menu by ID

        Args:
            db: Database session
            menu_id: Menu identifier

        Returns:
            Menu object or None
        """
        return db.query(MenuManagement).filter(
            MenuManagement.menu_id == menu_id
        ).first()

    @staticmethod
    def create_menu(db: Session, menu_data: Dict) -> MenuManagement:
        """
        Create new menu

        Args:
            db: Database session
            menu_data: Menu data dictionary

        Returns:
            Created menu object
        """
        menu = MenuManagement(**menu_data)
        db.add(menu)
        db.commit()
        db.refresh(menu)
        return menu

    @staticmethod
    def update_menu(db: Session, menu_id: str, menu_data: Dict) -> Optional[MenuManagement]:
        """
        Update existing menu

        Args:
            db: Database session
            menu_id: Menu identifier
            menu_data: Updated menu data

        Returns:
            Updated menu object or None if not found
        """
        menu = MenuService.get_menu_by_id(db, menu_id)
        if not menu:
            return None

        for key, value in menu_data.items():
            if hasattr(menu, key):
                setattr(menu, key, value)

        db.commit()
        db.refresh(menu)
        return menu

    @staticmethod
    def delete_menu(db: Session, menu_id: str) -> bool:
        """
        Soft delete menu (set use_yn = 'N')

        Args:
            db: Database session
            menu_id: Menu identifier

        Returns:
            True if deleted, False if not found
        """
        menu = MenuService.get_menu_by_id(db, menu_id)
        if not menu:
            return False

        menu.use_yn = 'N'
        db.commit()
        return True

    @staticmethod
    def get_first_page(db: Session, pkg_type: str = 'MARKETPULSE') -> Optional[MenuManagement]:
        """
        Get the default first page menu

        Args:
            db: Database session
            pkg_type: Package type filter

        Returns:
            First page menu or None
        """
        return db.query(MenuManagement).filter(
            and_(
                MenuManagement.pkg_type == pkg_type,
                MenuManagement.first_page_yn == 'Y',
                MenuManagement.use_yn == 'Y'
            )
        ).first()
