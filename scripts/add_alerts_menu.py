"""
Add Alerts menu to existing database
"""
import sys
from pathlib import Path
from datetime import datetime

# Add project root to path
project_root = str(Path(__file__).parent.parent)
sys.path.insert(0, project_root)

from index_analyzer.models.database import get_sqlite_db
from index_analyzer.models.menu import MenuManagement


def add_alerts_menu():
    """Add Alerts menu if it doesn't exist"""

    # Get database session
    db_path = Path(__file__).parent.parent / "data" / "marketpulse.db"
    db_instance = get_sqlite_db(str(db_path))
    session = db_instance.get_session()

    try:
        # Check if Alerts menu already exists
        existing = session.query(MenuManagement).filter(
            MenuManagement.menu_id == 'alerts'
        ).first()

        if existing:
            print("Alerts menu already exists.")
            return

        # Add Alerts menu
        alerts_menu = MenuManagement(
            menu_id='alerts',
            pkg_type='MARKETPULSE',
            menu_name='Alerts',
            menu_level=1,
            menu_icon='Bell',
            menu_parent_id=None,
            menu_path='alerts',
            menu_script='AlertsDashboard',
            user_type_cd=None,
            menu_desc='Price alerts and notifications',
            display_seq=6,
            use_yn='Y',
            first_page_yn='N',
            reg_date=datetime.utcnow(),
            upd_date=datetime.utcnow()
        )

        session.add(alerts_menu)
        session.commit()
        print("✓ Alerts menu added successfully!")

    except Exception as e:
        session.rollback()
        print(f"✗ Error adding Alerts menu: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    add_alerts_menu()
