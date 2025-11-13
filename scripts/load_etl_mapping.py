"""
ETL 매핑 CSV 파일을 DB 테이블로 로딩하는 스크립트

실행: python scripts/load_etl_mapping.py
"""
import sys
import os
import pandas as pd
from pathlib import Path
from sqlalchemy import func

# 프로젝트 루트 디렉토리를 sys.path에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from app.models.database import SessionLocal, engine, Base
from app.models.etl_mapping import ETLMapping


def load_csv_to_db(csv_path: str, encoding: str = 'euc-kr'):
    """
    CSV 파일을 읽어서 DB 테이블에 로딩

    Args:
        csv_path: CSV 파일 경로
        encoding: 파일 인코딩 (기본: euc-kr)
    """
    print("=" * 80)
    print("ETL 매핑 데이터 로딩 시작")
    print("=" * 80)

    # 1. 테이블 생성
    print("\n[1/4] Creating table...")
    Base.metadata.create_all(bind=engine)
    print("[OK] Table created: mbs_in_etl_mapping")

    # 2. CSV 파일 읽기
    print(f"\n[2/4] Reading CSV file: {csv_path}")
    try:
        df = pd.read_csv(csv_path, encoding=encoding)
        print(f"[OK] CSV file loaded: {len(df)} rows")
        print(f"     Columns: {list(df.columns)}")
    except Exception as e:
        print(f"[ERROR] CSV file loading failed: {e}")
        return

    # 3. 기존 데이터 삭제
    print("\n[3/4] Deleting existing data...")
    db = SessionLocal()
    try:
        deleted_count = db.query(ETLMapping).delete()
        db.commit()
        print(f"[OK] Existing data deleted: {deleted_count} rows")
    except Exception as e:
        print(f"[ERROR] Data deletion failed: {e}")
        db.rollback()
        db.close()
        return

    # 4. 새 데이터 삽입
    print("\n[4/4] Inserting new data...")
    inserted_count = 0
    skipped_count = 0

    for idx, row in df.iterrows():
        # 빈 행 건너뛰기
        category = str(row.get('카테고리', '')).strip()
        keyword = str(row.get('뉴스 키워드/주제', '')).strip()
        data_source = str(row.get('데이터 소스', '')).strip()

        # 필수 필드가 비어있으면 건너뛰기
        if not keyword or keyword == 'nan' or not data_source or data_source == 'nan':
            skipped_count += 1
            continue

        try:
            mapping = ETLMapping(
                category=category if category and category != 'nan' else None,
                keyword=keyword,
                indicator=str(row.get('관련 금융지표', '')).strip() if pd.notna(row.get('관련 금융지표')) else None,
                data_source=data_source,
                api_endpoint=str(row.get('API/엔드포인트', '')).strip() if pd.notna(row.get('API/엔드포인트')) else None,
                main_fields=str(row.get('주요 필드', '')).strip() if pd.notna(row.get('주요 필드')) else None,
                update_cycle=str(row.get('업데이트 주기', '')).strip() if pd.notna(row.get('업데이트 주기')) else None,
                fallback_source=str(row.get('Fallback 소스', '')).strip() if pd.notna(row.get('Fallback 소스')) else None,
                note=str(row.get('비고', '')).strip() if pd.notna(row.get('비고')) else None,
                is_active=1
            )
            db.add(mapping)
            inserted_count += 1
        except Exception as e:
            print(f"[WARNING] Row {idx} insertion failed: {e}")
            print(f"          Data: category={category}, keyword={keyword}, source={data_source}")
            continue

    try:
        db.commit()
        print(f"[OK] Data inserted: {inserted_count} rows")
        if skipped_count > 0:
            print(f"[WARNING] Skipped rows: {skipped_count} rows (empty data)")
    except Exception as e:
        print(f"[ERROR] Data insertion failed: {e}")
        db.rollback()
    finally:
        db.close()

    print("\n" + "=" * 80)
    print("ETL 매핑 데이터 로딩 완료")
    print("=" * 80)

    # 5. 로딩 결과 확인
    print("\n[Result Summary]")
    db = SessionLocal()
    try:
        total_count = db.query(ETLMapping).count()
        print(f"Total mappings: {total_count}")

        # 카테고리별 집계
        print("\n[By Category]")
        categories = db.query(ETLMapping.category, func.count(ETLMapping.mapping_id))\
            .group_by(ETLMapping.category)\
            .all()

        for category, count in categories:
            print(f"  {category or '(None)'}: {count}")

        # 데이터 소스별 집계
        print("\n[By Data Source]")
        sources = db.query(ETLMapping.data_source, func.count(ETLMapping.mapping_id))\
            .group_by(ETLMapping.data_source)\
            .all()

        for source, count in sources:
            print(f"  {source}: {count}")

        # 샘플 데이터 출력
        print("\n[Sample Data (5 rows)]")
        samples = db.query(ETLMapping).limit(5).all()
        for sample in samples:
            print(f"  - {sample.category} | {sample.keyword} | {sample.data_source} | {sample.api_endpoint}")

    finally:
        db.close()


if __name__ == "__main__":
    # CSV 파일 경로
    csv_path = project_root / "docs" / "ETL_데이터매핑_구조표.csv"

    if not csv_path.exists():
        print(f"[ERROR] CSV file not found: {csv_path}")
        sys.exit(1)

    # 로딩 실행
    load_csv_to_db(str(csv_path), encoding='euc-kr')
