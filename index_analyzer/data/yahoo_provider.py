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
            for _, row in df.reset_index().iterrows():
                ts = row["Date"]
                out.append({
                    "t": (ts.isoformat() if hasattr(ts, "isoformat") else str(ts)),
                    "o": float(row.get("Open", math.nan)),
                    "h": float(row.get("High", math.nan)),
                    "l": float(row.get("Low", math.nan)),
                    "c": float(row.get("Close", math.nan)),
                    "v": float(row.get("Volume", math.nan)),
                })
            return out
        except Exception as e:
            log.info("yfinance fetch failed for %s: %s", ticker, e)
            return None