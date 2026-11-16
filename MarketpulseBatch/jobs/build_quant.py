"""퀀트 산출물 로컬 배치 — 팩터 성과 · 예측 모델 검증 · 시장 국면 · 종목 시그널.

유니버스(지수 구성종목, mbs_in_indx_member)의 일별 수정 종가를 Yahoo Finance 에서 받아 **로컬에서** 계산하고
로컬 DB(data/marketpulse.db)의 mbs_in_quant_snapshot 에 적재한다. 모델 학습은 운영 서버에서 하지 않으며,
적재 결과는 MarketpulseBatch/jobs/sync_db_to_cloud.py 가 /api/ingest 로 전송한다.

사용:
    python MarketpulseBatch/jobs/build_quant.py                    # S&P 500, 최근 11년
    python MarketpulseBatch/jobs/build_quant.py --only-on sun      # 오늘이 일요일일 때만 (daily_ingest.bat 용)
    python MarketpulseBatch/jobs/build_quant.py --limit 60         # 앞 60종목만 (시험 실행)
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import date, datetime
from pathlib import Path

# import 경로: 저장소 루트 + 배치 — 웹 폴더는 넣지 않는다 (mp-bootstrap)
_ROOT = Path(__file__).resolve().parents[2]
for _d in ("", "MarketpulseFetcher", "MarketpulseBatch"):
    if str(_ROOT / _d) not in sys.path:
        sys.path.insert(0, str(_ROOT / _d))

_WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
_CHUNK = 100


def _download(symbols, years: int, log):
    """일별 수정 종가(날짜 × 종목). Yahoo 는 클래스 주식을 'BRK-B' 로 적는다."""
    import pandas as pd
    import yfinance as yf

    frames = []
    for i in range(0, len(symbols), _CHUNK):
        chunk = symbols[i:i + _CHUNK]
        data = yf.download(
            [s.replace(".", "-") for s in chunk], period=f"{years}y", interval="1d",
            auto_adjust=True, progress=False, threads=True,
        )
        close = data["Close"] if "Close" in data else data
        if isinstance(close, pd.Series):
            close = close.to_frame(chunk[0])
        frames.append(close.rename(columns={s.replace(".", "-"): s for s in chunk}))
        log.info("가격 %d / %d 종목", min(i + _CHUNK, len(symbols)), len(symbols))
    out = pd.concat(frames, axis=1).dropna(axis=1, how="all")
    out.index = pd.to_datetime(out.index).tz_localize(None)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--universe", default="sp500", help="mbs_in_indx_member 의 indx_cd (기본 sp500)")
    parser.add_argument("--years", type=int, default=11, help="받을 가격 이력 (년)")
    parser.add_argument("--limit", type=int, default=0, help="앞 N종목만 (시험 실행)")
    parser.add_argument("--only-on", choices=_WEEKDAYS, help="이 요일에만 실행(그 외엔 건너뜀)")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    log = logging.getLogger("build_quant")

    today = _WEEKDAYS[date.today().weekday()]
    if args.only_on and today != args.only_on:
        log.info("오늘(%s)은 실행 요일(%s)이 아니라 건너뜀", today, args.only_on)
        return 0

    from index_analyzer.db.engine import default_db
    from index_analyzer.db.orm import MBS_IN_INDX_MEMBER, MBS_IN_QUANT_SNAPSHOT
    from index_analyzer.quant import build_snapshots

    default_db.create_tables()   # mbs_in_quant_snapshot 보장
    session = default_db.get_session()
    try:
        members = (
            session.query(MBS_IN_INDX_MEMBER)
            .filter(MBS_IN_INDX_MEMBER.indx_cd == args.universe, MBS_IN_INDX_MEMBER.is_current.is_(True))
            .order_by(MBS_IN_INDX_MEMBER.stk_cd)
            .all()
        )
        names = {m.stk_cd: {"name": m.stk_nm, "sector": m.sector} for m in members}
        symbols = sorted(names)[: args.limit or None]
        if len(symbols) < 50:
            log.error("유니버스 '%s' 구성종목이 모자랍니다 (%d개) — collect_sp500.py 를 먼저 실행하세요", args.universe, len(symbols))
            return 1

        close = _download(symbols, args.years, log)
        snapshots = build_snapshots(close, names)
        base_ymd = datetime.strptime(snapshots["factors"]["meta"]["end"], "%Y-%m-%d").date()

        for dataset, snap in snapshots.items():
            row = session.query(MBS_IN_QUANT_SNAPSHOT).filter_by(universe=args.universe, dataset=dataset).first()
            if not row:
                row = MBS_IN_QUANT_SNAPSHOT(universe=args.universe, dataset=dataset)
                session.add(row)
            row.base_ymd = base_ymd
            row.payload = json.dumps(snap["rows"], ensure_ascii=False, separators=(",", ":"))
            row.meta = json.dumps(snap["meta"], ensure_ascii=False, separators=(",", ":"))
        session.commit()
        log.info("적재 완료 — %s · 기준일 %s · %s", args.universe, base_ymd, ", ".join(f"{k} {len(v['rows'])}행" for k, v in snapshots.items()))
        return 0
    finally:
        session.close()


if __name__ == "__main__":
    sys.exit(main())
