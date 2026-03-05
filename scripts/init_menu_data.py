"""
Initialize Menu Data
Populates the menu_management table with initial navigation structure
"""
import sys
from pathlib import Path
from datetime import datetime

# Add project root to path
project_root = str(Path(__file__).parent.parent)
sys.path.insert(0, project_root)

from index_analyzer.models.database import get_sqlite_db
from index_analyzer.models.menu import MenuManagement


def init_menu_data():
    """Initialize menu data in database"""

    # Get database session
    db_path = Path(__file__).parent.parent / "data" / "marketpulse.db"
    db_instance = get_sqlite_db(str(db_path))
    session = db_instance.get_session()

    try:
        # Check if menus already exist
        existing_count = session.query(MenuManagement).count()
        if existing_count > 0:
            print(f"Menu data already exists ({existing_count} menus). Skipping initialization.")
            return

        print("Initializing menu data...")

        # Define menu data
        menus = [
            # Top-level menus
            {
                'menu_id': 'dashboard',
                'pkg_type': 'MARKETPULSE',
                'menu_name': 'Dashboard',
                'menu_level': 1,
                'menu_icon': 'Grid3x3',
                'menu_parent_id': None,
                'menu_path': 'professional',
                'menu_script': 'ProfessionalDashboard',
                'user_type_cd': None,
                'menu_desc': 'Dashboard overview with widgets',
                'display_seq': 1,
                'use_yn': 'Y',
                'first_page_yn': 'Y',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'menu_id': 'analysis',
                'pkg_type': 'MARKETPULSE',
                'menu_name': 'Analysis',
                'menu_level': 1,
                'menu_icon': 'LayoutDashboard',
                'menu_parent_id': None,
                'menu_path': 'stock',
                'menu_script': 'ImprovedStockDashboard',
                'user_type_cd': None,
                'menu_desc': 'Stock analysis tools',
                'display_seq': 2,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'menu_id': 'macro',
                'pkg_type': 'MARKETPULSE',
                'menu_name': 'Macro',
                'menu_level': 1,
                'menu_icon': 'Globe',
                'menu_parent_id': None,
                'menu_path': 'macro-analysis',
                'menu_script': 'MacroAnalysis',
                'user_type_cd': None,
                'menu_desc': 'Macroeconomic analysis',
                'display_seq': 3,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'menu_id': 'backtest',
                'pkg_type': 'MARKETPULSE',
                'menu_name': 'Backtest',
                'menu_level': 1,
                'menu_icon': 'BarChart3',
                'menu_parent_id': None,
                'menu_path': 'unified-backtest',
                'menu_script': 'UnifiedBacktest',
                'user_type_cd': None,
                'menu_desc': 'Backtesting strategies',
                'display_seq': 4,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'menu_id': 'portfolio',
                'pkg_type': 'MARKETPULSE',
                'menu_name': 'Portfolio',
                'menu_level': 1,
                'menu_icon': 'Briefcase',
                'menu_parent_id': None,
                'menu_path': 'portfolio-settings',
                'menu_script': 'PortfolioSettings',
                'user_type_cd': None,
                'menu_desc': 'Portfolio management',
                'display_seq': 5,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'menu_id': 'alerts',
                'pkg_type': 'MARKETPULSE',
                'menu_name': 'Alerts',
                'menu_level': 1,
                'menu_icon': 'Bell',
                'menu_parent_id': None,
                'menu_path': 'alerts',
                'menu_script': 'Alerts',
                'user_type_cd': None,
                'menu_desc': 'Price alerts and notifications',
                'display_seq': 6,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'menu_id': 'quant',
                'pkg_type': 'MARKETPULSE',
                'menu_name': 'Quant',
                'menu_level': 1,
                'menu_icon': 'BarChart3',
                'menu_parent_id': None,
                'menu_path': 'quant',
                'menu_script': 'QuantStrategyPage',
                'user_type_cd': None,
                'menu_desc': 'Quant Strategy Builder — single-ticker backtesting',
                'display_seq': 7,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },

            # Analysis sub-menus
            {
                'menu_id': 'analysis-overview',
                'pkg_type': 'MARKETPULSE',
                'menu_name': 'Overview',
                'menu_level': 2,
                'menu_icon': None,
                'menu_parent_id': 'analysis',
                'menu_path': 'stock?tab=overview',
                'menu_script': None,
                'user_type_cd': None,
                'menu_desc': 'Stock overview and ticker information',
                'display_seq': 1,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'menu_id': 'analysis-financials',
                'pkg_type': 'MARKETPULSE',
                'menu_name': 'Financials',
                'menu_level': 2,
                'menu_icon': None,
                'menu_parent_id': 'analysis',
                'menu_path': 'stock?tab=financials',
                'menu_script': None,
                'user_type_cd': None,
                'menu_desc': 'Financial statements and metrics',
                'display_seq': 2,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'menu_id': 'analysis-institutional',
                'pkg_type': 'MARKETPULSE',
                'menu_name': 'Institutional Holdings',
                'menu_level': 2,
                'menu_icon': None,
                'menu_parent_id': 'analysis',
                'menu_path': 'stock?tab=institutional-holdings',
                'menu_script': None,
                'user_type_cd': None,
                'menu_desc': 'Institutional ownership data',
                'display_seq': 3,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },

            # Macro sub-menus
            {
                'menu_id': 'macro-overview',
                'pkg_type': 'MARKETPULSE',
                'menu_name': 'Overview',
                'menu_level': 2,
                'menu_icon': None,
                'menu_parent_id': 'macro',
                'menu_path': 'macro-analysis?tab=overview',
                'menu_script': None,
                'user_type_cd': None,
                'menu_desc': 'Macroeconomic overview',
                'display_seq': 1,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'menu_id': 'macro-regime',
                'pkg_type': 'MARKETPULSE',
                'menu_name': 'Economic Regime',
                'menu_level': 2,
                'menu_icon': None,
                'menu_parent_id': 'macro',
                'menu_path': 'macro-analysis?tab=regime',
                'menu_script': None,
                'user_type_cd': None,
                'menu_desc': 'Economic regime analysis',
                'display_seq': 2,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'menu_id': 'macro-fed',
                'pkg_type': 'MARKETPULSE',
                'menu_name': 'Fed Policy',
                'menu_level': 2,
                'menu_icon': None,
                'menu_parent_id': 'macro',
                'menu_path': 'macro-analysis?tab=fed-policy',
                'menu_script': None,
                'user_type_cd': None,
                'menu_desc': 'Federal Reserve policy tracking',
                'display_seq': 3,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'menu_id': 'macro-yield',
                'pkg_type': 'MARKETPULSE',
                'menu_name': 'Yield Curve',
                'menu_level': 2,
                'menu_icon': None,
                'menu_parent_id': 'macro',
                'menu_path': 'macro-analysis?tab=yield-curve',
                'menu_script': None,
                'user_type_cd': None,
                'menu_desc': 'Treasury yield curve analysis',
                'display_seq': 4,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'menu_id': 'macro-inflation',
                'pkg_type': 'MARKETPULSE',
                'menu_name': 'Inflation',
                'menu_level': 2,
                'menu_icon': None,
                'menu_parent_id': 'macro',
                'menu_path': 'macro-analysis?tab=inflation',
                'menu_script': None,
                'user_type_cd': None,
                'menu_desc': 'Inflation analysis and decomposition',
                'display_seq': 5,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'menu_id': 'macro-labor',
                'pkg_type': 'MARKETPULSE',
                'menu_name': 'Labor Market',
                'menu_level': 2,
                'menu_icon': None,
                'menu_parent_id': 'macro',
                'menu_path': 'macro-analysis?tab=labor',
                'menu_script': None,
                'user_type_cd': None,
                'menu_desc': 'Labor market indicators',
                'display_seq': 6,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'menu_id': 'macro-financial',
                'pkg_type': 'MARKETPULSE',
                'menu_name': 'Financial Conditions',
                'menu_level': 2,
                'menu_icon': None,
                'menu_parent_id': 'macro',
                'menu_path': 'macro-analysis?tab=financial-conditions',
                'menu_script': None,
                'user_type_cd': None,
                'menu_desc': 'Financial conditions index',
                'display_seq': 7,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'menu_id': 'macro-sentiment',
                'pkg_type': 'MARKETPULSE',
                'menu_name': 'Market Sentiment',
                'menu_level': 2,
                'menu_icon': None,
                'menu_parent_id': 'macro',
                'menu_path': 'macro-analysis?tab=sentiment',
                'menu_script': None,
                'user_type_cd': None,
                'menu_desc': 'Market sentiment composite',
                'display_seq': 8,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'menu_id': 'macro-commodities',
                'pkg_type': 'MARKETPULSE',
                'menu_name': 'Commodities',
                'menu_level': 2,
                'menu_icon': None,
                'menu_parent_id': 'macro',
                'menu_path': 'macro-analysis?tab=commodities',
                'menu_script': None,
                'user_type_cd': None,
                'menu_desc': 'Commodity prices and ratios',
                'display_seq': 9,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'menu_id': 'macro-banking',
                'pkg_type': 'MARKETPULSE',
                'menu_name': 'Banking & Credit',
                'menu_level': 2,
                'menu_icon': None,
                'menu_parent_id': 'macro',
                'menu_path': 'macro-analysis?tab=banking',
                'menu_script': None,
                'user_type_cd': None,
                'menu_desc': 'Banking sector and credit metrics',
                'display_seq': 10,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'menu_id': 'macro-money',
                'pkg_type': 'MARKETPULSE',
                'menu_name': 'Money Supply',
                'menu_level': 2,
                'menu_icon': None,
                'menu_parent_id': 'macro',
                'menu_path': 'macro-analysis?tab=money',
                'menu_script': None,
                'user_type_cd': None,
                'menu_desc': 'M1, M2 money supply',
                'display_seq': 11,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'menu_id': 'macro-rates',
                'pkg_type': 'MARKETPULSE',
                'menu_name': 'Interest Rates',
                'menu_level': 2,
                'menu_icon': None,
                'menu_parent_id': 'macro',
                'menu_path': 'macro-analysis?tab=rates',
                'menu_script': None,
                'user_type_cd': None,
                'menu_desc': 'Treasury rates and spreads',
                'display_seq': 12,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'menu_id': 'macro-trade',
                'pkg_type': 'MARKETPULSE',
                'menu_name': 'Trade & Forex',
                'menu_level': 2,
                'menu_icon': None,
                'menu_parent_id': 'macro',
                'menu_path': 'macro-analysis?tab=trade',
                'menu_script': None,
                'user_type_cd': None,
                'menu_desc': 'Trade balance and forex rates',
                'display_seq': 13,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'menu_id': 'macro-realestate',
                'pkg_type': 'MARKETPULSE',
                'menu_name': 'Real Estate',
                'menu_level': 2,
                'menu_icon': None,
                'menu_parent_id': 'macro',
                'menu_path': 'macro-analysis?tab=realestate',
                'menu_script': None,
                'user_type_cd': None,
                'menu_desc': 'Real estate and housing market',
                'display_seq': 14,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
        ]

        # Insert menus
        for menu_data in menus:
            menu = MenuManagement(**menu_data)
            session.add(menu)

        session.commit()
        print(f"✓ Successfully initialized {len(menus)} menu items")

    except Exception as e:
        session.rollback()
        print(f"✗ Error initializing menu data: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    init_menu_data()
