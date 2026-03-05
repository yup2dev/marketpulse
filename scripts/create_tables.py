"""
데이터베이스 테이블 생성 스크립트
"""
import sys
from pathlib import Path
from datetime import datetime

# Add project root to path
project_root = str(Path(__file__).parent)
sys.path.insert(0, project_root)

from index_analyzer.models.database import Base, default_db
from index_analyzer.models.menu import MenuManagement

def create_all_tables():
    """
    모든 테이블 생성
    """
    print("Creating database tables...")
    print(f"Database path: {default_db.engine.url}")

    try:
        # 테이블 생성
        Base.metadata.create_all(bind=default_db.engine)
        print("\n[OK] All tables created successfully!")

        # 생성된 테이블 목록 출력
        print("\nCreated tables:")
        for table in Base.metadata.sorted_tables:
            print(f"  - {table.name}")

    except Exception as e:
        print(f"\n[ERROR] Error creating tables: {e}")
        raise


def init_menu_data():
    """
    메뉴 테이블 데이터 초기화
    """
    print("\n" + "="*60)
    print("Initializing menu data...")
    print("="*60)

    session = default_db.get_session()

    try:
        # 기존 메뉴 데이터 확인
        existing_count = session.query(MenuManagement).count()
        if existing_count > 0:
            print(f"[WARNING] Menu data already exists ({existing_count} menus)")
            response = input("Do you want to delete and recreate all menus? (yes/no): ").strip().lower()
            if response == 'yes':
                print("Deleting existing menu data...")
                session.query(MenuManagement).delete()
                session.commit()
                print("[OK] Existing menu data deleted")
            else:
                print("[SKIP] Skipping menu initialization")
                return

        # 메뉴 데이터 정의
        menus = [
            # ========================================
            # Top-level menus (MENU_LEVEL = 1)
            # ========================================
            {
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'dashboard',
                'menu_name': 'Dashboard',
                'menu_level': 1,
                'menu_icon': 'Grid3x3',
                'menu_parent_id': None,
                'menu_path': 'professional',
                'menu_script': 'ProfessionalDashboard',
                'user_type_cd': None,
                'menu_desc': 'Dashboard overview with customizable widgets',
                'display_seq': 1,
                'use_yn': 'Y',
                'first_page_yn': 'Y',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'analysis',
                'menu_name': 'Analysis',
                'menu_level': 1,
                'menu_icon': 'LayoutDashboard',
                'menu_parent_id': None,
                'menu_path': 'stock',
                'menu_script': 'ImprovedStockDashboard',
                'user_type_cd': None,
                'menu_desc': 'Stock analysis and fundamental data',
                'display_seq': 2,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'macro',
                'menu_name': 'Macro',
                'menu_level': 1,
                'menu_icon': 'Globe',
                'menu_parent_id': None,
                'menu_path': 'macro-analysis',
                'menu_script': 'MacroAnalysis',
                'user_type_cd': None,
                'menu_desc': 'Macroeconomic indicators and analysis',
                'display_seq': 3,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'backtest',
                'menu_name': 'Backtest',
                'menu_level': 1,
                'menu_icon': 'BarChart3',
                'menu_parent_id': None,
                'menu_path': 'unified-backtest',
                'menu_script': 'UnifiedBacktest',
                'user_type_cd': None,
                'menu_desc': 'Strategy backtesting and performance analysis',
                'display_seq': 4,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'portfolio',
                'menu_name': 'Portfolio',
                'menu_level': 1,
                'menu_icon': 'Briefcase',
                'menu_parent_id': None,
                'menu_path': 'portfolio-settings',
                'menu_script': 'PortfolioSettings',
                'user_type_cd': None,
                'menu_desc': 'Portfolio management and tracking',
                'display_seq': 5,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'alerts',
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

            # ========================================
            # Analysis sub-menus (MENU_LEVEL = 2)
            # ========================================
            {
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'analysis-overview',
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
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'analysis-financials',
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
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'analysis-institutional',
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
            {
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'analysis-comparison',
                'menu_name': 'Comparison Analysis',
                'menu_level': 2,
                'menu_icon': None,
                'menu_parent_id': 'analysis',
                'menu_path': 'stock?tab=comparison-analysis',
                'menu_script': None,
                'user_type_cd': None,
                'menu_desc': 'Compare multiple stocks',
                'display_seq': 4,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'analysis-ownership',
                'menu_name': 'Ownership',
                'menu_level': 2,
                'menu_icon': None,
                'menu_parent_id': 'analysis',
                'menu_path': 'stock?tab=ownership',
                'menu_script': None,
                'user_type_cd': None,
                'menu_desc': 'Ownership structure',
                'display_seq': 5,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'analysis-calendar',
                'menu_name': 'Company Calendar',
                'menu_level': 2,
                'menu_icon': None,
                'menu_parent_id': 'analysis',
                'menu_path': 'stock?tab=company-calendar',
                'menu_script': None,
                'user_type_cd': None,
                'menu_desc': 'Earnings and events calendar',
                'display_seq': 6,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },
            {
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'analysis-estimates',
                'menu_name': 'Estimates',
                'menu_level': 2,
                'menu_icon': None,
                'menu_parent_id': 'analysis',
                'menu_path': 'stock?tab=estimates',
                'menu_script': None,
                'user_type_cd': None,
                'menu_desc': 'Analyst estimates and consensus',
                'display_seq': 7,
                'use_yn': 'Y',
                'first_page_yn': 'N',
                'reg_date': datetime.utcnow(),
                'upd_date': datetime.utcnow()
            },

            # ========================================
            # Macro sub-menus (MENU_LEVEL = 2)
            # ========================================
            {
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'macro-overview',
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
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'macro-regime',
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
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'macro-fed',
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
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'macro-yield',
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
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'macro-inflation',
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
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'macro-labor',
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
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'macro-financial',
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
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'macro-sentiment',
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
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'macro-commodities',
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
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'macro-banking',
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
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'macro-money',
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
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'macro-rates',
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
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'macro-trade',
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
                'pkg_type': 'MARKETPULSE',
                'menu_id': 'macro-realestate',
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
        print(f"\nInserting {len(menus)} menu items...")
        for i, menu_data in enumerate(menus, 1):
            menu = MenuManagement(**menu_data)
            session.add(menu)
            print(f"  [{i:2d}/{len(menus)}] {menu_data['menu_name']:30s} (Level {menu_data['menu_level']}, Parent: {menu_data['menu_parent_id'] or 'None':20s})")

        session.commit()

        print("\n" + "="*60)
        print("[OK] Successfully initialized menu data!")
        print("="*60)

        # 결과 요약
        top_level = session.query(MenuManagement).filter_by(menu_level=1).count()
        sub_menus = session.query(MenuManagement).filter_by(menu_level=2).count()
        print(f"\nSummary:")
        print(f"  - Top-level menus: {top_level}")
        print(f"  - Sub-menus: {sub_menus}")
        print(f"  - Total: {top_level + sub_menus}")

    except Exception as e:
        session.rollback()
        print(f"\n[ERROR] Error initializing menu data: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    print("="*60)
    print("MarketPulse Database Setup")
    print("="*60)
    print("\nOptions:")
    print("1. Create all tables")
    print("2. Initialize menu data")
    print("3. Both (create tables + initialize menu data)")
    print("="*60)

    choice = input("\nSelect option (1/2/3): ").strip()

    if choice == '1':
        create_all_tables()
    elif choice == '2':
        init_menu_data()
    elif choice == '3':
        create_all_tables()
        init_menu_data()
    else:
        print("[ERROR] Invalid option")
