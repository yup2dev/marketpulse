"""
S&P 500 최초 데이터 수집 스크립트
====================================
실행: python scripts/collect_sp500.py

수집 내용:
  1. S&P 500 구성종목 → mbs_in_indx_member + mbs_in_stbd_mst
  2. 회사 상세 프로필 → mbs_in_stk_profile
  3. Peer/경쟁사 관계 → mbs_in_stk_relations

소요 시간: 약 10~20분 (500종목 × API rate-limit)
"""
import sys
import logging
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s │ %(message)s",
    datefmt="%H:%M:%S",
)

from index_analyzer.models.database import default_db, Base

def main():
    # 1. 테이블 생성 (신규 테이블 포함)
    print("[1/3] DB 테이블 생성 중...")
    Base.metadata.create_all(bind=default_db.engine)
    print("      완료")

    # 2. S&P 500 전체 수집
    print("[2/3] S&P 500 데이터 수집 시작 (약 10~20분 소요)...")
    print("      - 구성종목 → mbs_in_indx_member, mbs_in_stbd_mst")
    print("      - 회사 프로필 → mbs_in_stk_profile")
    print("      - Peer 관계 → mbs_in_stk_relations")
    print()

    from index_analyzer.pipeline.stock_collect_module import run_sp500_initial_collection
    stats = run_sp500_initial_collection()

    print()
    print("[3/3] 수집 완료!")
    print(f"      구성종목  : {stats['members']:,}개")
    print(f"      프로필    : {stats['profiles']:,}개")
    print(f"      관계(양방): {stats['relations']:,}개")
    print(f"      오류      : {stats['errors']:,}개")
    print()
    print("이후 스케줄러가 자동으로 갱신합니다:")
    print("  - 매일 06:00  → 주가/시총 업데이트")
    print("  - 매주 일요일 → Peer 관계 갱신")
    print("  - 매월 1일    → 전체 재수집")


if __name__ == "__main__":
    main()
