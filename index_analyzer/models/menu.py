"""
Menu Management Model
Database-driven menu system for dynamic navigation
"""
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from index_analyzer.models.orm import Base


class MenuManagement(Base):
    """
    Menu Management Table
    Stores hierarchical menu structure for application navigation
    """
    __tablename__ = 'menu_management'

    # Primary Key
    menu_id = Column(String(50), primary_key=True)

    # Basic Info
    pkg_type = Column(String(50), nullable=False, index=True)  # Package type (e.g., 'MARKETPULSE')
    menu_name = Column(String(100), nullable=False)  # Display name
    menu_level = Column(Integer, nullable=False, index=True)  # 1=top level, 2=sub-menu, etc.
    menu_icon = Column(String(50))  # Icon identifier (e.g., 'Grid3x3', 'LayoutDashboard')

    # Hierarchy
    menu_parent_id = Column(String(50), ForeignKey('menu_management.menu_id'), index=True)  # Parent menu reference

    # Navigation
    menu_path = Column(String(200), nullable=False)  # Route/path (e.g., 'stock', 'stock?tab=financials')
    menu_script = Column(String(200))  # Component path or script reference

    # Access Control
    user_type_cd = Column(String(50))  # User type code for permissions

    # Additional Info
    menu_desc = Column(Text)  # Description
    display_seq = Column(Integer, nullable=False, default=0, index=True)  # Display order
    use_yn = Column(String(1), nullable=False, default='Y', index=True)  # Active flag (Y/N)
    first_page_yn = Column(String(1), nullable=False, default='N')  # Default/landing page flag

    # Timestamps
    reg_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    upd_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    children = relationship(
        "MenuManagement",
        backref="parent",
        remote_side=[menu_id],
        order_by="MenuManagement.display_seq"
    )

    __table_args__ = (
        Index('idx_menu_pkg_level', 'pkg_type', 'menu_level'),
        Index('idx_menu_parent_seq', 'menu_parent_id', 'display_seq'),
        Index('idx_menu_use_yn', 'use_yn'),
    )

    def to_dict(self, include_children=False):
        """
        Convert menu to dictionary

        Args:
            include_children: Include child menus in response

        Returns:
            dict: Menu data
        """
        data = {
            'menu_id': self.menu_id,
            'pkg_type': self.pkg_type,
            'menu_name': self.menu_name,
            'menu_level': self.menu_level,
            'menu_icon': self.menu_icon,
            'menu_parent_id': self.menu_parent_id,
            'menu_path': self.menu_path,
            'menu_script': self.menu_script,
            'user_type_cd': self.user_type_cd,
            'menu_desc': self.menu_desc,
            'display_seq': self.display_seq,
            'use_yn': self.use_yn,
            'first_page_yn': self.first_page_yn,
            'reg_date': self.reg_date.isoformat() if self.reg_date else None,
            'upd_date': self.upd_date.isoformat() if self.upd_date else None
        }

        if include_children and self.children:
            data['children'] = [child.to_dict(include_children=True) for child in self.children]

        return data

    def get_children(self):
        """
        Get direct child menus

        Returns:
            list: Child menu objects
        """
        return sorted(self.children, key=lambda x: x.display_seq)

    @staticmethod
    def build_hierarchy(menus):
        """
        Build hierarchical menu structure from flat list

        Args:
            menus: List of MenuManagement objects

        Returns:
            list: Top-level menus with nested children
        """
        # Create lookup dictionary
        menu_dict = {menu.menu_id: menu for menu in menus}

        # Find top-level menus
        top_level = []
        for menu in menus:
            if menu.menu_parent_id is None or menu.menu_parent_id not in menu_dict:
                top_level.append(menu)

        # Sort by display sequence
        top_level.sort(key=lambda x: x.display_seq)

        return [menu.to_dict(include_children=True) for menu in top_level]

    def __repr__(self):
        return f"<MenuManagement(menu_id='{self.menu_id}', name='{self.menu_name}', level={self.menu_level})>"
