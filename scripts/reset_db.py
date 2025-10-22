#!/usr/bin/env python3
"""
DB 테이블 드롭 및 재생성 스크립트
base_ymd 기준으로 전일 종가(prev_close)를 포함한 새로운 스키마
"""
import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.models.database import Database, Base

def reset_database():
    """
    데이터베이스 테이블 완전 재설정
    1. 모든 테이블 드롭
    2. 새로운 스키마로 테이블 생성
    """
    db_path = Path(__file__).parent.parent / "data" / "marketpulse.db"

    print(f"📊 Database Reset Script")
    print(f"Database Path: {db_path}")
    print(f"Database Exists: {db_path.exists()}")

    # 데이터베이스 초기화
    db = Database(f"sqlite:///{db_path}")

    # 1. 모든 테이블 드롭
    print("\n1️⃣  Dropping all existing tables...")
    try:
        db.drop_tables()
        print("   ✅ All tables dropped successfully")
    except Exception as e:
        print(f"   ⚠️  Error dropping tables: {e}")

    # 2. 새로운 테이블 생성
    print("\n2️⃣  Creating new tables with updated schema...")
    try:
        db.create_tables()
        print("   ✅ All tables created successfully")
    except Exception as e:
        print(f"   ❌ Error creating tables: {e}")
        return False

    # 3. 생성된 테이블 확인
    print("\n3️⃣  Verifying created tables...")
    try:
        inspector_query = "SELECT name FROM sqlite_master WHERE type='table';"
        session = db.get_session()
        result = session.execute(inspector_query)
        tables = [row[0] for row in result]
        session.close()

        if tables:
            print(f"   ✅ Tables created ({len(tables)} tables):")
            for table in tables:
                print(f"      - {table}")
        else:
            print("   ❌ No tables found after creation")
            return False
    except Exception as e:
        print(f"   ⚠️  Could not verify tables: {e}")

    print("\n" + "="*50)
    print("🎉 Database reset completed successfully!")
    print("="*50)

    print("\n📋 Schema Summary:")
    print("""
    1. Tickers (종목 마스터)
       - symbol (PK): 종목 코드 (AAPL, GC=F 등)
       - name: 종목명
       - exchange: 거래소
       - asset_type: 자산 유형 (stock, commodity, etf, crypto, index)
       - sector, industry: 분류
       - is_active: 활성화 여부

    2. TickerPrices (일별 가격 데이터)
       - symbol + base_ymd (복합 UNIQUE)
       - base_ymd: 기준 날짜 (중요!)
       - open, high, low, close: OHLC 가격
       - prev_close: ⭐ 전일 종가 (새로 추가!)
       - volume: 거래량
       - change, change_pct: 변동값 및 변동률

    3. NewsArticles (뉴스 기사)
       - url (UNIQUE): 뉴스 URL
       - title, summary, content: 기사 내용
       - base_ymd: 기준 날짜
       - sentiment_score: 감성 점수 (-1.0 ~ 1.0)
       - importance_score: 중요도 점수

    4. NewsTickers (뉴스-종목 관계)
       - news_id + ticker_symbol (UNIQUE)
       - confidence: 종목 추출 신뢰도

    5. MarketSummary (일별 시장 요약)
       - base_ymd (UNIQUE): 기준 날짜
       - news_count, avg_sentiment: 뉴스 통계
       - trending_ticker_symbol: 핫 종목
       - sp500, nasdaq: 지수 데이터
    """)

    return True

if __name__ == "__main__":
    try:
        success = reset_database()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
