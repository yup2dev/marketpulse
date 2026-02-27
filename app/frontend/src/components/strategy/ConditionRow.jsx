import { X } from 'lucide-react';
import { COND_OPERATORS } from './constants';

/** Generate a human-readable preview of the condition */
function buildPreview(row, varOptions) {
  const leftOpt  = varOptions.find(o => o.key === row.leftKey)  || varOptions[0];
  const opMeta   = COND_OPERATORS.find(o => o.id === row.op);
  const opLabel  = opMeta?.label || row.op;

  // Extract the short label (after " · ") or use full label
  const shortLabel = (opt) => {
    if (!opt) return '?';
    const parts = opt.label.split(' · ');
    return parts.length > 1 ? parts.slice(1).join(' · ') : parts[0];
  };

  const leftLabel = shortLabel(leftOpt);

  let rightLabel;
  if (row.rightType === 'value') {
    rightLabel = `${row.rightValue}`;
  } else {
    const rightOpt = varOptions.find(o => o.key === row.rightKey)
      || varOptions.find(o => o.key !== row.leftKey)
      || varOptions[0];
    rightLabel = shortLabel(rightOpt);
  }

  return `${leftLabel}  ${opLabel}  ${rightLabel}`;
}

const ConditionRow = ({ row, varOptions, onUpdate, onRemove, side = 'buy' }) => {
  const sel = `
    px-1.5 py-1 bg-[#060608] border border-gray-700/80 rounded
    text-[10px] text-white focus:outline-none focus:border-cyan-500 transition-colors
  `;

  const firstKey  = varOptions[0]?.key || '';
  const secondKey = varOptions[1]?.key || varOptions[0]?.key || '';
  const preview   = varOptions.length > 0 ? buildPreview(row, varOptions) : null;
  const accentColor = side === 'buy' ? 'text-green-400/70' : 'text-red-400/70';

  return (
    <div className="rounded-lg border border-gray-800/60 bg-[#060608] p-2.5 space-y-2">

      {/* ── Selects row ── */}
      <div className="flex items-center gap-1.5 flex-wrap">

        {/* Left factor */}
        <select
          value={row.leftKey || firstKey}
          onChange={e => onUpdate({ ...row, leftKey: e.target.value })}
          className={`${sel} flex-1 min-w-[130px] max-w-[200px]`}
        >
          <option value="" disabled>← 팩터 선택</option>
          {varOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>

        {/* Operator */}
        <select
          value={row.op}
          onChange={e => onUpdate({ ...row, op: e.target.value })}
          className={`${sel} w-[130px] shrink-0`}
        >
          {COND_OPERATORS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>

        {/* Right type toggle */}
        <select
          value={row.rightType}
          onChange={e => onUpdate({ ...row, rightType: e.target.value })}
          className={`${sel} w-[70px] shrink-0`}
        >
          <option value="factor">Factor</option>
          <option value="value">Value</option>
        </select>

        {/* Right factor or value */}
        {row.rightType === 'factor' ? (
          <select
            value={row.rightKey || secondKey}
            onChange={e => onUpdate({ ...row, rightKey: e.target.value })}
            className={`${sel} flex-1 min-w-[130px] max-w-[200px]`}
          >
            <option value="" disabled>← 비교 팩터</option>
            {varOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        ) : (
          <input
            type="number"
            value={row.rightValue}
            onChange={e => onUpdate({ ...row, rightValue: e.target.value })}
            className={`${sel} w-24 tabular-nums`}
            step="any"
            placeholder="0"
          />
        )}

        {/* Remove */}
        <button
          onClick={onRemove}
          className="p-1 text-gray-700 hover:text-red-400 transition-colors shrink-0 rounded hover:bg-red-900/10"
          title="Remove condition"
        >
          <X size={11} />
        </button>
      </div>

      {/* ── Human-readable preview ── */}
      {preview && (
        <div className={`flex items-center gap-1.5 pl-1 text-[10px] font-mono ${accentColor}`}>
          <span className="text-gray-700">▸</span>
          <span className="italic">{preview}</span>
        </div>
      )}

      {/* ── Hint when no factors added ── */}
      {varOptions.length === 0 && (
        <div className="text-[10px] text-gray-700 pl-1">
          먼저 팩터 탭에서 변수를 추가하세요
        </div>
      )}
    </div>
  );
};

export default ConditionRow;
