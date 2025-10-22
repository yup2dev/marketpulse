#!/usr/bin/env python3
"""
DB 스키마 검증 및 상세 정보 출력
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.models.database import Database
from sqlalchemy import text, inspect

def verify_schema():
    """데이터베이스 스키마 검증"""
    db_path = Path(__file__).parent.parent / "data" / "marketpulse.db"
    db = Database(f"sqlite:///{db_path}")

    print("\n" + "="*70)
    print("📋 DATABASE SCHEMA VERIFICATION")
    print("="*70 + "\n")

    session = db.get_session()
    inspector = inspect(db.engine)

    # 테이블 목록
    tables = inspector.get_table_names()
    print(f"✅ Total Tables: {len(tables)}\n")

    for table_name in sorted(tables):
        print(f"\n📌 Table: {table_name}")
        print("-" * 70)

        # 컬럼 정보
        columns = inspector.get_columns(table_name)
        print(f"   Columns ({len(columns)}):")
        for col in columns:
            col_type = str(col['type'])
            nullable = "NULL" if col['nullable'] else "NOT NULL"
            default = f" DEFAULT {col['default']}" if col['default'] else ""
            print(f"      • {col['name']:<20} {col_type:<20} {nullable}{default}")

        # Primary Key
        pk = inspector.get_pk_constraint(table_name)
        if pk and pk['constrained_columns']:
            print(f"\n   Primary Key: {', '.join(pk['constrained_columns'])}")

        # Indexes
        indexes = inspector.get_indexes(table_name)
        if indexes:
            print(f"   Indexes ({len(indexes)}):")
            for idx in indexes:
                cols = ', '.join(idx['column_names'])
                unique = "UNIQUE" if idx['unique'] else "NON-UNIQUE"
                print(f"      • {idx['name']:<30} [{unique}] {cols}")

        # Unique Constraints
        constraints = inspector.get_unique_constraints(table_name)
        if constraints:
            print(f"   Unique Constraints ({len(constraints)}):")
            for const in constraints:
                cols = ', '.join(const['column_names'])
                print(f"      • {const.get('name', 'unnamed'):<30} {cols}")

        # Foreign Keys
        fks = inspector.get_foreign_keys(table_name)
        if fks:
            print(f"   Foreign Keys ({len(fks)}):")
            for fk in fks:
                print(f"      • {fk['constrained_columns']} -> {fk['referred_table']}.{fk['referred_columns']}")

    # 테이블 통계
    print("\n" + "="*70)
    print("📊 TABLE STATISTICS")
    print("="*70 + "\n")

    for table_name in sorted(tables):
        try:
            result = session.execute(text(f"SELECT COUNT(*) as cnt FROM {table_name}"))
            row = result.fetchone()
            count = row[0] if row else 0
            print(f"   {table_name:<30} {count:>10} rows")
        except Exception as e:
            print(f"   {table_name:<30} (error: {str(e)[:40]})")

    session.close()

    print("\n" + "="*70)
    print("✅ SCHEMA VERIFICATION COMPLETE")
    print("="*70 + "\n")

    return True

if __name__ == "__main__":
    try:
        verify_schema()
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
