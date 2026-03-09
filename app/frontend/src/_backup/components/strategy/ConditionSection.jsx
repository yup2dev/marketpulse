import ConditionRow from './ConditionRow';
import { COND_OPERATORS } from './constants';

/** Build a plain-English summary of all conditions combined with logic */
function buildLogicSummary(conditions, logic, varOptions) {
  if (!conditions.length) return null;

  const parts = conditions.map(row => {
    const leftOpt = varOptions.find(o => o.key === row.leftKey) || varOptions[0];
    const opLabel = COND_OPERATORS.find(o => o.id === row.op)?.label || row.op;

    const short = (opt) => {
      if (!opt) return '?';
      const parts = opt.label.split(' · ');
      return parts.length > 1 ? parts.slice(1).join(' · ') : parts[0];
    };

    const leftLabel = short(leftOpt);
    let rightLabel;
    if (row.rightType === 'value') {
      rightLabel = `${row.rightValue}`;
    } else {
      const rightOpt = varOptions.find(o => o.key === row.rightKey)
        || varOptions.find(o => o.key !== row.leftKey)
        || varOptions[0];
      rightLabel = short(rightOpt);
    }
    return `${leftLabel} ${opLabel} ${rightLabel}`;
  });

  return parts.join(` ${logic} `);
}

const ConditionSection = ({
  title, color,
  conditions, logic, varOptions,
  onAdd, onChange, onRemove, onLogicChange,
  side,
}) => {
  const summary = buildLogicSummary(conditions, logic, varOptions);

  return (
    <div className="space-y-2">

      {/* ── Section header ── */}
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-bold ${color}`}>{title}</span>

        {/* Logic toggle (AND / OR) */}
        {conditions.length > 1 && (
          <button
            onClick={() => onLogicChange(logic === 'AND' ? 'OR' : 'AND')}
            className={`text-[9px] px-2 py-0.5 rounded border font-semibold transition-colors ${
              logic === 'AND'
                ? 'text-blue-400 border-blue-800/60 bg-blue-900/15 hover:bg-blue-900/25'
                : 'text-orange-400 border-orange-800/60 bg-orange-900/15 hover:bg-orange-900/25'
            }`}
            title="AND / OR 토글"
          >
            {logic}
          </button>
        )}

        <button
          onClick={onAdd}
          disabled={varOptions.length === 0}
          className="ml-auto flex items-center gap-1 text-[9px] px-2 py-1 text-cyan-400 border border-cyan-800/50 bg-cyan-900/10 hover:bg-cyan-900/20 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + 조건 추가
        </button>
      </div>

      {/* ── No factors warning ── */}
      {varOptions.filter(o => !o.key.startsWith('p:')).length === 0 && (
        <div className="text-[10px] text-gray-700 italic px-1 py-1.5">
          ← Variables 패널에서 팩터를 먼저 추가하세요
        </div>
      )}

      {/* ── Condition rows ── */}
      {conditions.length === 0 && varOptions.length > 0 ? (
        <div className="text-[10px] text-gray-700 italic px-1 py-1">
          조건 없음 — "+ 조건 추가" 버튼을 눌러 추가
        </div>
      ) : (
        <div className="space-y-2">
          {conditions.map((row, i) => (
            <div key={row.id} className="flex items-start gap-2">
              {/* Logic connector label */}
              <div className="w-7 shrink-0 text-right mt-2.5">
                {i === 0 ? (
                  <span className="text-[9px] text-gray-700">IF</span>
                ) : (
                  <span className={`text-[9px] font-semibold ${
                    logic === 'AND' ? 'text-blue-500' : 'text-orange-500'
                  }`}>
                    {logic}
                  </span>
                )}
              </div>

              <div className="flex-1">
                <ConditionRow
                  row={row}
                  varOptions={varOptions}
                  onUpdate={upd => onChange(i, upd)}
                  onRemove={() => onRemove(i)}
                  side={side}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Logic summary preview ── */}
      {summary && (
        <div className={`mt-1 rounded-lg border px-3 py-2 text-[10px] font-mono leading-relaxed ${
          side === 'buy'
            ? 'border-green-900/40 bg-green-900/[0.06] text-green-400/80'
            : 'border-red-900/40 bg-red-900/[0.06] text-red-400/80'
        }`}>
          <span className="text-[9px] uppercase tracking-widest opacity-60 block mb-1">
            {title} 로직 요약
          </span>
          {summary}
        </div>
      )}
    </div>
  );
};

export default ConditionSection;
