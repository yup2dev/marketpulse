/**
 * 위젯 안에서 사용자가 고른 값(티커·기간·provider·파라미터·보기)을 위젯 인스턴스별로 기억한다.
 *
 * 위젯은 탭·화면을 옮기면 unmount 됐다가 돌아올 때 다시 mount 된다. 그냥 useState 로 들고 있으면
 * 그때 기본값(페이지 티커·AAPL)으로 되돌아간다 — 그래서 그리드 위젯은 이 훅으로 상태를 둔다.
 *
 * DashboardGrid 가 위젯마다 WidgetInstanceContext 로 `${screen}:${widget.id}` 를 내려준다.
 * 그리드 밖(컨텍스트 없음)에서는 일반 useState 와 같다.
 */
import { createContext, useCallback, useContext, useState } from 'react';

export const WidgetInstanceContext = createContext(null);

const storageKey = (id) => `widget-state:${id}`;

function readState(id) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(id))) || {};
  } catch {
    return {};
  }
}

function writeState(id, patch) {
  try {
    localStorage.setItem(storageKey(id), JSON.stringify({ ...readState(id), ...patch }));
  } catch { /* 저장 불가(사생활 보호 모드 등) — 화면 동작에는 영향 없음 */ }
}

/** 위젯을 지울 때 기억한 값도 지운다 */
export function clearWidgetState(id) {
  try {
    localStorage.removeItem(storageKey(id));
    localStorage.removeItem(`chart-widget-${id}`);   // ChartWidget 자체 저장분
  } catch { /* noop */ }
}

/** useState 와 같지만, 그리드 위젯 안에서는 다시 mount 돼도 마지막 값을 되살린다 */
export function useWidgetState(name, initial) {
  const id = useContext(WidgetInstanceContext);
  const [value, setValue] = useState(() => {
    if (id) {
      const saved = readState(id);
      if (Object.prototype.hasOwnProperty.call(saved, name)) return saved[name];
    }
    return typeof initial === 'function' ? initial() : initial;
  });
  const set = useCallback((v) => {
    setValue((prev) => {
      const next = typeof v === 'function' ? v(prev) : v;
      if (id) writeState(id, { [name]: next });
      return next;
    });
  }, [id, name]);
  return [value, set];
}

/**
 * 위젯 자체 티커. 페이지 티커(symbolProp)를 따르되 위젯에서 바꾼 티커는 다시 mount 돼도 유지한다.
 * 고를 때의 페이지 티커를 같이 기억해서, 그 뒤 페이지 티커가 바뀌었으면 페이지 티커를 따른다.
 */
export function useWidgetSymbol(symbolProp, fallback = 'AAPL') {
  const [saved, setSaved] = useWidgetState('symbol', null);
  const page = symbolProp || null;
  const value = saved && saved.page === page ? saved.value : (page || fallback);
  const setSymbol = useCallback((v) => setSaved({ value: v, page }), [page, setSaved]);
  return [value, setSymbol];
}
