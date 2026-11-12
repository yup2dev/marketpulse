/**
 * userWidgetStore — 위젯 정의·설정 (서버 DB: /api/user-widgets).
 *
 *   builtin  기본 제공 위젯의 정의 목록 (모든 사용자 공통 — 홈 위젯 등). 그리는 법은 registry/builtinWidgets
 *   widgets  내가 만든 위젯 정의 목록
 *   prefs    기본 제공 위젯의 내 설정 { [위젯 id]: { use_yn, screens } } — 기본값과 다른 것만 들어 있다
 *
 * 세 곳이 같이 본다: 설정 화면(만들기·고치기), 위젯 메뉴, 그리드의 user/{id} 위젯.
 * 설정에서 저장하면 여기가 바뀌고, 열려 있는 위젯·메뉴가 그대로 따라온다.
 */
import { create } from 'zustand';
import { userWidgetsAPI } from '../config/api';
import { builtinWidgetSizes } from '../registry/builtinWidgets';
import { registerWidgetSizes } from '../registry/widgetSizes';

let _loading = null;

const useUserWidgetStore = create((set, get) => ({
  builtin: [],
  widgets: [],
  prefs: {},
  loaded: false,

  /** 처음 한 번만 불러온다 (force 면 다시). 실패하면 빈 목록으로 두고 다음 호출에서 재시도. */
  load: (force = false) => {
    if (get().loaded && !force) return Promise.resolve(get().widgets);
    if (!_loading) {
      _loading = Promise.all([
        userWidgetsAPI.list(),
        userWidgetsAPI.prefs().catch(() => null),
        userWidgetsAPI.builtin().catch(() => null),
      ])
        .then(([res, prefRes, builtinRes]) => {
          const widgets = res?.widgets || [];
          const prefs = Object.fromEntries((prefRes?.prefs || []).map((p) => [p.widget_type, p]));
          const builtin = builtinRes?.widgets || [];
          registerWidgetSizes(builtinWidgetSizes(builtin));   // 그리드가 크기를 여기서 찾는다
          set({ builtin, widgets, prefs, loaded: true });
          return widgets;
        })
        .catch(() => {
          set({ loaded: true });
          return get().widgets;
        })
        .finally(() => { _loading = null; });
    }
    return _loading;
  },

  create: async (data) => {
    const w = await userWidgetsAPI.create(data);
    set((s) => ({ widgets: [...s.widgets, w] }));
    return w;
  },

  update: async (id, data) => {
    const w = await userWidgetsAPI.update(id, data);
    set((s) => ({ widgets: s.widgets.map((x) => (x.widget_id === id ? w : x)) }));
    return w;
  },

  /** 기본 제공 위젯 설정 변경. 기본값(사용함·화면 제한 없음)이 되면 목록에서 뺀다. */
  setPref: async (type, data) => {
    const p = await userWidgetsAPI.setPref(type, data);
    set((s) => {
      const prefs = { ...s.prefs };
      if (p.use_yn === 'Y' && !p.screens?.length) delete prefs[type];
      else prefs[type] = p;
      return { prefs };
    });
    return p;
  },

  remove: async (id) => {
    await userWidgetsAPI.delete(id);
    set((s) => ({ widgets: s.widgets.filter((x) => x.widget_id !== id) }));
  },
}));

export default useUserWidgetStore;
