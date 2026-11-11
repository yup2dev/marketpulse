/**
 * WidgetSettings — 위젯 설정 (/settings?tab=widgets). 세 목록을 관리한다.
 *
 *   내가 만든 위젯   API → 매핑 → 위젯 순서로 만들어 화면에 내놓는다 (WidgetEditor)
 *   기본 위젯        코드에 있는 기본 제공 위젯의 사용 여부·내놓을 화면 (BuiltinWidgetList)
 *   위젯 종류        위젯을 만들 때 고르는 '보여 줄 위젯' 목록 — 관리자만 (WidgetTypeAdmin)
 *
 * 내놓은 위젯은 그 화면의 위젯 메뉴에 나오고, 거기서 그리드에 추가한다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import WidgetEditor from './WidgetEditor';
import BuiltinWidgetList from './BuiltinWidgetList';
import WidgetTypeAdmin from './WidgetTypeAdmin';
import { UseToggle } from './parts';
import { SegmentedControl } from '../widgets/ui';
import { userWidgetsAPI } from '../../config/api';
import { EMPTY_DRAFT, screenLabels } from '../../registry/userWidgets';
import useUserWidgetStore from '../../store/userWidgetStore';
import useAuthStore from '../../store/authStore';

const TH = 'text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 px-3 py-2';

const SECTION_HINT = {
  mine: 'API 를 고르고 → 응답 필드를 매핑하고 → 보여 줄 위젯을 정해 화면에 내놓습니다. 내놓은 화면의 위젯 메뉴 "My Widgets" 에서 그리드에 추가할 수 있습니다.',
  builtin: '기본 제공 위젯을 위젯 메뉴에 내놓을지, 어느 화면에 내놓을지 정합니다. 이미 그리드에 올려 둔 위젯은 바뀌지 않습니다.',
  types: '',
};

export default function WidgetSettings() {
  const widgets = useUserWidgetStore((s) => s.widgets);
  const loaded = useUserWidgetStore((s) => s.loaded);
  const load = useUserWidgetStore((s) => s.load);
  const update = useUserWidgetStore((s) => s.update);
  const remove = useUserWidgetStore((s) => s.remove);
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');

  const [meta, setMeta] = useState(null);       // { codes, variables }
  const [editing, setEditing] = useState(null); // 편집 중인 정의 (새 위젯이면 EMPTY_DRAFT)
  const [section, setSection] = useState('mine');

  const loadMeta = useCallback(
    () => userWidgetsAPI.codes().then(setMeta).catch(() => toast.error('설정 코드를 불러오지 못했습니다')),
    [],
  );
  useEffect(() => { load(true); }, [load]);
  useEffect(() => { loadMeta(); }, [loadMeta]);

  const viewName = useMemo(
    () => Object.fromEntries((meta?.codes?.VIEW_TYPE || []).map((c) => [c.value, c.name])),
    [meta],
  );

  const sections = useMemo(() => [
    { value: 'mine', label: `내가 만든 위젯${widgets.length ? ` ${widgets.length}` : ''}` },
    { value: 'builtin', label: '기본 위젯' },
    ...(isAdmin ? [{ value: 'types', label: '위젯 종류' }] : []),
  ], [widgets.length, isAdmin]);

  const toggleUse = async (w, on) => {
    try {
      await update(w.widget_id, { use_yn: on ? 'Y' : 'N' });
    } catch (e) {
      toast.error(e?.detail || e?.message || '변경 실패');
    }
  };

  const onDelete = async (w) => {
    if (!window.confirm(`'${w.name}' 위젯을 삭제하시겠습니까?\n화면에 올려 둔 위젯은 '정의를 찾을 수 없음' 으로 바뀝니다.`)) return;
    try {
      await remove(w.widget_id);
      toast.success('삭제됨');
    } catch (e) {
      toast.error(e?.detail || e?.message || '삭제 실패');
    }
  };

  if (editing && meta) {
    return (
      <WidgetEditor
        key={editing.widget_id || 'new'}
        initial={editing}
        codes={meta.codes}
        variables={meta.variables}
        onDone={() => setEditing(null)}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="text-cyan-400" size={20} />
          <h1 className="text-xl font-semibold text-white">위젯</h1>
        </div>
        {section === 'mine' && (
          <button
            type="button"
            onClick={() => setEditing(EMPTY_DRAFT)}
            disabled={!meta}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-40 transition-colors"
          >
            <Plus size={13} /> 새 위젯
          </button>
        )}
      </div>

      <div className="mb-3">
        <SegmentedControl size="md" ariaLabel="위젯 목록" value={section} options={sections} onChange={setSection} />
      </div>
      {SECTION_HINT[section] && (
        <p className="text-sm mb-5" style={{ color: 'var(--color-text-muted)' }}>{SECTION_HINT[section]}</p>
      )}

      {!loaded && <p className="text-sm text-gray-500">불러오는 중…</p>}

      {loaded && section === 'builtin' && <BuiltinWidgetList />}

      {loaded && section === 'types' && isAdmin && meta && (
        // 종류의 renderer 가 바뀌면 이미 만든 위젯의 그리는 방식도 바뀐다 → 정의 목록도 다시 읽는다
        <WidgetTypeAdmin codes={meta.codes} onChanged={() => Promise.all([loadMeta(), load(true)])} />
      )}

      {loaded && section === 'mine' && widgets.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-700 p-10 text-center">
          <p className="text-sm text-gray-300 mb-1">아직 만든 위젯이 없습니다</p>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
            등록된 모든 데이터 API 를 표·차트·요약 카드로 만들 수 있습니다.
          </p>
          <button
            type="button"
            onClick={() => setEditing(EMPTY_DRAFT)}
            disabled={!meta}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-40 transition-colors"
          >
            <Plus size={13} /> 첫 위젯 만들기
          </button>
        </div>
      )}

      {loaded && section === 'mine' && widgets.length > 0 && (
        <div className="rounded-lg border border-gray-800" style={{ backgroundColor: 'var(--color-bg-widget)' }}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className={TH}>이름</th>
                <th className={TH}>API</th>
                <th className={TH}>위젯</th>
                <th className={TH}>내놓을 화면</th>
                <th className={`${TH} w-16`}>사용</th>
                <th className={`${TH} w-20`} aria-label="동작" />
              </tr>
            </thead>
            <tbody>
              {widgets.map((w) => (
                <tr key={w.widget_id} className={`border-b border-gray-800/60 last:border-b-0 ${w.use_yn === 'Y' ? '' : 'opacity-50'}`}>
                  <td className="px-3 py-2.5">
                    <div className="text-sm text-gray-100">{w.name}</div>
                    {w.group_name && <div className="text-[11px] text-gray-500">{w.group_name}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-300 font-mono">{w.provider} / {w.model}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-300">{viewName[w.view_type] || w.view_type}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-400">{screenLabels(w.screens)}</td>
                  <td className="px-3 py-2.5">
                    <UseToggle on={w.use_yn === 'Y'} label={`${w.name} 사용`} onChange={(on) => toggleUse(w, on)} />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => setEditing(w)} disabled={!meta} className="p-1.5 text-gray-500 hover:text-cyan-400 transition-colors" aria-label={`${w.name} 수정`}>
                        <Pencil size={14} />
                      </button>
                      <button type="button" onClick={() => onDelete(w)} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors" aria-label={`${w.name} 삭제`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
