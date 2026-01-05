"""
데이터베이스 테이블 생성 스크립트
"""
import sys
from pathlib import Path

# Add project root to path
project_root = str(Path(__file__).parent)
sys.path.insert(0, project_root)

from index_analyzer.models.database import Base, default_db

def create_all_tables():
    """
    모든 테이블 생성
    """
    print("Creating database tables...")
    print(f"Database path: {default_db.engine.url}")

    try:
        # 테이블 생성
        Base.metadata.create_all(bind=default_db.engine)
        print("\n✅ All tables created successfully!")

        # 생성된 테이블 목록 출력
        print("\nCreated tables:")
        for table in Base.metadata.sorted_tables:
            print(f"  - {table.name}")

    except Exception as e:
        print(f"\n❌ Error creating tables: {e}")
        raise

if __name__ == "__main__":
    create_all_tables()
