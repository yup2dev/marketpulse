"""
S&P 500 최초 데이터 수집 스크립트
====================================
실행: python MarketpulseBatch/jobs/collect_sp500.py

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
# import 경로: 저장소 루트 + 최상위 폴더 4개 (mp-bootstrap)
_ROOT = Path(__file__).resolve().parents[2]
for _d in ("", *("MarketpulseCommon", "MarketpulseFetcher", "MarketpulseBatch", "MarketpulseWeb")):
    if str(_ROOT / _d) not in sys.path:
        sys.path.insert(0, str(_ROOT / _d))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s │ %(message)s",
    datefmt="%H:%M:%S",
)

from marketpulse_common.models.orm import Base
from marketpulse_common.utils.db import default_db

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

    from index_analyzer.services.stock_service import run_sp500_initial_collection
    stats = run_sp500_initial_collection()

    print()
    print("[3/3] 수집 완료!")
    print(f"      구성종목  : {stats['members']:,}개")
    print(f"      프로필    : {stats['profiles']:,}개")
    print(f"      관계(양방): {stats['relations']:,}개")
    print(f"      오류      : {stats['errors']:,}개")
    print()
    print("이후 갱신 (자동 아님 — 필요하면 daily 묶음에 추가):")
    print("  - 가격/시총  : python MarketpulseBatch/run_job.py profile")
    print("  - Peer 관계  : python MarketpulseBatch/run_job.py relations")


if __name__ == "__main__":
    main()
