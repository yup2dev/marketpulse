"""
지수(Index) 테이블 생성 및 초기 데이터 입력 스크립트
MBS_IN_INDX_STBD 테이블을 생성하고 주요 지수 데이터를 삽입합니다.
"""
import sys
from pathlib import Path
from datetime import datetime, date

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import Column, String, Text, Integer, DateTime, Date, Boolean, Index, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

Base = declarative_base()


class MBS_IN_INDX_STBD(Base):
    """
    입수 - 지수 상태판 마스터
    시스템에서 사용할 주요 지수(Index/Universe) 정보 관리
    """
    __tablename__ = 'mbs_in_indx_stbd'

    indx_cd = Column(String(50), primary_key=True)  # 지수 코드 (예: sp500, nasdaq100, dow30)
    indx_nm = Column(String(200), nullable=False)  # 지수명 (예: S&P 500, NASDAQ 100)
    indx_type = Column(String(20), nullable=False, index=True)  # universe, benchmark

    # API 연동 정보
    fmp_endpoint = Column(String(100))  # FMP API 엔드포인트 (예: sp500_constituent)
    api_symbol = Column(String(20))  # API에서 사용하는 심볼 (예: SPY, QQQ - benchmark용)

    # 메타 정보
    description = Column(Text)  # 설명
    category = Column(String(50))  # 카테고리 (Large Cap, Small Cap, Tech, etc.)
    region = Column(String(50), default='US')  # 지역 (US, Global, etc.)

    # 관리 정보
    is_active = Column(Boolean, default=True, index=True)  # 활성 여부
    display_order = Column(Integer, default=0)  # 표시 순서
    remarks = Column(Text)  # 비고

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('idx_indx_type', 'indx_type'),
        Index('idx_indx_active', 'is_active'),
        Index('idx_indx_order', 'display_order'),
    )

    def to_dict(self) -> dict:
        return {
            'indx_cd': self.indx_cd,
            'indx_nm': self.indx_nm,
            'indx_type': self.indx_type,
            'fmp_endpoint': self.fmp_endpoint,
            'api_symbol': self.api_symbol,
            'description': self.description,
            'category': self.category,
            'region': self.region,
            'is_active': self.is_active,
            'display_order': self.display_order,
            'remarks': self.remarks
        }


# 초기 데이터
INITIAL_UNIVERSES = [
    {
        'indx_cd': 'sp500',
        'indx_nm': 'S&P 500',
        'indx_type': 'universe',
        'fmp_endpoint': 'sp500_constituent',
        'api_symbol': None,
        'description': 'S&P 500 Index - 500 large-cap US stocks',
        'category': 'Large Cap',
        'region': 'US',
        'is_active': True,
        'display_order': 1
    },
    {
        'indx_cd': 'nasdaq100',
        'indx_nm': 'NASDAQ 100',
        'indx_type': 'universe',
        'fmp_endpoint': 'nasdaq_constituent',
        'api_symbol': None,
        'description': 'NASDAQ 100 Index - Top 100 non-financial NASDAQ stocks',
        'category': 'Tech/Growth',
        'region': 'US',
        'is_active': True,
        'display_order': 2
    },
    {
        'indx_cd': 'dow30',
        'indx_nm': 'Dow Jones 30',
        'indx_type': 'universe',
        'fmp_endpoint': 'dowjones_constituent',
        'api_symbol': None,
        'description': 'Dow Jones Industrial Average - 30 blue chip US stocks',
        'category': 'Blue Chip',
        'region': 'US',
        'is_active': True,
        'display_order': 3
    }
]

INITIAL_BENCHMARKS = [
    {
        'indx_cd': 'spy',
        'indx_nm': 'SPDR S&P 500 ETF',
        'indx_type': 'benchmark',
        'fmp_endpoint': None,
        'api_symbol': 'SPY',
        'description': 'Tracks the S&P 500 Index',
        'category': 'Large Cap',
        'region': 'US',
        'is_active': True,
        'display_order': 1
    },
    {
        'indx_cd': 'qqq',
        'indx_nm': 'Invesco QQQ Trust',
        'indx_type': 'benchmark',
        'fmp_endpoint': None,
        'api_symbol': 'QQQ',
        'description': 'Tracks the NASDAQ 100 Index',
        'category': 'Tech/Growth',
        'region': 'US',
        'is_active': True,
        'display_order': 2
    },
    {
        'indx_cd': 'dia',
        'indx_nm': 'SPDR Dow Jones ETF',
        'indx_type': 'benchmark',
        'fmp_endpoint': None,
        'api_symbol': 'DIA',
        'description': 'Tracks the Dow Jones Industrial Average',
        'category': 'Blue Chip',
        'region': 'US',
        'is_active': True,
        'display_order': 3
    },
    {
        'indx_cd': 'iwm',
        'indx_nm': 'iShares Russell 2000 ETF',
        'indx_type': 'benchmark',
        'fmp_endpoint': None,
        'api_symbol': 'IWM',
        'description': 'Tracks the Russell 2000 Small-Cap Index',
        'category': 'Small Cap',
        'region': 'US',
        'is_active': True,
        'display_order': 4
    },
    {
        'indx_cd': 'vti',
        'indx_nm': 'Vanguard Total Stock Market ETF',
        'indx_type': 'benchmark',
        'fmp_endpoint': None,
        'api_symbol': 'VTI',
        'description': 'Tracks the total US stock market',
        'category': 'Total Market',
        'region': 'US',
        'is_active': True,
        'display_order': 5
    }
]


def main():
    """테이블 생성 및 초기 데이터 입력"""
    # Database path
    DB_PATH = Path(__file__).parent.parent / "data" / "marketpulse.db"

    # Create engine
    engine = create_engine(f'sqlite:///{DB_PATH}')

    print(f"Creating MBS_IN_INDX_STBD table in {DB_PATH}...")

    # Create table
    Base.metadata.create_all(engine)

    print("[OK] Table created successfully")

    # Create session
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # Insert universes
        print("\nInserting universe data...")
        for universe_data in INITIAL_UNIVERSES:
            universe = MBS_IN_INDX_STBD(**universe_data)
            session.merge(universe)  # Use merge to handle duplicates
            print(f"  [OK] {universe_data['indx_cd']}: {universe_data['indx_nm']}")

        # Insert benchmarks
        print("\nInserting benchmark data...")
        for benchmark_data in INITIAL_BENCHMARKS:
            benchmark = MBS_IN_INDX_STBD(**benchmark_data)
            session.merge(benchmark)  # Use merge to handle duplicates
            print(f"  [OK] {benchmark_data['indx_cd']}: {benchmark_data['indx_nm']}")

        session.commit()
        print("\n[OK] All data inserted successfully!")

        # Display summary
        print("\n" + "="*60)
        print("Summary:")
        print("="*60)

        universes = session.query(MBS_IN_INDX_STBD).filter_by(indx_type='universe', is_active=True).all()
        print(f"\nUniverses ({len(universes)}):")
        for u in universes:
            print(f"  - {u.indx_cd}: {u.indx_nm} ({u.category})")

        benchmarks = session.query(MBS_IN_INDX_STBD).filter_by(indx_type='benchmark', is_active=True).all()
        print(f"\nBenchmarks ({len(benchmarks)}):")
        for b in benchmarks:
            print(f"  - {b.indx_cd}: {b.indx_nm} - {b.api_symbol} ({b.category})")

    except Exception as e:
        session.rollback()
        print(f"\n[ERROR] Error: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()