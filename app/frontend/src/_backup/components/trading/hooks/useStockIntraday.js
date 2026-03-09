/**
 * useStockIntraday
 * Polls /api/stock/history/{symbol}?period=1d&interval=1m every 60s.
 * Computes approximate CVD and per-bar volume delta from OHLCV data.
 *
 * CVD approximation: body-weighted delta = volume * (close - open) / (high - low + ε)
 * When range = 0: sign of (close - open) * volume
 */
import { useState, useEffect, useRef } from 'react';

const POLL_MS = 60_000;

function computeCvd(bars) {
  let running = 0;
  return bars.map(bar => {
    const range = bar.high - bar.low;
    const delta = range > 0
      ? bar.volume * (bar.close - bar.open) / range
      : (bar.close >= bar.open ? bar.volume : -bar.volume);
    running += delta;
    return { time: new Date(bar.date).getTime(), cvd: +running.toFixed(2) };
  });
}

export default function useStockIntraday(symbol) {
  const [bars,      setBars]      = useState([]);
  const [cvdPoints, setCvdPoints] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!symbol) return;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/stock/history/${encodeURIComponent(symbol)}?period=1d&interval=1m`
        );
        if (!res.ok) return;
        const json = await res.json();
        const raw  = json.data || [];
        setBars(raw);
        setCvdPoints(computeCvd(raw));
      } catch (e) {
        console.error('[useStockIntraday]', e);
      } finally {
        setLoading(false);
      }
    };

    load();
    timerRef.current = setInterval(load, POLL_MS);
    return () => clearInterval(timerRef.current);
  }, [symbol]);

  return { bars, cvdPoints, loading };
}
