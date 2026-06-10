/**
 * useQuoteSocket — WebSocket 기반 실시간 주가 구독 훅.
 *
 * 사용법:
 *   const { quotes, subscribe, unsubscribe, connected } = useQuoteSocket();
 *   // 컴포넌트 마운트 시 subscribe(['AAPL', 'TSLA'])
 *   // quotes['AAPL'] → { price, change, change_percent, volume, ... }
 */
import { useEffect, useRef, useState, useCallback } from 'react';

const WS_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000')
  .replace(/^http/, 'ws');
const WS_URL = `${WS_BASE}/ws/quotes`;

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT = 10;

export default function useQuoteSocket() {
  const [quotes, setQuotes] = useState({});       // { symbol: quoteObj }
  const [connected, setConnected] = useState(false);

  const wsRef        = useRef(null);
  const symbolsRef   = useRef(new Set());          // 현재 구독 심볼 집합
  const reconnectRef = useRef(0);
  const mountedRef   = useRef(true);
  const timerRef     = useRef(null);

  const _send = useCallback((payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;

    const token = localStorage.getItem('access_token') || '';
    const url = token ? `${WS_URL}?token=${encodeURIComponent(token)}` : WS_URL;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectRef.current = 0;
      setConnected(true);
      // 재연결 시 기존 심볼 재구독
      const syms = [...symbolsRef.current];
      if (syms.length) _send({ action: 'subscribe', symbols: syms });
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'quote' && msg.data) {
          setQuotes(prev => ({ ...prev, ...msg.data }));
        }
      } catch { /* ignore malformed */ }
    };

    ws.onclose = () => {
      setConnected(false);
      if (!mountedRef.current) return;
      if (reconnectRef.current < MAX_RECONNECT) {
        reconnectRef.current += 1;
        timerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
      }
    };

    ws.onerror = () => ws.close();
  }, [_send]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const subscribe = useCallback((symbols) => {
    const newSyms = symbols.filter(s => !symbolsRef.current.has(s));
    if (!newSyms.length) return;
    newSyms.forEach(s => symbolsRef.current.add(s));
    _send({ action: 'subscribe', symbols: newSyms });
  }, [_send]);

  const unsubscribe = useCallback((symbols) => {
    symbols.forEach(s => symbolsRef.current.delete(s));
    _send({ action: 'unsubscribe', symbols });
  }, [_send]);

  return { quotes, connected, subscribe, unsubscribe };
}
