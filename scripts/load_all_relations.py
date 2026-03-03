"""
전체 종목 Relations 적재 스크립트
====================================
실행: python scripts/load_all_relations.py [옵션]

옵션:
  --all          전체 종목 (기본값, skip_existing=True)
  --force        이미 적재된 종목도 강제 갱신
  --limit N      N개 종목만 처리 (테스트용)

예시:
  python scripts/load_all_relations.py              # 미적재 종목만
  python scripts/load_all_relations.py --force      # 전체 강제 갱신
  python scripts/load_all_relations.py --limit 50   # 50개 테스트
"""
import sys
import argparse
import logging
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s │ %(message)s",
    datefmt="%H:%M:%S",
)


def main():
    parser = argparse.ArgumentParser(description="전체 종목 mbs_in_stk_relations 적재")
    parser.add_argument("--force",  action="store_true", help="이미 적재된 종목도 강제 갱신")
    parser.add_argument("--limit",  type=int, default=0,  metavar="N", help="처리할 최대 종목 수 (0=전체)")
    args = parser.parse_args()

    skip_existing = not args.force

    # ── DB 테이블 확인 ─────────────────────────────────────────────────────
    print("[1/3] DB 테이블 확인 중...")
    from index_analyzer.models.orm import Base
    from index_analyzer.utils.db import default_db
    Base.metadata.create_all(bind=default_db.engine)
    print("      완료")

    # ── 전체 활성 종목 수 확인 ─────────────────────────────────────────────
    from index_analyzer.services.stock_service import get_all_active_symbols
    all_symbols = get_all_active_symbols()

    target = args.limit if args.limit > 0 else len(all_symbols)
    mode   = "강제 전체 갱신" if args.force else "미적재 종목만"

    print(f"[2/3] Relations 적재 시작")
    print(f"      대상 종목 : {len(all_symbols):,}개 (처리: {target:,}개)")
    print(f"      모드      : {mode}")
    print(f"      예상 시간 : 약 {target * 0.3 / 60:.0f}~{target * 0.5 / 60:.0f}분")
    print()

    # ── 실행 ──────────────────────────────────────────────────────────────
    from index_analyzer.services.stock_service import run_all_relations_collection
    stats = run_all_relations_collection(
        symbol_limit=args.limit,
        skip_existing=skip_existing,
    )

    # ── 결과 출력 ─────────────────────────────────────────────────────────
    print()
    print("[3/3] 완료!")
    print(f"      처리 종목  : {stats['total']:,}개")
    print(f"      skip       : {stats['skipped']:,}개")
    print(f"      relations  : {stats['relations']:,}건")
    print(f"      오류       : {stats['errors']:,}개")


if __name__ == "__main__":
    main()
