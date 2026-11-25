"""시장 집계 로컬 배치 — 기간별 수익률(Market Ranking 1d ~ 1y) · 섹터 성과.

로컬 DB(data/marketpulse.db)의 mbs_in_stk_stbd(일별 종가) · mbs_in_stk_profile 로 **로컬에서** 계산해
mbs_in_stk_period_rtn · mbs_in_sector_perf 에 적재한다 (index_analyzer.market_stats).
서버는 조회 때 계산하지 않고 이 행을 읽어 정렬만 한다. 적재 결과는 sync_db_to_cloud.py 가 /api/ingest 로 전송한다.

사용:
    python MarketpulseBatch/jobs/build_market_stats.py      # daily_ingest.bat 에서 백필 · 환율 다음, 동기화 전에
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

# import 경로: 저장소 루트 + 배치 — 웹 폴더는 넣지 않는다 (mp-bootstrap)
_ROOT = Path(__file__).resolve().parents[2]
for _d in ("", "MarketpulseFetcher", "MarketpulseBatch"):
    if str(_ROOT / _d) not in sys.path:
        sys.path.insert(0, str(_ROOT / _d))


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    from index_analyzer.db.engine import default_db
    from index_analyzer.market_stats import build_all

    default_db.create_tables()  # 신규 적재 테이블(mbs_in_stk_period_rtn · mbs_in_sector_perf) 보장
    counts = build_all(default_db)
    return 0 if counts["mbs_in_stk_period_rtn"] else 1


if __name__ == "__main__":
    sys.exit(main())
