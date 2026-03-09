/**
 * useStockOrderBook
 * Polls /api/stock/orderbook/{symbol} every 5 seconds.
 * Returns aggregated bid/ask price levels from Polygon NBBO quotes.
 */
import { useState, useEffect, useRef } from 'react';

const POLL_MS = 5_000;

export default function useStockOrderBook(symbol) {
  const [bids,    setBids]    = useState([]);
  const [asks,    setAsks]    = useState([]);
  const [source,  setSource]  = useState(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!symbol) {
      setBids([]); setAsks([]); setSource(null);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/stock/orderbook/${encodeURIComponent(symbol)}`);
        if (!res.ok) return;
        const json = await res.json();
        setBids(json.bids || []);
        setAsks(json.asks || []);
        setSource(json.source || null);
      } catch (e) {
        console.error('[useStockOrderBook]', e);
      } finally {
        setLoading(false);
      }
    };

    load();
    timerRef.current = setInterval(load, POLL_MS);
    return () => clearInterval(timerRef.current);
  }, [symbol]);

  return { bids, asks, source, loading };
}
