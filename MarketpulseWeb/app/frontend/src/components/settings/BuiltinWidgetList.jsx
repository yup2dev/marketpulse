/**
 * BuiltinWidgetList — 기본 제공 위젯 목록의 내 설정.
 *
 * 위젯 정의는 코드(urlWidgetMap)에 있고, 여기서는 사용자별로
 *   - 사용 여부: 끄면 위젯 메뉴에 나오지 않는다
 *   - 내놓을 화면: 고르면 그 화면의 위젯 메뉴에만 나온다 (기본은 코드가 정한 배치)
 * 만 정한다. 기본값과 다른 것만 서버에 행으로 저장된다.
 * 이미 그리드에 올려 둔 위젯은 바뀌지 않는다 — 메뉴에 무엇을 내놓을지의 설정이다.
 */
import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { INPUT_CLS } from '../widgets/ui';
import { ALL_SCREENS, builtinWidgetCatalog, screenLabels } from '../../registry/userWidgets';
import useUserWidgetStore from '../../store/userWidgetStore';
import { ScreenChips, UseToggle } from './parts';

const TH = 'text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 px-3 py-2';

export default function BuiltinWidgetList() {
  const prefs = useUserWidgetStore((s) => s.prefs);
  const setPref = useUserWidgetStore((s) => s.setPref);
  const catalog = useMemo(() => builtinWidgetCatalog(), []);

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
      toast.error(e?.detail || e?.message || '변경 실패');
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
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className={TH}>이름</th>
              <th className={`${TH} w-[22%]`}>기본 배치</th>
              <th className={`${TH} w-[26%]`}>내놓을 화면</th>
              <th className={`${TH} w-16`}>사용</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-xs text-gray-500">조건에 맞는 위젯이 없습니다</td></tr>
            )}
            {rows.map((w) => {
              const pref = prefs[w.id];
              const used = pref?.use_yn !== 'N';
              const screens = pref?.screens?.length ? pref.screens : [ALL_SCREENS];
              const expanded = open === w.id;
              return (
                <Fragment key={w.id}>
                  <tr className={`border-b border-gray-800/60 ${used ? '' : 'opacity-50'}`}>
                    <td className="px-3 py-2">
                      <div className="text-sm text-gray-100">{w.name}</div>
                      {w.description && <div className="text-[11px] text-gray-500">{w.description}</div>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{w.pages.map((p) => p.label).join(', ')}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button" onClick={() => setOpen(expanded ? null : w.id)} aria-expanded={expanded}
                        className={`flex items-center gap-1 text-xs transition-colors hover:text-cyan-300 ${pref?.screens?.length ? 'text-cyan-400' : 'text-gray-400'}`}
                      >
                        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        {screenLabels(pref?.screens, '기본 배치')}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <UseToggle on={used} label={`${w.name} 사용`} onChange={(on) => save(w.id, { use_yn: on ? 'Y' : 'N' })} />
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-gray-800/60">
                      <td colSpan={4} className="px-3 py-3">
                        <div className="flex items-start gap-3">
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
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
