import { SlidersHorizontal } from 'lucide-react';
import RangeSlider from './RangeSlider';
import { numFmt } from './screenerFormat';

export default function FilterConfigPanel({ item, value, onChange, sectors }) {
  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: 'var(--color-text-muted)' }}>
        <SlidersHorizontal size={20} />
        <span className="text-xs">좌측에서 필터를 선택하세요</span>
      </div>
    );
  }

  const { key, label, type, unit, sliderRange, quickOptions, periods } = item;
  const val = value || {};

  const setMin    = (v) => onChange(key, { ...val, min: v });
  const setMax    = (v) => onChange(key, { ...val, max: v });
  const setPeriod = (p) => onChange(key, { ...val, period: p });
  const applyQuick = (qv) => onChange(key, { ...val, ...qv });

  if (type === 'toggle') {
    return (
      <div className="p-4 flex flex-col gap-3">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{label}</h3>
        <button
          onClick={() => onChange(key, { enabled: !val.enabled })}
          className={`self-start flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
            val.enabled
              ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-500'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          style={!val.enabled ? { borderColor: 'var(--color-border)' } : {}}
        >
          {val.enabled ? '✓ 적용됨' : '적용하기'}
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4 overflow-y-auto">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{label}</h3>

      {/* 기간 선택 */}
      {type === 'percent_range' && periods && (
        <div>
          <div className="text-[11px] mb-2" style={{ color: 'var(--color-text-muted)' }}>기간 선택</div>
          <div className="flex gap-1.5">
            {periods.map((p) => (
              <button key={p.id} onClick={() => setPeriod(p.id)}
                className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                  (val.period || '1d') === p.id
                    ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-500 font-medium'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                style={(val.period || '1d') !== p.id ? { borderColor: 'var(--color-border)' } : {}}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 퀵 옵션 */}
      {quickOptions?.length > 0 && (
        <div>
          <div className="text-[11px] mb-2" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
          <div className="flex gap-1.5 flex-wrap">
            {quickOptions.map((q) => {
              const isActive =
                (q.value.min != null && val.min === q.value.min && val.max == null) ||
                (q.value.max != null && val.max === q.value.max && val.min == null);
              return (
                <button key={q.label}
                  onClick={() => applyQuick({ ...q.value, max: q.value.min != null ? undefined : q.value.max })}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    isActive ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-500 font-medium' : 'text-gray-400 hover:text-gray-200'
                  }`}
                  style={!isActive ? { borderColor: 'var(--color-border)' } : {}}
                >
                  {q.label}
                </button>
              );
            })}
            <button
              onClick={() => onChange(key, { ...val, min: undefined, max: undefined })}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                val.min == null && val.max == null
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-500 font-medium'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              style={val.min != null || val.max != null ? { borderColor: 'var(--color-border)' } : {}}
            >
              직접설정
            </button>
          </div>
        </div>
      )}

      {/* 멀티셀렉트 */}
      {type === 'multiselect' ? (
        <div>
          <div className="text-[11px] mb-2" style={{ color: 'var(--color-text-muted)' }}>섹터 선택</div>
          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
            {sectors.map((s) => {
              const active = (val.values || []).includes(s);
              return (
                <button key={s}
                  onClick={() => {
                    const arr = val.values || [];
                    onChange(key, { values: active ? arr.filter((x) => x !== s) : [...arr, s] });
                  }}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    active ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-500' : 'text-gray-400 hover:text-gray-200'
                  }`}
                  style={!active ? { borderColor: 'var(--color-border)' } : {}}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2">
            <input type="number" value={numFmt(val.min)} placeholder={`최소${unit ? ` (${unit})` : ''}`}
              onChange={(e) => setMin(e.target.value === '' ? undefined : Number(e.target.value))}
              className="flex-1 rounded-lg px-3 py-2 text-xs outline-none tabular-nums"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
            <span className="text-gray-500 text-sm flex-shrink-0">~</span>
            <input type="number" value={numFmt(val.max)} placeholder="최대"
              onChange={(e) => setMax(e.target.value === '' ? undefined : Number(e.target.value))}
              className="flex-1 rounded-lg px-3 py-2 text-xs outline-none tabular-nums"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
          {sliderRange && (
            <RangeSlider
              min={sliderRange[0]} max={sliderRange[1]}
              valueMin={val.min} valueMax={val.max}
              onChange={(bound, v) => bound === 'min' ? setMin(v) : setMax(v)}
            />
          )}
        </div>
      )}
    </div>
  );
}
