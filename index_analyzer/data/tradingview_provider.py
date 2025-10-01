import os
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

log = logging.getLogger("multiseed-extractor")

try:
    from tvDatafeed import TvDatafeed, Interval  # type: ignore
except Exception:
    TvDatafeed = None
    Interval = None


class TradingViewProvider:
    def __init__(self) -> None:
        self.enabled = False
        self.client = None
        if TvDatafeed and Interval:
            user = os.environ.get("TV_USERNAME")
            pw = os.environ.get("TV_PASSWORD")
            if user and pw:
                try:
                    self.client = TvDatafeed(username=user, password=pw)
                    self.enabled = True
                except Exception:
                    self.client = None
                    self.enabled = False

    def fetch(self, symbol: str, exchange: Optional[str], start: datetime, end: datetime, interval: str = "1D") -> Optional[List[Dict[str, Any]]]:
        if not self.enabled or self.client is None:
            log.info("TradingView provider not enabled; skipping %s", symbol)
            return None
        try:
            iv = {
                "1D": Interval.in_1_day,
                "4H": Interval.in_4_hour,
                "1H": Interval.in_1_hour,
            }.get(interval.upper(), Interval.in_1_day)
            df = self.client.get_hist(symbol=symbol, exchange=exchange or "", interval=iv, n_bars=1000)
            if df is None or df.empty:
                return []
            out: List[Dict[str, Any]] = []
            for _, row in df.reset_index().iterrows():
                ts = row["datetime"]
                if ts < start or ts > end:
                    continue
                out.append({
                    "t": ts.isoformat(),
                    "o": float(row.get("open", 0)),
                    "h": float(row.get("high", 0)),
                    "l": float(row.get("low", 0)),
                    "c": float(row.get("close", 0)),
                    "v": float(row.get("volume", 0)),
                })
            return out
        except Exception as e:
            log.info("TradingView fetch failed for %s: %s", symbol, e)
            return None