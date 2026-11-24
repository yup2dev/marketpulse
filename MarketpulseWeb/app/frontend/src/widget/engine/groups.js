/**
 * 화면 단위 파라미터 그룹 값 (OpenBB apps.json 의 groups) — 서버 user_screen_groups 가 정의한다.
 *
 * 한 화면(+탭)에서 같은 그룹에 묶인 위젯들은 값 하나를 같이 따른다. 위젯마다 파라미터 이름이 달라도 된다.
 * 값은 그룹마다 localStorage `mp.group.{screen}.{tab}.{group_code}` 에 둔다 — 화면별로 나뉘어
 * 한 화면에서 고른 값이 다른 화면으로 새지 않는다 (전역 화면 변수 shared.js 와 다른 점).
 *
 *   binding = { group_code, param_name, is_source, is_required, tab }   — 위젯 하나가 그룹에 묶인 방식
 *   is_required 면 값이 생길 때까지 그 위젯은 요청하지 않는다 (빈 값이면 오류인 파라미터)
 */
import { useMemo, useSyncExternalStore } from 'react';

const PREFIX = 'mp.group.';
const listeners = new Set();
const cache = new Map();   // key → 값 (localStorage 를 매번 읽지 않게)

export const groupKey = (screen, tab, code) => `${PREFIX}${screen || ''}.${tab || ''}.${code}`;

function read(key) {
  if (!cache.has(key)) {
    let v = null;
    try { v = localStorage.getItem(key); } catch { /* 저장소 없음 */ }
    cache.set(key, v);
  }
  return cache.get(key);
}

export function setGroupValue(screen, tab, code, value) {
  const key = groupKey(screen, tab, code);
  const v = value == null || value === '' ? null : String(value);
  if (read(key) === v) return;
  cache.set(key, v);
  try {
    if (v == null) localStorage.removeItem(key);
    else localStorage.setItem(key, v);
  } catch { /* 저장 불가 — 화면 동작에는 영향 없음 */ }
  version += 1;
  listeners.forEach((fn) => fn());
}

let version = 0;
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const snapshot = () => version;

/** { param_name: 값 } — 이 위젯이 묶인 그룹들의 현재 값. 값이 바뀌면 다시 그린다 */
export function useGroupValues(screen, bindings) {
  const v = useSyncExternalStore(subscribe, snapshot);
  const sig = (bindings || []).map((b) => `${b.tab}|${b.group_code}|${b.param_name}`).join(',');
  // 같은 값이면 같은 객체 — DataWidget 의 params useMemo 가 렌더마다 다시 돌지 않게
  return useMemo(() => {
    const out = {};
    for (const b of bindings || []) {
      const value = read(groupKey(screen, b.tab, b.group_code));
      if (value != null) out[b.param_name] = value;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, screen, sig]);
}
