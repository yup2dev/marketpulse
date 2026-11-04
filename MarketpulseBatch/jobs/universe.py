"""종목 유니버스 수집 배치 → mbs_in_stbd_mst (+ ETF·국고채).

예전에는 worker 의 APScheduler 가 이 수집기를 돌리면서 예외를 로그로만 남기고 삼켰다
(실패해도 밖에서는 알 수 없었다). 이제 run_job.py 가 실행하고, 대상 하나라도 실패하면
종료 코드 1 로 알린다.

사용:
    python MarketpulseBatch/jobs/universe.py kr    # KOSPI/KOSDAQ 종목 + ETF + 국고채 (pykrx)
    python MarketpulseBatch/jobs/universe.py us    # NYSE/NASDAQ 종목 + ETF (NASDAQ Trader)
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
    log = logging.getLogger("universe")
    market = sys.argv[1] if len(sys.argv) > 1 else ""
    if market not in ("kr", "us"):
        print("usage: universe.py kr|us", file=sys.stderr)
        return 2

    from index_analyzer.collectors import (
        KRBondCollector, KRETFCollector, KRUniverseCollector, USETFCollector, USUniverseCollector,
    )
    collectors = {
        "kr": [KRUniverseCollector, KRETFCollector, KRBondCollector],
        "us": [USUniverseCollector, USETFCollector],
    }[market]

    failed = []
    for cls in collectors:
        summary = cls().run()
        log.info("%s 완료 — %s", cls.__name__, summary["targets"])
        failed += [f"{cls.__name__}:{t.get('indx_cd')}" for t in summary["targets"] if "error" in t]

    if failed:
        log.error("실패한 대상: %s", failed)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
