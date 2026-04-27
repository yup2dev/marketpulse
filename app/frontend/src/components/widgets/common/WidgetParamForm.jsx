/**
 * WidgetParamForm — shared parameter form used inside data-driven widgets.
 * Collapsible header lets users hide/show the input grid to reclaim screen space.
 *
 * Param spec (each entry):
 *   { name, label, kind: 'select'|'number'|'date'|'text', default, options?, step?, min?, max?, hint?, upper? }
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-react';

const inputCls =
  'bg-[#0a0a0f] border border-gray-800 rounded px-2 py-1.5 text-xs text-gray-200 ' +
  'outline-none focus:border-cyan-700 tabular-nums';

export default function WidgetParamForm({
  spec,
  values,
  onChange,
  defaultOpen = true,
  title = 'Parameters',
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!spec?.length) return null;
  const cols = Math.min(4, Math.max(2, spec.length <= 3 ? spec.length : 4));

  return (
    <div
      className="border-b border-gray-800/60 mb-2"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 px-1 py-1 text-[11px] text-gray-400 hover:text-gray-200 transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <SlidersHorizontal size={11} className="text-cyan-500/70" />
        <span className="font-medium tracking-wide uppercase">{title}</span>
        <span className="ml-auto text-[10px] text-gray-600">{spec.length}</span>
      </button>

      {open && (
        <div
          className={`grid gap-2 pb-2 pt-1`}
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {spec.map((p) => (
            <div key={p.name} className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide text-gray-500">{p.label || p.name}</label>
              {p.kind === 'select' ? (
                <select
                  className={inputCls}
                  value={values[p.name] ?? ''}
                  onChange={(e) => onChange(p.name, e.target.value)}
                >
                  {(p.options || []).map((opt) => {
                    const v = typeof opt === 'string' ? opt : opt.value;
                    const l = typeof opt === 'string' ? opt : (opt.label ?? opt.value);
                    return <option key={v} value={v}>{l}</option>;
                  })}
                </select>
              ) : p.kind === 'number' ? (
                <input
                  type="number"
                  step={p.step ?? 'any'}
                  min={p.min}
                  max={p.max}
                  className={inputCls}
                  value={values[p.name] ?? ''}
                  onChange={(e) => onChange(p.name, e.target.value === '' ? '' : Number(e.target.value))}
                />
              ) : p.kind === 'date' ? (
                <input
                  type="date"
                  className={inputCls}
                  value={values[p.name] ?? ''}
                  onChange={(e) => onChange(p.name, e.target.value)}
                />
              ) : (
                <input
                  type="text"
                  className={inputCls}
                  value={values[p.name] ?? ''}
                  onChange={(e) => onChange(p.name, p.upper ? e.target.value.toUpperCase() : e.target.value)}
                />
              )}
              {p.hint && <span className="text-[10px] text-gray-600">{p.hint}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
