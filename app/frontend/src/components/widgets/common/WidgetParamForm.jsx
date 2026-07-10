/**
 * WidgetParamForm — compact parameter control that lives in the widget header,
 * alongside the view-toggle / refresh / close buttons. A sliders button opens a
 * small dropdown with the input(s) and an Apply action, so params no longer take
 * a panel above the body.
 *
 * Param spec (each entry):
 *   { name, label, kind: 'select'|'number'|'date'|'text', default, options?, step?, min?, max?, hint?, upper? }
 */
import { useState, useRef } from 'react';
import { SlidersHorizontal, ChevronDown } from 'lucide-react';
import useClickOutside from '../../../hooks/useClickOutside';

const inputCls =
  'w-full bg-[#0a0a0f] border border-gray-800 rounded px-2 py-1.5 text-xs text-gray-200 ' +
  'outline-none focus:border-cyan-700 tabular-nums';

function ParamInput({ p, value, onChange }) {
  if (p.kind === 'select') {
    return (
      <select className={inputCls} value={value ?? ''} onChange={(e) => onChange(p.name, e.target.value)}>
        {(p.options || []).map((opt) => {
          const v = typeof opt === 'string' ? opt : opt.value;
          const l = typeof opt === 'string' ? opt : (opt.label ?? opt.value);
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    );
  }
  if (p.kind === 'number') {
    return (
      <input
        type="number"
        step={p.step ?? 'any'}
        min={p.min}
        max={p.max}
        className={inputCls}
        value={value ?? ''}
        onChange={(e) => onChange(p.name, e.target.value === '' ? '' : Number(e.target.value))}
      />
    );
  }
  if (p.kind === 'date') {
    return (
      <input
        type="date"
        className={inputCls}
        value={value ?? ''}
        onChange={(e) => onChange(p.name, e.target.value)}
      />
    );
  }
  return (
    <input
      type="text"
      className={inputCls}
      value={value ?? ''}
      onChange={(e) => onChange(p.name, p.upper ? e.target.value.toUpperCase() : e.target.value)}
    />
  );
}

export default function WidgetParamForm({
  spec,
  values,
  onChange,
  onApply,
  loading = false,
  title = 'Parameters',
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, open ? () => setOpen(false) : null);
  if (!spec?.length) return null;

  return (
    <div ref={ref} className="relative" onMouseDown={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300 transition-colors"
        title={title}
      >
        <SlidersHorizontal size={11} className="text-cyan-500/70" />
        <span className="text-[10px] text-gray-500">{spec.length}</span>
        <ChevronDown size={10} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-[#1a1a1f] border border-gray-700 rounded shadow-xl z-50 p-3 space-y-2">
          {spec.map((p) => (
            <div key={p.name} className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide text-gray-500">{p.label || p.name}</label>
              <ParamInput p={p} value={values[p.name]} onChange={onChange} />
              {p.hint && <span className="text-[10px] text-gray-600">{p.hint}</span>}
            </div>
          ))}
          {onApply && (
            <button
              onClick={() => { onApply(); setOpen(false); }}
              disabled={loading}
              className="w-full mt-1 px-2 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-[11px] font-semibold rounded transition-colors"
            >
              {loading ? 'Loading…' : 'Apply'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}