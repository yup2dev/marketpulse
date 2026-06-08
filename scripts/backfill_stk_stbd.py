"""mbs_in_stk_stbd 일별 시세 백필 배치.

활성 주식 유니버스(mbs_in_stbd_mst)에 대해 yfinance에서 일별 OHLCV를 내려받아
종가·전일比 등락률·거래량을 base_ymd별로 mbs_in_stk_stbd에 UPSERT한다.
(stk_cd, base_ymd) 유니크 제약으로 재실행 시 덮어쓴다.

사용:
    python scripts/backfill_stk_stbd.py            # 기본 1년치
    python scripts/backfill_stk_stbd.py 6mo        # 기간 지정
"""
import sys
import sqlite3
import logging
import concurrent.futures as cf
from datetime import datetime
from pathlib import Path

import pandas as pd
import yfinance as yf

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("backfill")

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "marketpulse.db"

CHUNK_SIZE = 50
MAX_WORKERS = 4

_KR_SUFFIX = {"KOSPI": ".KS", "KOSDAQ": ".KQ"}


def to_quote_symbol(ticker_cd: str, exchange: str = "", curr: str = "") -> str:
    code = (ticker_cd or "").strip()
    if not code:
        return code
    if curr == "KRW" or (exchange or "").upper() in _KR_SUFFIX:
        if "." in code:
            return code
        return code + _KR_SUFFIX.get((exchange or "").upper(), ".KS")
    # US/기타: 클래스주 BRK.B → BRK-B (yfinance는 대시 사용)
    return code.replace(".", "-")


def load_universe(con) -> list[dict]:
    cur = con.cursor()
    rows = cur.execute(
        """SELECT ticker_cd, ticker_nm, sector, curr, exchange
           FROM mbs_in_stbd_mst
           WHERE is_active = 1 AND asset_type IN ('stock', 'etf')"""
    ).fetchall()
    universe = []
    for ticker_cd, ticker_nm, sector, curr, exchange in rows:
        universe.append({
            "stk_cd": ticker_cd,
            "stk_nm": ticker_nm or ticker_cd,
            "sector": sector or "",
            "curr": curr or "USD",
            "yf": to_quote_symbol(ticker_cd, exchange or "", curr or ""),
        })
    return universe


def download_chunk(symbols: list[str], period: str):
    try:
        return symbols, yf.download(
            tickers=symbols, period=period, interval="1d",
            auto_adjust=True, progress=False, threads=False, group_by="column",
        )
    except Exception as exc:
        log.warning("download failed for chunk %s..: %s", symbols[:2], exc)
        return symbols, pd.DataFrame()


def extract_rows(meta_by_yf: dict, symbols: list[str], data: pd.DataFrame, batch_id: str):
    """다운로드 DataFrame → (stk_cd, base_ymd, close, change_rate, volume) row 리스트."""
    if data is None or getattr(data, "empty", True):
        return []
    is_multi = isinstance(data.columns, pd.MultiIndex)
    now = datetime.utcnow().isoformat()
    out = []
    for yf_sym in symbols:
        meta = meta_by_yf.get(yf_sym)
        if not meta:
            continue
        try:
            close = data["Close"][yf_sym] if is_multi else data["Close"]
            vol = data["Volume"][yf_sym] if is_multi else data["Volume"]
        except Exception:
            continue
        close = close.dropna()
        if close.empty:
            continue
        prev = close.shift(1)
        for dt, price in close.items():
            base_ymd = dt.date().isoformat()
            p = float(price)
            ref = prev.get(dt)
            chg = ((p - float(ref)) / float(ref) * 100) if (ref is not None and pd.notna(ref) and float(ref)) else None
            v = vol.get(dt)
            v = int(v) if (v is not None and pd.notna(v)) else None
            out.append((
                meta["stk_cd"], meta["stk_nm"], meta["sector"], meta["curr"],
                round(p, 4), round(chg, 4) if chg is not None else None, v,
                base_ymd, batch_id, now, now,
            ))
    return out


def upsert_rows(con, rows: list[tuple]):
    con.executemany(
        """INSERT OR REPLACE INTO mbs_in_stk_stbd
           (stk_cd, stk_nm, sector, curr, close_price, change_rate, volume,
            base_ymd, ingest_batch_id, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        rows,
    )
    con.commit()


def main():
    period = sys.argv[1] if len(sys.argv) > 1 else "1y"
    con = sqlite3.connect(str(DB_PATH))

    universe = load_universe(con)
    meta_by_yf = {u["yf"]: u for u in universe}
    symbols = list(meta_by_yf.keys())
    log.info("universe: %d symbols, period=%s", len(symbols), period)

    chunks = [symbols[i:i + CHUNK_SIZE] for i in range(0, len(symbols), CHUNK_SIZE)]
    batch_id = "backfill_" + datetime.utcnow().strftime("%Y%m%d%H%M%S")

    total_rows = 0
    with cf.ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futures = [ex.submit(download_chunk, c, period) for c in chunks]
        for i, fut in enumerate(cf.as_completed(futures), 1):
            syms, data = fut.result()
            rows = extract_rows(meta_by_yf, syms, data, batch_id)
            if rows:
                upsert_rows(con, rows)
                total_rows += len(rows)
            log.info("chunk %d/%d done — +%d rows (total %d)", i, len(chunks), len(rows), total_rows)

    # 요약
    cur = con.cursor()
    ndates = cur.execute("SELECT COUNT(DISTINCT base_ymd) FROM mbs_in_stk_stbd").fetchone()[0]
    nsyms = cur.execute("SELECT COUNT(DISTINCT stk_cd) FROM mbs_in_stk_stbd").fetchone()[0]
    latest = cur.execute("SELECT MAX(base_ymd) FROM mbs_in_stk_stbd").fetchone()[0]
    con.close()
    log.info("DONE — %d rows upserted | %d symbols × %d dates | latest=%s",
             total_rows, nsyms, ndates, latest)


if __name__ == "__main__":
    main()
