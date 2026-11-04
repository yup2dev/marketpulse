"""일별 환율 로컬 수집 배치 → mbs_in_fx_stbd.

yahoo fetcher(QueryExecutor in-process)로 환율을 받아 로컬 DB에 적재한다.
적재 결과는 MarketpulseBatch/jobs/sync_db_to_cloud.py 가 /api/ingest 로 서버에 전송하고,
서버는 이 테이블만 읽어 통화 환산을 계산한다.

사용:
    python MarketpulseBatch/jobs/collect_fx.py          # 최근 1개월 (누락 구간 보정 겸, daily_ingest 기본)
    python MarketpulseBatch/jobs/collect_fx.py 1y       # 기간 지정 (최초 백필)
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

# import 경로: 저장소 루트 + 최상위 폴더 4개 (mp-bootstrap)
_ROOT = Path(__file__).resolve().parents[2]
for _d in ("", *("MarketpulseCommon", "MarketpulseFetcher", "MarketpulseBatch", "MarketpulseWeb")):
    if str(_ROOT / _d) not in sys.path:
        sys.path.insert(0, str(_ROOT / _d))


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    log = logging.getLogger("collect_fx")
    period = sys.argv[1] if len(sys.argv) > 1 else "1mo"

    from index_analyzer.collectors import FXRateCollector

    summary = FXRateCollector(period=period).run()
    log.info("환율 수집 완료 — %s", summary["targets"])
    ok = [t for t in summary["targets"] if t.get("upserted")]
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
