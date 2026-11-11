/**
 * WidgetTypeAdmin — 위젯 종류 목록 관리 (관리자 전용).
 *
 * 위젯을 만들 때 ③단계 '보여 줄 위젯' 에 나오는 목록이다. 모든 사용자가 같은 목록을 본다.
 *   - 이름·순서·사용 여부를 바꾼다. 사용 안 함이면 새 위젯에서 고를 수 없다 (이미 만든 위젯은 그대로 그려진다)
 *   - 종류를 추가한다. 그리는 코드는 프론트에 있으므로 '그리는 방식' 은 이미 있는 것 중에서 고른다
 *   - 쓰는 위젯이 있는 종류는 지울 수 없다 (서버가 409 로 막는다)
 */
import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Select, INPUT_CLS } from '../widgets/ui';
import { widgetTypesAPI } from '../../config/api';
import { UseToggle } from './parts';

const TH = 'text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 px-3 py-2';
const EMPTY = { type_code: '', name: '', renderer: 'table' };

export default function WidgetTypeAdmin({ codes, onChanged }) {
  const types = codes.VIEW_TYPE;
  const rendererOptions = codes.RENDERER.map((r) => ({ value: r.value, label: r.name }));
  const [names, setNames] = useState({});     // 편집 중인 이름 { code: 입력값 }
  const [draft, setDraft] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const run = async (fn, okMessage) => {
    setBusy(true);
    try {
      await fn();
      if (okMessage) toast.success(okMessage);
      await onChanged();
    } catch (e) {
      toast.error(e?.detail || e?.message || '변경 실패');
    } finally {
      setBusy(false);
    }
  };

  const commitName = (t) => {
    const next = (names[t.value] ?? t.name).trim();
    setNames((m) => { const { [t.value]: _drop, ...rest } = m; return rest; });
    if (next && next !== t.name) run(() => widgetTypesAPI.update(t.value, { name: next }));
  };

  // 이웃과 순서를 맞바꾼다 (sort_seq 가 같으면 맞바꿔도 그대로라 인덱스로 다시 매긴다)
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= types.length) return;
    const order = types.map((t) => t.value);
    [order[i], order[j]] = [order[j], order[i]];
    run(() => Promise.all(order.map((code, k) => widgetTypesAPI.update(code, { sort_seq: k * 10 }))));
  };

  const add = () => {
    if (!draft.type_code.trim() || !draft.name.trim()) { toast.error('코드와 이름을 입력하세요'); return; }
    run(async () => {
      await widgetTypesAPI.create({ ...draft, type_code: draft.type_code.trim(), name: draft.name.trim() });
      setDraft(EMPTY);
    }, '위젯 종류 추가됨');
  };

  const remove = (t) => {
    if (!window.confirm(`위젯 종류 '${t.name}' 을(를) 삭제하시겠습니까?`)) return;
    run(() => widgetTypesAPI.delete(t.value), '삭제됨');
  };

  return (
    <div>
      <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
        위젯을 만들 때 고르는 '보여 줄 위젯' 목록입니다. 모든 사용자에게 적용됩니다.
        사용 안 함으로 바꾸면 새 위젯에서 고를 수 없고, 이미 만든 위젯은 그대로 그려집니다.
      </p>

      <div className="rounded-lg border border-gray-800" style={{ backgroundColor: 'var(--color-bg-widget)' }}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className={`${TH} w-16`}>순서</th>
              <th className={`${TH} w-[20%]`}>코드</th>
              <th className={TH}>이름</th>
              <th className={`${TH} w-[24%]`}>그리는 방식</th>
              <th className={`${TH} w-16`}>사용</th>
              <th className={`${TH} w-12`} aria-label="동작" />
            </tr>
          </thead>
          <tbody>
            {types.map((t, i) => (
              <tr key={t.value} className={`border-b border-gray-800/60 ${t.use_yn === 'Y' ? '' : 'opacity-50'}`}>
                <td className="px-3 py-1.5">
                  <div className="flex">
                    <button type="button" onClick={() => move(i, -1)} disabled={busy || i === 0} className="p-0.5 text-gray-500 hover:text-white disabled:opacity-20" aria-label={`${t.name} 위로`}><ArrowUp size={12} /></button>
                    <button type="button" onClick={() => move(i, 1)} disabled={busy || i === types.length - 1} className="p-0.5 text-gray-500 hover:text-white disabled:opacity-20" aria-label={`${t.name} 아래로`}><ArrowDown size={12} /></button>
                  </div>
                </td>
                <td className="px-3 py-1.5 text-xs text-gray-300 font-mono">{t.value}</td>
                <td className="px-3 py-1.5">
                  <input
                    type="text" className={INPUT_CLS} maxLength={100} aria-label={`${t.value} 이름`}
                    value={names[t.value] ?? t.name}
                    onChange={(e) => setNames((m) => ({ ...m, [t.value]: e.target.value }))}
                    onBlur={() => commitName(t)}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <Select
                    size="md" align="left" value={t.renderer} options={rendererOptions}
                    onChange={(v) => v !== t.renderer && run(() => widgetTypesAPI.update(t.value, { renderer: v }))}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <UseToggle
                    on={t.use_yn === 'Y'} disabled={busy} label={`${t.name} 사용`}
                    onChange={(on) => run(() => widgetTypesAPI.update(t.value, { use_yn: on ? 'Y' : 'N' }))}
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button type="button" onClick={() => remove(t)} disabled={busy} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-40" aria-label={`${t.name} 삭제`}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {/* 추가 */}
            <tr>
              <td className="px-3 py-2 text-[11px] text-gray-500">추가</td>
              <td className="px-3 py-2">
                <input
                  type="text" className={`${INPUT_CLS} font-mono`} maxLength={30} placeholder="코드 (영문)" aria-label="새 종류 코드"
                  value={draft.type_code} onChange={(e) => setDraft((d) => ({ ...d, type_code: e.target.value }))}
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="text" className={INPUT_CLS} maxLength={100} placeholder="이름" aria-label="새 종류 이름"
                  value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
                />
              </td>
              <td className="px-3 py-2">
                <Select size="md" align="left" value={draft.renderer} options={rendererOptions} onChange={(v) => setDraft((d) => ({ ...d, renderer: v }))} />
              </td>
              <td colSpan={2} className="px-3 py-2 text-right">
                <button
                  type="button" onClick={add} disabled={busy}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-40 transition-colors"
                >
                  <Plus size={12} /> 추가
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
