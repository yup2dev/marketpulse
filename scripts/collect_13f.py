"""13F 기관 보유 + 추정 수익률 로컬 수집 배치.

SEC EDGAR 13F 원본을 **로컬에서** 파싱해 로컬 DB(data/marketpulse.db)에 적재한다.
13F 파싱은 메모리 부담이 커서 운영 서버에서는 실행하지 않으며, 적재 결과는
scripts/sync_db_to_cloud.py 가 /api/ingest 로 전송한다.

적재 테이블: mbs_in_insti_mst(기관 목록) / mbs_in_insti_port·hold(포트폴리오)
            / mbs_in_insti_perf(분기 추정 수익률)

사용:
    python scripts/collect_13f.py                  # 즉시 실행
    python scripts/collect_13f.py --only-on sun    # 오늘이 일요일일 때만 실행(daily_ingest.bat용)

조정(환경변수): FETCHER_13F_TOP_N(기본 300), FETCHER_13F_SCAN_WORKERS(4),
               FETCHER_13F_SCAN_LIMIT(0=전체), FETCHER_13F_PERF_QUARTERS(8)
"""
from __future__ import annotations

import argparse
import logging
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

_WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only-on", choices=_WEEKDAYS, help="이 요일에만 실행(그 외엔 건너뜀)")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    log = logging.getLogger("collect_13f")

    today = _WEEKDAYS[date.today().weekday()]
    if args.only_on and today != args.only_on:
        log.info("오늘(%s)은 수집 요일(%s)이 아니라 건너뜀", today, args.only_on)
        return 0

    from index_analyzer.utils.db import default_db
    from index_analyzer.collectors import Institutional13FCollector

    default_db.create_tables()  # 신규 적재 테이블(mbs_in_insti_perf 등) 보장
    summary = Institutional13FCollector().run()
    log.info(
        "13F 수집 완료 — 기관 %s, 포트폴리오 %d, 수익률 %d, 오류 %d",
        summary["institutions"], len(summary["portfolios"]),
        summary["performance"], len(summary["errors"]),
    )
    # 포트폴리오를 하나도 못 적재했으면 실패로 보고(동기화 로그에서 식별 가능하게)
    return 0 if summary["portfolios"] else 1


if __name__ == "__main__":
    sys.exit(main())
