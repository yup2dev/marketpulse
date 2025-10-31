import math
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

log = logging.getLogger("multiseed-extractor")

try:
    import yfinance as yf
except Exception:
    yf = None
    log.info("yahoo finance is not installed")


class YahooProvider:
    def fetch(self, ticker: str, start: datetime, end: datetime, interval: str = "1d") -> Optional[List[Dict[str, Any]]]:
        if yf is None:
            log.info("yfinance not available; skipping %s", ticker)
            return None
        try:
            df = yf.download(ticker, start=start.date(), end=end.date() + timedelta(days=1), interval=interval, progress=False)
            if df is None or df.empty:
                return []
            out: List[Dict[str, Any]] = []
            df_reset = df.reset_index()
            for idx, row in df_reset.iterrows():
                ts = row["Date"]
                # .iloc[0]로 스칼라 추출 (FutureWarning 해결)
                open_val = row["Open"].iloc[0] if hasattr(row["Open"], 'iloc') else row["Open"]
                high_val = row["High"].iloc[0] if hasattr(row["High"], 'iloc') else row["High"]
                low_val = row["Low"].iloc[0] if hasattr(row["Low"], 'iloc') else row["Low"]
                close_val = row["Close"].iloc[0] if hasattr(row["Close"], 'iloc') else row["Close"]
                vol_val = row["Volume"].iloc[0] if hasattr(row["Volume"], 'iloc') else row["Volume"]

                out.append({
                    "t": (ts.isoformat() if hasattr(ts, "isoformat") else str(ts)),
                    "o": float(open_val) if not math.isnan(open_val) else math.nan,
                    "h": float(high_val) if not math.isnan(high_val) else math.nan,
                    "l": float(low_val) if not math.isnan(low_val) else math.nan,
                    "c": float(close_val) if not math.isnan(close_val) else math.nan,
                    "v": float(vol_val) if not math.isnan(vol_val) else math.nan,
                })
            return out
        except Exception as e:
            log.info("yfinance fetch failed for %s: %s", ticker, e)
            return None