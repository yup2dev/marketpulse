/**
 * useBinanceStreams
 * Connects to Binance Futures WebSocket streams and provides:
 *  - candles        : closed 1m OHLCV bars (historical + completed WS bars)
 *  - liveCandle     : current open 1m bar
 *  - cvdPoints      : [{time, cvd}] per-minute CVD accumulation
 *  - bids / asks    : top-20 orderbook levels [[price, qty]]
 *  - trades         : latest aggTrades (newest first)
 *  - liquidations   : latest forceOrder events (newest first)
 *  - connected      : boolean WebSocket status
 *  - lastPrice      : latest trade price
 */
import { useState, useEffect, useRef } from 'react';

const REST = 'https://fapi.binance.com/fapi/v1';
const WS   = 'wss://fstream.binance.com/stream';

const MAX_CANDLES = 200;
const MAX_TRADES  = 150;
const MAX_LIQS    = 100;

export default function useBinanceStreams(symbol = 'BTCUSDT') {
  const sym    = symbol.toUpperCase();
  const symLow = symbol.toLowerCase();

  const [candles,      setCandles]      = useState([]);
  const [liveCandle,   setLiveCandle]   = useState(null);
  const [cvdPoints,    setCvdPoints]    = useState([]);
  const [bids,         setBids]         = useState([]);
  const [asks,         setAsks]         = useState([]);
  const [trades,       setTrades]       = useState([]);
  const [liquidations, setLiquidations] = useState([]);
  const [connected,    setConnected]    = useState(false);
  const [lastPrice,    setLastPrice]    = useState(null);

  // Mutable refs for CVD tracking (avoid stale closures)
  const cvdRunning     = useRef(0);
  const minuteCvdDelta = useRef(0);
  const currentMinute  = useRef(null);
  const wsRef          = useRef(null);

  // ── Initial klines fetch ──────────────────────────────────────────────────
  useEffect(() => {
    // Reset all state when symbol changes
    setCandles([]);
    setLiveCandle(null);
    setCvdPoints([]);
    setBids([]);
    setAsks([]);
    setTrades([]);
    setLiquidations([]);
    setLastPrice(null);
    cvdRunning.current    = 0;
    minuteCvdDelta.current = 0;
    currentMinute.current  = null;

    const ac = new AbortController();

    (async () => {
      try {
        const res  = await fetch(
          `${REST}/klines?symbol=${sym}&interval=1m&limit=200`,
          { signal: ac.signal },
        );
        const raw  = await res.json();
        if (!Array.isArray(raw)) return;

        const klines = raw.map(k => ({
          time:   k[0],
          open:   +k[1],
          high:   +k[2],
          low:    +k[3],
          close:  +k[4],
          volume: +k[5],
          buyVol: +k[9],   // taker buy base asset volume
        }));

        const closed = klines.slice(0, -1);
        const live   = klines[klines.length - 1];

        setCandles(closed);
        setLiveCandle(live);
        setLastPrice(live.close);

        // Build historical CVD from taker buy volume
        let running = 0;
        const cvd = closed.map(k => {
          const delta = 2 * k.buyVol - k.volume;
          running += delta;
          return { time: k.time, cvd: +running.toFixed(2) };
        });
        setCvdPoints(cvd);
        cvdRunning.current = running;
      } catch (e) {
        if (e.name !== 'AbortError') console.error('[BinanceStreams] klines fetch error:', e);
      }
    })();

    return () => ac.abort();
  }, [sym]);

  // ── WebSocket ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const streams = [
      `${symLow}@kline_1m`,
      `${symLow}@aggTrade`,
      `${symLow}@depth20@100ms`,
      `${symLow}@forceOrder`,
    ].join('/');

    const ws = new WebSocket(`${WS}?streams=${streams}`);
    wsRef.current = ws;

    ws.onopen  = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => ws.close();

    ws.onmessage = (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }

      const { stream, data } = msg;
      if (!stream || !data) return;

      // ── Kline ──────────────────────────────────────────────────────────
      if (stream.includes('@kline')) {
        const k = data.k;
        const candle = {
          time:   k.t,
          open:   +k.o,
          high:   +k.h,
          low:    +k.l,
          close:  +k.c,
          volume: +k.v,
        };
        setLastPrice(+k.c);
        if (k.x) {
          // Bar closed – move to history, reset live
          setCandles(prev => [...prev.slice(-(MAX_CANDLES - 1)), candle]);
          setLiveCandle(null);
        } else {
          setLiveCandle(candle);
        }
      }

      // ── Aggregated trades ──────────────────────────────────────────────
      else if (stream.includes('@aggTrade')) {
        const price = +data.p;
        const qty   = +data.q;
        // m=true → buyer is market maker → taker sold → SELL
        const isBuy = !data.m;
        const ts    = data.T;

        // CVD: bucket by minute
        const minute = Math.floor(ts / 60000) * 60000;
        if (currentMinute.current === null) {
          currentMinute.current = minute;
        }
        if (minute > currentMinute.current) {
          // Commit previous minute
          cvdRunning.current += minuteCvdDelta.current;
          const snapshot = cvdRunning.current;
          const prevMin  = currentMinute.current;
          setCvdPoints(prev => [
            ...prev.slice(-(MAX_CANDLES - 1)),
            { time: prevMin, cvd: +snapshot.toFixed(2) },
          ]);
          minuteCvdDelta.current = isBuy ? qty : -qty;
          currentMinute.current  = minute;
        } else {
          minuteCvdDelta.current += isBuy ? qty : -qty;
        }

        // Live trades list
        const trade = { id: data.a, time: ts, price, qty, total: price * qty, isBuy };
        setTrades(prev => [trade, ...prev.slice(0, MAX_TRADES - 1)]);
        setLastPrice(price);
      }

      // ── Orderbook depth ────────────────────────────────────────────────
      else if (stream.includes('@depth')) {
        setBids(data.b.map(([p, q]) => [+p, +q]).filter(([, q]) => q > 0));
        setAsks(data.a.map(([p, q]) => [+p, +q]).filter(([, q]) => q > 0));
      }

      // ── Force orders (liquidations) ────────────────────────────────────
      else if (stream.includes('@forceOrder')) {
        const o = data.o;
        const liq = {
          id:     Date.now() + Math.random(),
          time:   o.T,
          side:   o.S,
          price:  +o.p,
          qty:    +o.q,
          total:  +o.p * +o.q,
          symbol: o.s,
        };
        setLiquidations(prev => [liq, ...prev.slice(0, MAX_LIQS - 1)]);
      }
    };

    return () => {
      ws.onmessage = null;
      ws.close();
    };
  }, [symLow]);

  return {
    candles, liveCandle, cvdPoints,
    bids, asks,
    trades, liquidations,
    connected, lastPrice,
  };
}
