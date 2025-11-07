"""
Check Price Data - IN 테이블에 저장된 가격 데이터 확인
"""
import sys
import io
from pathlib import Path

# Fix Windows encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.models.database import (
    get_sqlite_db, MBS_IN_STK_STBD, MBS_IN_ETF_STBD,
    MBS_IN_BOND_STBD, MBS_IN_CMDTY_STBD
)
from datetime import date


def check_price_data():
    """가격 데이터 확인"""
    print("="*80)
    print("Checking Price Data in IN Tables")
    print("="*80)

    # DB 연결
    DB_PATH = Path(__file__).parent.parent / "data" / "marketpulse.db"
    db = get_sqlite_db(str(DB_PATH))
    session = db.get_session()

    today = date.today()

    try:
        # 1. 주식 가격 데이터
        stock_count = session.query(MBS_IN_STK_STBD).filter_by(base_ymd=today).count()
        print(f"\n[MBS_IN_STK_STBD] Today's stock prices: {stock_count}")

        if stock_count > 0:
            # 샘플 데이터 조회
            samples = session.query(MBS_IN_STK_STBD).filter_by(base_ymd=today).limit(5).all()
            print(f"{'Symbol':<10} {'Name':<30} {'Price':<12} {'Change %':<10}")
            print("-"*70)
            for stock in samples:
                print(
                    f"{stock.stk_cd:<10} "
                    f"{stock.stk_nm[:28]:<30} "
                    f"${stock.close_price:<11.2f} "
                    f"{stock.change_rate:>9.2f}%" if stock.change_rate else "N/A"
                )

        # 2. ETF 가격 데이터
        etf_count = session.query(MBS_IN_ETF_STBD).filter_by(base_ymd=today).count()
        print(f"\n[MBS_IN_ETF_STBD] Today's ETF prices: {etf_count}")

        if etf_count > 0:
            samples = session.query(MBS_IN_ETF_STBD).filter_by(base_ymd=today).all()
            print(f"{'Symbol':<10} {'Name':<30} {'Price':<12} {'Change %':<10}")
            print("-"*70)
            for etf in samples:
                print(
                    f"{etf.etf_cd:<10} "
                    f"{etf.etf_nm[:28]:<30} "
                    f"${etf.close_price:<11.2f} "
                    f"{etf.change_rate:>9.2f}%" if etf.change_rate else "N/A"
                )

        # 3. 채권 가격 데이터
        bond_count = session.query(MBS_IN_BOND_STBD).filter_by(base_ymd=today).count()
        print(f"\n[MBS_IN_BOND_STBD] Today's bond prices: {bond_count}")

        if bond_count > 0:
            samples = session.query(MBS_IN_BOND_STBD).filter_by(base_ymd=today).all()
            print(f"{'Symbol':<10} {'Name':<30} {'Price':<12} {'Yield %':<10}")
            print("-"*70)
            for bond in samples:
                yield_str = f"{bond.yield_rate:>9.2f}%" if bond.yield_rate else "N/A"
                print(
                    f"{bond.bond_cd:<10} "
                    f"{bond.bond_nm[:28]:<30} "
                    f"${bond.close_price:<11.2f} "
                    f"{yield_str}"
                )

        # 4. 원자재 가격 데이터
        cmdty_count = session.query(MBS_IN_CMDTY_STBD).filter_by(base_ymd=today).count()
        print(f"\n[MBS_IN_CMDTY_STBD] Today's commodity prices: {cmdty_count}")

        if cmdty_count > 0:
            samples = session.query(MBS_IN_CMDTY_STBD).filter_by(base_ymd=today).limit(10).all()
            print(f"{'Symbol':<10} {'Name':<30} {'Price':<12} {'Change %':<10}")
            print("-"*70)
            for cmdty in samples:
                print(
                    f"{cmdty.cmdty_cd:<10} "
                    f"{cmdty.cmdty_nm[:28]:<30} "
                    f"${cmdty.close_price:<11.2f} "
                    f"{cmdty.change_rate:>9.2f}%" if cmdty.change_rate else "N/A"
                )

        print("\n" + "="*80)
        print(f"Total: {stock_count + etf_count + bond_count + cmdty_count} price records for today")
        print("="*80)

    finally:
        session.close()


if __name__ == "__main__":
    check_price_data()
