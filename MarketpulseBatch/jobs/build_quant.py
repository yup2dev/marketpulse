"""퀀트 산출물 로컬 배치 — 팩터 성과 · 예측 모델 검증 · 시장 국면 · 종목 시그널.

유니버스(지수 구성종목, mbs_in_indx_member)의 일별 수정 종가를 Yahoo Finance 에서 받아 **로컬에서** 계산하고
로컬 DB(data/marketpulse.db)의 mbs_in_quant_snapshot(화면 산출물) · mbs_in_quant_panel(월별 패널 — 웹에서 만든
포트폴리오 전략을 서버가 바로 백테스트하는 재료)에 적재한다. 모델 학습은 운영 서버에서 하지 않으며,
적재 결과는 MarketpulseBatch/jobs/sync_db_to_cloud.py 가 /api/ingest 로 전송한다.

사용:
    python MarketpulseBatch/jobs/build_quant.py                    # S&P 500, 최근 11년
    python MarketpulseBatch/jobs/build_quant.py --only-on sun      # 오늘이 일요일일 때만 (daily_ingest.bat 용)
    python MarketpulseBatch/jobs/build_quant.py --limit 60         # 앞 60종목만 (시험 실행)
    python MarketpulseBatch/jobs/build_quant.py --macro-only       # 매크로 지표('^TNX' · '^HG' …)만 패널에 (quant/macro.py)
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


def _macro(years: int, yahoo_to_id: dict, log):
    """매크로 지표 일별 값 — 이름을 패널 코드('^TNX' · '^HG' …)로. 받지 못한 지표는 빼고 경고만."""
    data = _download(list(yahoo_to_id), years, log)
    out = []
    for yahoo, code in yahoo_to_id.items():
        if yahoo in data and data[yahoo].notna().any():
            out.append(data[yahoo].dropna().rename(code))
        else:
            log.warning("매크로 지표 %s(%s) 를 받지 못했습니다 — 이 지표를 쓰는 조건은 계산되지 않습니다", code, yahoo)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--universe", default="sp500", help="mbs_in_indx_member 의 indx_cd (기본 sp500)")
    parser.add_argument("--years", type=int, default=11, help="받을 가격 이력 (년)")
    parser.add_argument("--limit", type=int, default=0, help="앞 N종목만 (시험 실행)")
    parser.add_argument("--benchmark", default="^GSPC", help="전략 백테스트의 벤치마크 지수 (Yahoo 코드)")
    parser.add_argument("--only-on", choices=_WEEKDAYS, help="이 요일에만 실행(그 외엔 건너뜀)")
    parser.add_argument("--macro-only", action="store_true",
                        help="매크로 지표('^' 행)만 받아 패널에 넣는다 — 종목 · 모델은 그대로 (빠름)")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    log = logging.getLogger("build_quant")

    today = _WEEKDAYS[date.today().weekday()]
    if args.only_on and today != args.only_on:
        log.info("오늘(%s)은 실행 요일(%s)이 아니라 건너뜀", today, args.only_on)
        return 0

    from index_analyzer.db.engine import default_db
    from index_analyzer.db.orm import MBS_IN_INDX_MEMBER, MBS_IN_QUANT_PANEL, MBS_IN_QUANT_SNAPSHOT
    from index_analyzer.quant import build_all
    from index_analyzer.quant.macro import MACRO_IDS, YAHOO_TO_ID
    from index_analyzer.quant.panel import index_rows

    default_db.create_tables()   # mbs_in_quant_snapshot · mbs_in_quant_panel 보장
    session = default_db.get_session()
    try:
        members = (
            session.query(MBS_IN_INDX_MEMBER)
            .filter(MBS_IN_INDX_MEMBER.indx_cd == args.universe, MBS_IN_INDX_MEMBER.is_current.is_(True))
            .order_by(MBS_IN_INDX_MEMBER.stk_cd)
            .all()
        )
        if args.macro_only:
            macro = _macro(args.years, YAHOO_TO_ID, log)
            rows = [r for m in macro for r in index_rows(m, args.universe)]
            session.query(MBS_IN_QUANT_PANEL).filter(
                MBS_IN_QUANT_PANEL.universe == args.universe, MBS_IN_QUANT_PANEL.stk_cd.in_(MACRO_IDS)).delete()
            session.bulk_insert_mappings(MBS_IN_QUANT_PANEL, rows)
            session.commit()
            log.info("매크로 지표 적재 — %s · %d행", ", ".join(m.name for m in macro), len(rows))
            return 0

        names = {m.stk_cd: {"name": m.stk_nm, "sector": m.sector} for m in members}
        symbols = sorted(names)[: args.limit or None]
        if len(symbols) < 50:
            log.error("유니버스 '%s' 구성종목이 모자랍니다 (%d개) — collect_sp500.py 를 먼저 실행하세요", args.universe, len(symbols))
            return 1

        close = _download(symbols, args.years, log)
        bench = _download([args.benchmark], args.years, log)
        benchmark = bench.iloc[:, 0].rename(args.benchmark) if bench.shape[1] else None
        if benchmark is None:
            log.warning("벤치마크 %s 가격을 받지 못했습니다 — 전략은 유니버스 동일 비중과만 견준다", args.benchmark)
        macro = _macro(args.years, YAHOO_TO_ID, log)
        snapshots, panel = build_all(close, names, args.universe, benchmark, macro)
        base_ymd = datetime.strptime(snapshots["factors"]["meta"]["end"], "%Y-%m-%d").date()

        for dataset, snap in snapshots.items():
            row = session.query(MBS_IN_QUANT_SNAPSHOT).filter_by(universe=args.universe, dataset=dataset).first()
            if not row:
                row = MBS_IN_QUANT_SNAPSHOT(universe=args.universe, dataset=dataset)
                session.add(row)
            row.base_ymd = base_ymd
            row.payload = json.dumps(snap["rows"], ensure_ascii=False, separators=(",", ":"))
            row.meta = json.dumps(snap["meta"], ensure_ascii=False, separators=(",", ":"))
        # 패널은 유니버스 단위로 통째 교체 — 예전 달의 표본 밖 확률도 매번 다시 계산되기 때문
        session.query(MBS_IN_QUANT_PANEL).filter(MBS_IN_QUANT_PANEL.universe == args.universe).delete()
        session.bulk_insert_mappings(MBS_IN_QUANT_PANEL, panel)
        session.commit()
        log.info("패널 적재 — %d행", len(panel))
        log.info("적재 완료 — %s · 기준일 %s · %s", args.universe, base_ymd, ", ".join(f"{k} {len(v['rows'])}행" for k, v in snapshots.items()))
        return 0
    finally:
        session.close()


if __name__ == "__main__":
    sys.exit(main())
