/**
 * backtestStore — Backtest Lab 탭의 위젯들이 공유하는 상태.
 *
 * - items: 서버에 저장된 사용자 정의(variable / event / strategy) 캐시
 * - range: 탭 공통 분석 기간
 * - explorer / study / lastRun: 같은 탭의 위젯끼리 주고받는 선택·결과
 *   (예: 변수 목록에서 '탐색' → Variable Explorer 에 추가, 전략 실행 → 결과 위젯에 표시)
 */
import { create } from 'zustand';
import { backtestAPI } from '../config/api';
import { presetRange } from '../components/backtest/engine/data';

const EMPTY = { variable: [], event: [], strategy: [] };

const useBacktestStore = create((set, get) => ({
  items: EMPTY,
  loaded: false,
  loading: false,
  error: null,

  load: async (force = false) => {
    if (get().loading || (get().loaded && !force)) return;
    set({ loading: true, error: null });
    try {
      const res = await backtestAPI.listItems();
      const grouped = { variable: [], event: [], strategy: [] };
      for (const item of res.data || []) grouped[item.kind]?.push(item);
      set({ items: grouped, loaded: true, loading: false });
    } catch (e) {
      set({ loading: false, error: e.detail || e.message || '불러오기 실패' });
    }
  },

  /** 생성(item_id 없음) 또는 수정. 성공 시 저장된 항목 반환, 실패 시 throw. */
  saveItem: async (kind, { item_id: itemId, name, description, spec }) => {
    const res = itemId
      ? await backtestAPI.updateItem(itemId, { name, description, spec })
      : await backtestAPI.createItem({ kind, name, description, spec });
    const saved = res.data;
    set((s) => {
      const list = s.items[kind].filter((i) => i.item_id !== saved.item_id);
      return { items: { ...s.items, [kind]: [...list, saved].sort((a, b) => a.name.localeCompare(b.name)) } };
    });
    return saved;
  },

  deleteItem: async (item) => {
    await backtestAPI.deleteItem(item.item_id);
    set((s) => ({ items: { ...s.items, [item.kind]: s.items[item.kind].filter((i) => i.item_id !== item.item_id) } }));
  },

  range: presetRange('1Y'),
  setRange: (range) => set({ range }),

  explorer: { names: [] },
  toggleExplorer: (name) => set((s) => {
    const names = s.explorer.names.includes(name)
      ? s.explorer.names.filter((n) => n !== name)
      : [...s.explorer.names, name].slice(-8);
    return { explorer: { names } };
  }),

  study: { event: '', target: '', windows: '-5, 1, 5, 20, 60', mode: 'pct' },
  setStudy: (patch) => set((s) => ({ study: { ...s.study, ...patch } })),

  lastRun: null,     // { name, strategyId, config, result:{equity,trades,metrics}, savedRunId }
  setLastRun: (lastRun) => set({ lastRun }),
  runsVersion: 0,
  bumpRuns: () => set((s) => ({ runsVersion: s.runsVersion + 1 })),
}));

export default useBacktestStore;
