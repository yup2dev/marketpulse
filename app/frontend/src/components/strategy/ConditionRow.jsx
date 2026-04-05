import { useState } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { COND_OPERATORS } from './constants';

// ── Operator display ──────────────────────────────────────────────────────────
const OP_DISPLAY = {
  'crosses_above': { symbol: '↗',  text: 'crosses above', color: 'text-green-400' },
  'crosses_below': { symbol: '↘',  text: 'crosses below', color: 'text-red-400'   },
  '>':             { symbol: '>',  text: '>',              color: 'text-yellow-400'},
  '<':             { symbol: '<',  text: '<',              color: 'text-yellow-400'},
  '>=':            { symbol: '≥',  text: '≥',              color: 'text-yellow-400'},
  '<=':            { symbol: '≤',  text: '≤',              color: 'text-yellow-400'},
  '==':            { symbol: '=',  text: '=',              color: 'text-blue-400' },
};

// Extract "RSI(14)" or "EMA(20)" from opt.label = "rsi1 · RSI(14)"
function formulaLabel(opt) {
  if (!opt) return '?';
  const parts = opt.label.split(' · ');
  return parts.length > 1 ? parts.slice(1).join(' · ') : parts[0];
}

// Compact varName only: "rsi1" from "rsi1 · RSI(14)"
function varLabel(opt) {
  if (!opt) return '?';
  return opt.label.split(' · ')[0];
}

// ── Formula Token — styled chip showing a factor/value ────────────────────────
function FormulaToken({ children, color = 'text-cyan-300', bg = 'bg-cyan-900/20', border = 'border-cyan-800/40' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-mono font-medium ${color} ${bg} ${border}`}>
      {children}
    </span>
  );
}

// ── Inline value editor with formula styling ──────────────────────────────────
function ValueToken({ value, onChange, onBlur }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={value ?? 0}
        onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        onBlur={e => { setEditing(false); onBlur(Number(e.target.value) || 0); }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { setEditing(false); onBlur(Number(e.target.value) || 0); } }}
        className="w-20 px-2 py-0.5 bg-[#0a0a0f] border border-yellow-600/60 rounded text-[11px] font-mono text-yellow-300 focus:outline-none tabular-nums"
        step="any"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="클릭하여 값 수정"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-yellow-700/50 bg-yellow-900/15 text-yellow-300 text-[11px] font-mono font-medium hover:bg-yellow-900/30 hover:border-yellow-600/60 transition-colors group"
    >
      {value ?? 0}
      <span className="text-[8px] text-yellow-600 group-hover:text-yellow-400 transition-colors">✎</span>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const ConditionRow = ({ row, varOptions, onUpdate, onRemove, side = 'buy' }) => {
  const [showEdit, setShowEdit] = useState(false);

  const sel = `
    px-1.5 py-1 bg-[#060608] border border-gray-700/80 rounded
    text-[10px] text-white focus:outline-none focus:border-cyan-500 transition-colors
  `;

  const firstKey  = varOptions[0]?.key || '';
  const secondKey = varOptions[1]?.key || varOptions[0]?.key || '';

  const leftOpt  = varOptions.find(o => o.key === row.leftKey) || varOptions.find(o => o.key === firstKey);
  const rightOpt = row.rightType === 'factor'
    ? (varOptions.find(o => o.key === row.rightKey) || varOptions.find(o => o.key === secondKey))
    : null;

  const opMeta    = OP_DISPLAY[row.op] || { symbol: row.op, text: row.op, color: 'text-gray-400' };
  const accentBdr = side === 'buy' ? 'border-green-900/30' : 'border-red-900/30';
  const accentBg  = side === 'buy' ? 'bg-green-900/[0.04]' : 'bg-red-900/[0.04]';

  const isCross = row.op === 'crosses_above' || row.op === 'crosses_below';

  return (
    <div className={`rounded-lg border ${accentBdr} ${accentBg} overflow-hidden`}>

      {/* ── Formula display row ── */}
      <div className="flex items-center gap-2 px-3 py-2.5 flex-wrap">

        {/* Left factor token */}
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-[8px] text-gray-700 uppercase tracking-wider px-0.5">Factor</span>
          <FormulaToken color="text-cyan-300" bg="bg-cyan-900/15" border="border-cyan-800/40">
            <span className="text-cyan-500 text-[9px] mr-1">{varLabel(leftOpt)}</span>
            {formulaLabel(leftOpt)}
          </FormulaToken>
        </div>

        {/* Operator token */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[8px] text-gray-700 uppercase tracking-wider px-0.5">
            {isCross ? 'Signal' : 'Op'}
          </span>
          <span className={`text-[13px] font-bold px-1 tabular-nums ${opMeta.color}`}>
            {isCross ? opMeta.symbol : opMeta.symbol}
          </span>
          {isCross && (
            <span className={`text-[8px] font-medium ${opMeta.color} opacity-80 whitespace-nowrap`}>
              {opMeta.text}
            </span>
          )}
        </div>

        {/* Right — value or factor */}
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-[8px] text-gray-700 uppercase tracking-wider px-0.5">
            {row.rightType === 'value' ? 'Value' : 'Factor'}
          </span>
          {row.rightType === 'value' ? (
            <ValueToken
              value={row.rightValue}
              onChange={v => onUpdate({ ...row, rightValue: v })}
              onBlur={v => onUpdate({ ...row, rightValue: v })}
            />
          ) : (
            <FormulaToken color="text-purple-300" bg="bg-purple-900/15" border="border-purple-800/40">
              <span className="text-purple-500 text-[9px] mr-1">{varLabel(rightOpt)}</span>
              {formulaLabel(rightOpt)}
            </FormulaToken>
          )}
        </div>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setShowEdit(v => !v)}
            title="조건 편집"
            className="p-1 text-gray-700 hover:text-cyan-400 transition-colors rounded hover:bg-cyan-900/10"
          >
            {showEdit ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          <button
            onClick={onRemove}
            className="p-1 text-gray-700 hover:text-red-400 transition-colors rounded hover:bg-red-900/10"
            title="Remove condition"
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* ── Collapsed edit controls ── */}
      {showEdit && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-800/50 bg-[#060608] space-y-2">
          <div className="text-[9px] text-gray-700 uppercase tracking-wider mb-1.5">조건 편집</div>
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
                value={row.rightValue ?? 0}
                onChange={e => onUpdate({ ...row, rightValue: e.target.value === '' ? '' : Number(e.target.value) })}
                onBlur={e => onUpdate({ ...row, rightValue: Number(e.target.value) || 0 })}
                className={`${sel} w-24 tabular-nums`}
                step="any"
                placeholder="0"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConditionRow;
