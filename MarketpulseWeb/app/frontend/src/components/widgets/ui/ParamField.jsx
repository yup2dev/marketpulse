/**
 * ParamField — 라벨 + 입력칸 + 힌트 한 묶음. 파라미터 팝오버와 위젯 안 폼이 같이 쓴다.
 *
 * p: { name, label, kind: 'select'|'number'|'date'|'text', options?, step?, min?, max?, hint?, upper? }
 * select 는 공통 Select(md) 로 그린다 — 브라우저 기본 <select> 를 쓰지 않는다.
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
    return <input id={id} type="date" className={INPUT_CLS} value={value ?? ''} onChange={(e) => onChange(p.name, e.target.value)} />;
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
      <label htmlFor={id} className="text-[11px] font-medium text-gray-400">{p.label || p.name}</label>
      <ParamInput p={p} value={value} onChange={onChange} id={id} />
      {p.hint && <span className="text-[10px] text-gray-500">{p.hint}</span>}
    </div>
  );
}
