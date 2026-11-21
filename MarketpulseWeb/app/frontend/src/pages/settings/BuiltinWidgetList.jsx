/**
 * BuiltinWidgetList — 기본 제공 위젯 목록의 내 설정.
 *
 * 위젯 정의는 코드(urlWidgetMap) 또는 DB(홈 위젯 등 기본 제공 위젯)에 있고, 여기서는 사용자별로
 *   - 사용 여부: 끄면 위젯 메뉴에 나오지 않는다
 *   - 내놓을 화면: 고르면 그 화면의 위젯 메뉴에만 나온다 (기본은 코드가 정한 배치)
 * 만 정한다. 기본값과 다른 것만 서버에 행으로 저장된다.
 * 이미 그리드에 올려 둔 위젯은 바뀌지 않는다 — 메뉴에 무엇을 내놓을지의 설정이다.
 */
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw, Search } from 'lucide-react';
import { notify } from '../../common';
import { INPUT_CLS } from '../../common/widget';
import { ALL_SCREENS, builtinWidgetCatalog, screenLabels } from '../../widget/registry/userWidgets';
import useUserWidgetStore from '../../store/userWidgetStore';
import { ScreenChips, UseToggle } from './parts';
import { MpGrid } from '../../widget/engine';


export default function BuiltinWidgetList() {
  const prefs = useUserWidgetStore((s) => s.prefs);
  const setPref = useUserWidgetStore((s) => s.setPref);
  const builtin = useUserWidgetStore((s) => s.builtin);
  const catalog = useMemo(() => builtinWidgetCatalog(builtin), [builtin]);

  const [query, setQuery] = useState('');
  const [changedOnly, setChangedOnly] = useState(false);
  const [open, setOpen] = useState(null);   // 화면 고르기를 펼친 위젯 id

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((w) =>
      (!changedOnly || prefs[w.id])
      && (!q || w.name.toLowerCase().includes(q) || w.id.includes(q) || w.description?.toLowerCase().includes(q)));
  }, [catalog, query, changedOnly, prefs]);

  const changedCount = Object.keys(prefs).filter((id) => catalog.some((w) => w.id === id)).length;

  const save = async (id, data) => {
    try {
      await setPref(id, data);
    } catch (e) {
      notify.fail(e, '변경 실패');
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text" className={`${INPUT_CLS} pl-7`} placeholder="위젯 이름 검색"
            value={query} onChange={(e) => setQuery(e.target.value)} aria-label="위젯 이름 검색"
          />
        </div>
        <button
          type="button" aria-pressed={changedOnly} onClick={() => setChangedOnly((v) => !v)}
          className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
            changedOnly ? 'border-cyan-500 bg-cyan-600/20 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'
          }`}
        >
          바꾼 것만 {changedCount > 0 && `(${changedCount})`}
        </button>
        <span className="text-[11px] ml-auto" style={{ color: 'var(--color-text-muted)' }}>
          {rows.length} / {catalog.length}개
        </span>
      </div>

      <div className="rounded-lg border border-gray-800" style={{ backgroundColor: 'var(--color-bg-widget)' }}>
        <MpGrid
          rows={rows}
          options={{
            rowKey: 'id', minWidth: 0, rowHeight: 0, scroll: false, empty: '조건에 맞는 위젯이 없습니다',
            rowClassName: (w) => (prefs[w.id]?.use_yn !== 'N' ? '' : 'opacity-50'),
            expanded: (w) => open === w.id,
            expand: (w) => {
              const pref = prefs[w.id];
              const screens = pref?.screens?.length ? pref.screens : [ALL_SCREENS];
              return (
                <div className="flex items-start gap-3 px-4 py-3">
                  <div className="flex-1">
                    <ScreenChips
                      screens={screens}
                      allLabel="기본 배치"
                      onChange={(next) => save(w.id, { screens: next.length ? next : [ALL_SCREENS] })}
                    />
                    <p className="text-[10px] mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
                      화면을 고르면 그 화면의 위젯 메뉴에만 나옵니다. 기본 배치는 모든 화면의 메뉴에서 찾을 수 있습니다.
                    </p>
                  </div>
                  {pref && (
                    <button
                      type="button"
                      onClick={() => save(w.id, { use_yn: 'Y', screens: [ALL_SCREENS] })}
                      className="flex flex-shrink-0 items-center gap-1 text-[11px] text-gray-500 hover:text-cyan-300 transition-colors"
                    >
                      <RotateCcw size={11} /> 기본값으로
                    </button>
                  )}
                </div>
              );
            },
            columns: [
              { field: 'name', header: '이름', wrap: true, render: (w) => (
                <>
                  <div className="text-sm text-[var(--mp-text)]">{w.name}</div>
                  {w.description && <div className="text-[11px] text-[var(--mp-muted)]">{w.description}</div>}
                </>
              ) },
              { id: 'pages', header: '기본 배치', width: '22%', wrap: true, className: 'text-[var(--mp-muted)]', render: (w) => w.pages.map((pg) => pg.label).join(', ') },
              { id: 'screens', header: '내놓을 화면', width: '26%', render: (w) => {
                const pref = prefs[w.id];
                const expanded = open === w.id;
                return (
                  <button
                    type="button" onClick={() => setOpen(expanded ? null : w.id)} aria-expanded={expanded}
                    className={`flex items-center gap-1 text-xs transition-colors hover:text-cyan-300 ${pref?.screens?.length ? 'text-cyan-400' : 'text-gray-400'}`}
                  >
                    {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {screenLabels(pref?.screens, '기본 배치')}
                  </button>
                );
              } },
              { id: 'use', header: '사용', width: 64, render: (w) => (
                <UseToggle on={prefs[w.id]?.use_yn !== 'N'} label={`${w.name} 사용`} onChange={(on) => save(w.id, { use_yn: on ? 'Y' : 'N' })} />
              ) },
            ],
          }}
        />
      </div>
    </div>
  );
}
