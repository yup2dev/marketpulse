/**
 * 화면 변수 — 여러 위젯이 같이 따르는 값 (고른 기관 · 고른 백테스트 실행처럼 종목이 아닌 것).
 *
 * 스펙의 `shared: ['institution']` 에 이름을 적으면 그 이름의 컨트롤 값이 위젯마다 따로가 아니라
 * 여기 한 곳에 놓인다 — 한 위젯에서 바꾸면(머리줄 선택 · 표의 행 클릭) 같은 이름을 쓰는 위젯이 모두 따라온다.
 * 값은 localStorage 에 남아 새로고침해도 유지된다.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'mp-shared';
const listeners = new Set();

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

let state = load();

export function setShared(name, value) {
  if (state[name] === value) return;
  state = { ...state, [name]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* 저장 불가 — 화면 동작에는 영향 없음 */ }
  listeners.forEach((fn) => fn());
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const snapshot = () => state;

/** { 이름: 값 } — 값이 바뀌면 다시 그린다 */
export function useShared() {
  return useSyncExternalStore(subscribe, snapshot);
}
