/**
 * 머리줄 공통 컨트롤 — 모든 DataWidget 이 같은 것을 쓴다.
 *
 *   ProviderSelect   데이터 소스 고르기. 모든 위젯에 항상 있다 (고를 게 하나뿐이어도 어디서 온 값인지 보인다)
 *   DateChip         기준일 — 비우면 최신. 'date' · '*_date' 이름의 컨트롤
 *   OptionsMenu      그 밖의 직접 입력 값(숫자·글자) — 버튼 하나에 모아 두고 '적용'으로 반영
 *   ControlSelect    선택지가 많은 컨트롤(국가 등)의 드롭다운. 선택지가 4개 이하면 HeaderSeg
 */
import { useEffect, useState } from 'react';
import { CalendarDays, Database, SlidersHorizontal } from 'lucide-react';
import { Select, ParamField, Popover, usePopover } from './adapter';
import { cachedRequest, pick } from './data';

const CHIP_CLS =
  'flex items-center gap-1 h-6 px-2 bg-gray-800 hover:bg-gray-700 rounded text-[11px] text-gray-300 transition-colors whitespace-nowrap';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function ProviderSelect({ value, options, onChange }) {
  return (
    <Select
      value={value}
      options={options}
      onChange={onChange}
      icon={Database}
      title="데이터 소스"
      placeholder="Provider"
      menuWidth="min-w-[180px]"
    />
  );
}

/** control.optionsFrom = { endpoint, value, label } 이면 선택지를 요청으로 채운다 (실패하면 정의의 선택지 그대로) */
export function ControlSelect({ control, value, onChange }) {
  const from = control.optionsFrom;
  const [loaded, setLoaded] = useState(null);
  useEffect(() => {
    if (!from) return undefined;
    let alive = true;
    cachedRequest(from.endpoint)
      .then((res) => {
        const rows = pick(res) || [];
        if (alive && rows.length) {
          setLoaded(rows.map((r) => ({
            value: r[from.value], label: r[from.label] ?? r[from.value], note: r.available === false ? 'Key needed' : undefined,
          })));
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [from]);
  return <Select value={value} options={loaded || control.options} onChange={onChange} title={control.label} menuWidth="min-w-[180px]" />;
}

export function DateChip({ control, value, onChange }) {
  const pop = usePopover();
  const field = { name: control.name, label: control.label, kind: 'date', emptyLabel: '최신', max: todayIso, hint: '이 날짜 이전 마지막 값으로 조회해요' };
  const trigger = (
    <button type="button" onClick={pop.toggle} className={CHIP_CLS} title={control.label} aria-haspopup="dialog" aria-expanded={pop.open}>
      <CalendarDays size={11} className="text-gray-500 flex-shrink-0" />
      {value || '최신'}
    </button>
  );
  return (
    <Popover popover={pop} trigger={trigger} className="w-56 p-3">
      <ParamField p={field} value={value} onChange={(_, v) => { onChange(v); if (!v) pop.close(); }} idPrefix="mp-date" />
    </Popover>
  );
}

export function OptionsMenu({ controls, values, onApply }) {
  const pop = usePopover();
  const [draft, setDraft] = useState(values);
  useEffect(() => { if (pop.open) setDraft(values); }, [pop.open]);   // eslint-disable-line react-hooks/exhaustive-deps
  const changed = controls.filter((c) => String(values[c.name] ?? '') !== String(c.default ?? '')).length;
  const trigger = (
    <button type="button" onClick={pop.toggle} className={CHIP_CLS} title="옵션" aria-haspopup="dialog" aria-expanded={pop.open}>
      <SlidersHorizontal size={11} className="text-gray-500 flex-shrink-0" />
      옵션{changed ? ` ${changed}` : ''}
    </button>
  );
  return (
    <Popover popover={pop} trigger={trigger} className="w-60 p-3">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => { e.preventDefault(); onApply(draft); pop.close(); }}
      >
        {controls.map((c) => (
          <ParamField
            key={c.name}
            p={{ name: c.name, label: c.label, kind: c.kind === 'number' ? 'number' : 'text' }}
            value={draft[c.name]}
            onChange={(name, v) => setDraft((prev) => ({ ...prev, [name]: v }))}
            idPrefix="mp-opt"
          />
        ))}
        <button type="submit" className="h-7 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors">적용</button>
      </form>
    </Popover>
  );
}
