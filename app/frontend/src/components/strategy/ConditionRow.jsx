import { useState } from 'react';
import { X, ChevronDown, ChevronUp, Sigma, Hash, Variable } from 'lucide-react';
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

// ── Side-type pill selector (Factor | Value | Formula) ───────────────────────
function TypePillGroup({ value, onChange, includeValue = true }) {
  const items = [
    { id: 'factor',  label: 'Factor',  Icon: Variable },
    ...(includeValue ? [{ id: 'value', label: 'Value', Icon: Hash }] : []),
    { id: 'formula', label: 'Formula', Icon: Sigma },
  ];
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded bg-[#060608] border border-gray-800">
      {items.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
            value === id
              ? 'bg-cyan-900/30 text-cyan-300 border border-cyan-800/50'
              : 'text-gray-600 hover:text-gray-300 border border-transparent'
          }`}
        >
          <Icon size={9} />
          {label}
        </button>
      ))}
    </div>
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

  const leftType  = row.leftType  || 'factor';
  const leftOpt   = varOptions.find(o => o.key === row.leftKey) || varOptions.find(o => o.key === firstKey);
  const rightOpt  = row.rightType === 'factor'
    ? (varOptions.find(o => o.key === row.rightKey) || varOptions.find(o => o.key === secondKey))
    : null;

  const opMeta    = OP_DISPLAY[row.op] || { symbol: row.op, text: row.op, color: 'text-gray-400' };
  const accentBdr = side === 'buy' ? 'border-green-900/30' : 'border-red-900/30';
  const accentBg  = side === 'buy' ? 'bg-green-900/[0.04]' : 'bg-red-900/[0.04]';

  const isCross = row.op === 'crosses_above' || row.op === 'crosses_below';

  // Compact formula hint — varNames user can type
  const availableNames = varOptions
    .filter(o => o.key.startsWith('f:'))
    .map(o => o.label.split(' · ')[0])
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .concat(['close', 'high', 'low', 'open', 'volume']);

  return (
    <div className={`rounded-lg border ${accentBdr} ${accentBg} overflow-hidden`}>

      {/* ── Formula display row ── */}
      <div className="flex items-center gap-2 px-3 py-2.5 flex-wrap">

        {/* Left — factor or formula */}
        <div className="flex flex-col items-start gap-0.5 min-w-0">
          <span className="text-[8px] text-gray-700 uppercase tracking-wider px-0.5">
            {leftType === 'formula' ? 'Left Formula' : 'Factor'}
          </span>
          {leftType === 'formula' ? (
            <FormulaToken color="text-emerald-300" bg="bg-emerald-900/15" border="border-emerald-800/40">
              <Sigma size={9} className="mr-1 opacity-70" />
              {row.leftFormula || <span className="italic opacity-50">expression…</span>}
            </FormulaToken>
          ) : (
            <FormulaToken color="text-cyan-300" bg="bg-cyan-900/15" border="border-cyan-800/40">
              <span className="text-cyan-500 text-[9px] mr-1">{varLabel(leftOpt)}</span>
              {formulaLabel(leftOpt)}
            </FormulaToken>
          )}
        </div>

        {/* Operator token */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[8px] text-gray-700 uppercase tracking-wider px-0.5">
            {isCross ? 'Signal' : 'Op'}
          </span>
          <span className={`text-[13px] font-bold px-1 tabular-nums ${opMeta.color}`}>
            {opMeta.symbol}
          </span>
          {isCross && (
            <span className={`text-[8px] font-medium ${opMeta.color} opacity-80 whitespace-nowrap`}>
              {opMeta.text}
            </span>
          )}
        </div>

        {/* Right — value, factor, or formula */}
        <div className="flex flex-col items-start gap-0.5 min-w-0">
          <span className="text-[8px] text-gray-700 uppercase tracking-wider px-0.5">
            {row.rightType === 'value'   ? 'Value'
             : row.rightType === 'formula' ? 'Right Formula'
             : 'Factor'}
          </span>
          {row.rightType === 'value' ? (
            <ValueToken
              value={row.rightValue}
              onChange={v => onUpdate({ ...row, rightValue: v })}
              onBlur={v => onUpdate({ ...row, rightValue: v })}
            />
          ) : row.rightType === 'formula' ? (
            <FormulaToken color="text-emerald-300" bg="bg-emerald-900/15" border="border-emerald-800/40">
              <Sigma size={9} className="mr-1 opacity-70" />
              {row.rightFormula || <span className="italic opacity-50">expression…</span>}
            </FormulaToken>
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
        <div className="px-3 pb-3 pt-2 border-t border-gray-800/50 bg-[#060608] space-y-3">

          {/* LEFT row */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[9px] text-gray-600 uppercase tracking-wider">Left</span>
              <TypePillGroup
                value={leftType}
                onChange={t => onUpdate({ ...row, leftType: t })}
                includeValue={false}
              />
            </div>
            {leftType === 'formula' ? (
              <input
                type="text"
                value={row.leftFormula ?? ''}
                onChange={e => onUpdate({ ...row, leftFormula: e.target.value })}
                placeholder="e.g. ema1 * 0.98 + rsi1 / 10"
                className={`${sel} w-full font-mono text-emerald-300 border-emerald-800/50 focus:border-emerald-500`}
              />
            ) : (
              <select
                value={row.leftKey || firstKey}
                onChange={e => onUpdate({ ...row, leftKey: e.target.value })}
                className={`${sel} w-full`}
              >
                <option value="" disabled>← 팩터 선택</option>
                {varOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            )}
          </div>

          {/* OPERATOR row */}
          <div>
            <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-1.5">Operator</div>
            <select
              value={row.op}
              onChange={e => onUpdate({ ...row, op: e.target.value })}
              className={`${sel} w-full`}
            >
              {COND_OPERATORS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>

          {/* RIGHT row */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[9px] text-gray-600 uppercase tracking-wider">Right</span>
              <TypePillGroup
                value={row.rightType}
                onChange={t => onUpdate({ ...row, rightType: t })}
              />
            </div>
            {row.rightType === 'factor' && (
              <select
                value={row.rightKey || secondKey}
                onChange={e => onUpdate({ ...row, rightKey: e.target.value })}
                className={`${sel} w-full`}
              >
                <option value="" disabled>← 비교 팩터</option>
                {varOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            )}
            {row.rightType === 'value' && (
              <input
                type="number"
                value={row.rightValue ?? 0}
                onChange={e => onUpdate({ ...row, rightValue: e.target.value === '' ? '' : Number(e.target.value) })}
                onBlur={e => onUpdate({ ...row, rightValue: Number(e.target.value) || 0 })}
                className={`${sel} w-full tabular-nums`}
                step="any"
                placeholder="0"
              />
            )}
            {row.rightType === 'formula' && (
              <input
                type="text"
                value={row.rightFormula ?? ''}
                onChange={e => onUpdate({ ...row, rightFormula: e.target.value })}
                placeholder="e.g. close * 0.95 + 2"
                className={`${sel} w-full font-mono text-emerald-300 border-emerald-800/50 focus:border-emerald-500`}
              />
            )}
          </div>

          {/* Formula help */}
          {(leftType === 'formula' || row.rightType === 'formula') && (
            <div className="rounded border border-emerald-900/40 bg-emerald-900/[0.06] px-2.5 py-2">
              <div className="text-[9px] text-emerald-500 font-semibold uppercase tracking-wider mb-1">수식 사용법</div>
              <div className="text-[10px] text-gray-500 leading-relaxed">
                연산자 <code className="text-emerald-400">+ - * / % **</code> · 함수 <code className="text-emerald-400">abs, min, max, log, exp, sqrt</code>
              </div>
              <div className="text-[10px] text-gray-500 mt-1">
                사용 가능 변수 —{' '}
                {availableNames.length ? (
                  availableNames.map((n, i) => (
                    <code key={n} className="text-cyan-400 mr-1.5">{n}{i < availableNames.length - 1 ? ',' : ''}</code>
                  ))
                ) : (
                  <span className="text-gray-700 italic">Variables 패널에서 팩터를 먼저 추가하세요</span>
                )}
              </div>
              <div className="text-[10px] text-gray-600 mt-1 italic">
                예: <code className="text-emerald-400">ema1 * 0.98 + 2</code>,{' '}
                <code className="text-emerald-400">(high + low) / 2</code>,{' '}
                <code className="text-emerald-400">max(rsi1, 30)</code>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConditionRow;
