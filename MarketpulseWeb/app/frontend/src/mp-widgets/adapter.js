/**
 * adapter — mp-widgets 가 앱에 기대는 것 전부. 라이브러리의 다른 파일은 앱 코드를 직접 import 하지 않고
 * 여기서만 가져온다 (요청·실시간 시세·테마·위젯 껍데기·상태 화면·기억하는 값·종목 검색·라우팅).
 * 라이브러리를 다른 앱으로 옮길 때는 이 파일만 바꾼다.
 */
import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient, API_BASE } from '../config/api';
import useQuoteSocket from '../hooks/useQuoteSocket';
import useThemeStore from '../store/themeStore';
import WidgetCard, { HeaderSeg } from '../components/widgets/common/WidgetCard';
import {
  WidgetState, useWidgetState, useWidgetSymbol, usePopover, stateFromError, PANEL_CLS,
} from '../components/widgets/ui';
import SymbolAutocomplete from '../components/common/SymbolAutocomplete';

/** '/stock/ranking/live?…' → 응답(JSON). 경로는 /api 뒤부터 */
export const request = (path) => apiClient.get(`${API_BASE}${path}`);

/** 종목을 눌렀을 때 갈 주소 */
export const hrefFor = (symbol) => `/stock?symbol=${encodeURIComponent(symbol)}`;

export const useTheme = () => useThemeStore((s) => s.theme);

/**
 * 실시간 시세 — 심볼 목록을 구독하고 { [SYMBOL]: { price, change_percent, volume … } } 를 돌려준다.
 * 목록이 바뀌면 빠진 심볼만 해제하고 새 심볼만 구독한다.
 */
export function useQuotes(symbols) {
  const { quotes, subscribe, unsubscribe } = useQuoteSocket();
  const current = useRef([]);
  const key = symbols.join(',');

  useEffect(() => {
    const next = key ? key.split(',') : [];
    const prev = current.current;
    const drop = prev.filter((s) => !next.includes(s));
    const add = next.filter((s) => !prev.includes(s));
    if (drop.length) unsubscribe(drop);
    if (add.length) subscribe(add);
    current.current = next;
  }, [key, subscribe, unsubscribe]);

  useEffect(() => () => {
    if (current.current.length) unsubscribe(current.current);
  }, [unsubscribe]);

  return quotes;
}

export {
  Link, useNavigate,
  WidgetCard as Card, HeaderSeg,
  WidgetState as StateView, stateFromError as toState,
  useWidgetState as useStored, useWidgetSymbol as useSymbol,
  usePopover, PANEL_CLS,
  SymbolAutocomplete as SymbolSearch,
};
