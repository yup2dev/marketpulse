"""S&P 500 프로필(가격·시총) 갱신 / Peer 관계 갱신 배치.

전제: collect_sp500.py 가 한 번 실행돼 mbs_in_indx_member(sp500)·mbs_in_stk_profile 이 있어야 한다.

사용:
    python MarketpulseBatch/jobs/stock_profile.py price       # 가격·시총 (yfinance)
    python MarketpulseBatch/jobs/stock_profile.py relations   # Peer 관계 (FMP — FMP_API_KEY 필요)
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
    log = logging.getLogger("stock_profile")
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode not in ("price", "relations"):
        print("usage: stock_profile.py price|relations", file=sys.stderr)
        return 2

    from index_analyzer.services.stock_service import run_daily_profile_update, run_weekly_relations_refresh

    if mode == "price":
        stats = run_daily_profile_update()
        done = stats.get("updated", 0)
    else:
        stats = run_weekly_relations_refresh()
        done = stats.get("refreshed", 0)
    log.info("%s 완료 — %s", mode, stats)
    # 한 건도 처리하지 못했으면 실패 (S&P 500 미적재, 키 없음, 네트워크 등)
    return 0 if done else 1


if __name__ == "__main__":
    sys.exit(main())
