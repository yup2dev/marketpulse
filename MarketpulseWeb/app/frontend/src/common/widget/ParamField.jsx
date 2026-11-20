/**
 * ParamField — 라벨 + 입력칸 + 힌트 한 묶음. 파라미터 팝오버와 위젯 안 폼이 같이 쓴다.
 *
 * p: { name, label, kind: 'select'|'number'|'date'|'text', options?, step?, min?, max?, hint?, upper?, emptyLabel? }
 * select 는 공통 Select(md) 로 그린다 — 브라우저 기본 <select> 를 쓰지 않는다.
 * date 의 min/max 는 'YYYY-MM-DD' 또는 그 값을 돌려주는 함수(예: 오늘).
 * emptyLabel: 빈 값에도 뜻이 있는 입력(기준일 비움 = 최신)이면 라벨 옆에 되돌리기 버튼을 둔다.
 */
import Select from './Select';
import { INPUT_CLS } from './helpers';

function ParamInput({ p, value, onChange, id }) {
  if (p.kind === 'select') {
    return (
      <Select
        id={id}
        size="md"
        align="left"
        value={value ?? ''}
        options={p.options || []}
        onChange={(v) => onChange(p.name, v)}
      />
    );
  }
  if (p.kind === 'number') {
    return (
      <input
        id={id}
        type="number"
        step={p.step ?? 'any'}
        min={p.min}
        max={p.max}
        className={INPUT_CLS}
        value={value ?? ''}
        onChange={(e) => onChange(p.name, e.target.value === '' ? '' : Number(e.target.value))}
      />
    );
  }
  if (p.kind === 'date') {
    const bound = (b) => (typeof b === 'function' ? b() : b);
    return (
      <input
        id={id}
        type="date"
        min={bound(p.min)}
        max={bound(p.max)}
        className={INPUT_CLS}
        value={value ?? ''}
        onChange={(e) => onChange(p.name, e.target.value)}
      />
    );
  }
  return (
    <input
      id={id}
      type="text"
      className={INPUT_CLS}
      value={value ?? ''}
      onChange={(e) => onChange(p.name, p.upper ? e.target.value.toUpperCase() : e.target.value)}
    />
  );
}

export default function ParamField({ p, value, onChange, idPrefix = 'param' }) {
  const id = `${idPrefix}-${p.name}`;
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[11px] font-medium text-gray-400">{p.label || p.name}</label>
        {p.emptyLabel && value != null && value !== '' && (
          <button
            type="button"
            onClick={() => onChange(p.name, '')}
            className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            {p.emptyLabel}
          </button>
        )}
      </div>
      <ParamInput p={p} value={value} onChange={onChange} id={id} />
      {p.hint && <span className="text-[10px] text-gray-500">{p.hint}</span>}
    </div>
  );
}
