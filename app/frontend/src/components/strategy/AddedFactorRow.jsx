import { useState } from 'react';
import { X } from 'lucide-react';
import { CATEGORY_META } from '../../data/strategyFactors';

const AddedFactorRow = ({ item, factor, onUpdate, onRemove, usedCount = 0 }) => {
  // Local string state to allow free typing (e.g. "2." mid-decimal) without
  // coercing to Number on every keystroke. Commits on blur.
  const [drafts, setDrafts] = useState({});

  const handleChange = (key, raw) => {
    setDrafts(d => ({ ...d, [key]: raw }));
  };

  const handleBlur = (key, raw) => {
    const num = parseFloat(raw);
    const committed = isNaN(num) ? (item.params?.[key] ?? 0) : num;
    setDrafts(d => { const n = { ...d }; delete n[key]; return n; });
    onUpdate({ ...item, params: { ...item.params, [key]: committed } });
  };

  const displayVal = (key, def) =>
    key in drafts ? drafts[key] : String(item.params?.[key] ?? def);

  const catMeta = CATEGORY_META[factor?.category] || {};
  const dotColor = catMeta.color?.replace('text-', 'bg-') || 'bg-gray-500';

  return (
    <div className={`rounded-lg border transition-colors ${
      usedCount > 0
        ? 'bg-[#060c0c] border-cyan-900/50 hover:border-cyan-800/60'
        : 'bg-[#060608] border-gray-800 hover:border-gray-700'
    }`}>

      {/* ── Header row ── */}
      <div className="flex items-start gap-2.5 px-3 pt-3 pb-2">
        <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${dotColor}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <code className="text-[11px] text-cyan-300 font-mono leading-none">{item.varName}</code>
            <span className="text-[10px] text-gray-500">·</span>
            <span className="text-[11px] text-gray-300 font-medium">{factor?.name || item.factorId}</span>
            {factor?.sub && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${
                usedCount > 0
                  ? 'text-cyan-400 border-cyan-800/40 bg-cyan-900/20'
                  : 'text-gray-600 border-gray-800 bg-gray-900/40'
              }`}>
                {usedCount > 0 ? `조건 ${usedCount}개 사용 중` : '미사용'}
              </span>
            )}
          </div>

          {factor?.desc && (
            <p className="text-[10px] text-gray-600 mt-1 leading-relaxed line-clamp-2">
              {factor.desc}
            </p>
          )}
        </div>

        <button
          onClick={onRemove}
          className="p-0.5 text-gray-700 hover:text-red-400 transition-colors shrink-0 mt-0.5"
          title="Remove factor"
        >
          <X size={12} />
        </button>
      </div>

      {/* ── Params ── */}
      {factor?.params?.length > 0 && (
        <div className="flex items-center gap-3 px-3 pb-3 pt-1 border-t border-gray-800/50 flex-wrap">
          {factor.params.map(p => (
            <div key={p.name} className="flex flex-col gap-0.5">
              <span className="text-[9px] text-gray-600 uppercase tracking-wider">{p.label}</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={displayVal(p.name, p.default)}
                  onChange={e => handleChange(p.name, e.target.value)}
                  onBlur={e => handleBlur(p.name, e.target.value)}
                  min={p.min}
                  max={p.max}
                  step={p.step ?? 1}
                  className="w-20 px-2 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-[11px] text-gray-200 focus:outline-none focus:border-cyan-500 tabular-nums"
                />
                {(p.min != null || p.max != null) && (
                  <span className="text-[9px] text-gray-700 whitespace-nowrap">
                    {p.min}–{p.max}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(!factor?.params || factor.params.length === 0) && (
        <div className="px-3 pb-2.5 text-[9px] text-gray-700 italic">파라미터 없음</div>
      )}
    </div>
  );
};

export default AddedFactorRow;
