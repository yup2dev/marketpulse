import { useMemo, useState } from 'react';
import { FlaskConical, Save, Plus, ArrowRight, Code, ChevronDown, ChevronUp } from 'lucide-react';
import { STRATEGY_FACTORS } from '../../data/strategyFactors';
import ConditionSection from './ConditionSection';
import AddedFactorRow from './AddedFactorRow';

// ── Python-style pseudocode preview ──────────────────────────────────────────
const OP_PYTHON = {
  'crosses_above': '.crosses_above',
  'crosses_below': '.crosses_below',
  '>':  ' > ',
  '<':  ' < ',
  '>=': ' >= ',
  '<=': ' <= ',
  '==': ' == ',
};

function condToPython(row, varOptions) {
  const leftOpt  = varOptions.find(o => o.key === row.leftKey) || varOptions[0];
  if (!leftOpt) return '# (조건 미완성)';

  const leftParts = leftOpt.label.split(' · ');
  const leftVar   = leftParts[0];   // "rsi1"
  const leftExpr  = leftParts.slice(1).join('.').replace(/\(.*\)/, '');  // "RSI" (strip params)
  const fullLeft  = `${leftVar}`;   // use the varName directly

  const isCross = row.op === 'crosses_above' || row.op === 'crosses_below';

  if (row.rightType === 'value') {
    if (isCross) return `${fullLeft}${OP_PYTHON[row.op] || row.op}(${row.rightValue ?? 0})`;
    return `${fullLeft}${OP_PYTHON[row.op] || ` ${row.op} `}${row.rightValue ?? 0}`;
  }
  const rightOpt  = varOptions.find(o => o.key === row.rightKey) || varOptions[0];
  const rightParts = rightOpt?.label.split(' · ') || ['?'];
  const rightVar  = rightParts[0];
  if (isCross) return `${fullLeft}${OP_PYTHON[row.op] || row.op}(${rightVar})`;
  return `${fullLeft}${OP_PYTHON[row.op] || ` ${row.op} `}${rightVar}`;
}

function PseudoCodeView({ name, selectedFactors, buyConditions, sellConditions, buyLogic, sellLogic, varOptions }) {
  const lines = useMemo(() => {
    const out = [];
    out.push({ type: 'comment',  text: `# Strategy: ${name || 'Unnamed'}` });
    out.push({ type: 'blank' });

    if (selectedFactors.length) {
      out.push({ type: 'comment', text: '# Variables' });
      selectedFactors.forEach(sf => {
        const paramStr = Object.entries(sf.params || {}).map(([k, v]) => `${k}=${v}`).join(', ');
        out.push({
          type: 'assign',
          varName: sf.varName,
          expr: `ta.${sf.factorId.toUpperCase()}(${paramStr || 'close'})`,
        });
      });
      out.push({ type: 'blank' });
    }

    if (buyConditions.length) {
      out.push({ type: 'comment', text: `# Buy Signal  [${buyLogic}]` });
      const conds = buyConditions.map(r => condToPython(r, varOptions));
      const joinOp = buyLogic === 'AND' ? ' &\n    ' : ' |\n    ';
      out.push({ type: 'signal', signal: 'buy', expr: conds.join(joinOp) });
      out.push({ type: 'blank' });
    }

    if (sellConditions.length) {
      out.push({ type: 'comment', text: `# Sell Signal  [${sellLogic}]` });
      const conds = sellConditions.map(r => condToPython(r, varOptions));
      const joinOp = sellLogic === 'AND' ? ' &\n    ' : ' |\n    ';
      out.push({ type: 'signal', signal: 'sell', expr: conds.join(joinOp) });
    }

    return out;
  }, [name, selectedFactors, buyConditions, sellConditions, buyLogic, sellLogic, varOptions]);

  return (
    <div className="font-mono text-[11px] leading-relaxed bg-[#06080c] border border-gray-800 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 bg-[#0a0a0f]">
        <Code size={11} className="text-gray-600" />
        <span className="text-[9px] text-gray-600 uppercase tracking-wider">Python Pseudocode</span>
        <span className="ml-auto text-[9px] text-gray-700">live preview</span>
      </div>
      <div className="p-4 space-y-0.5 overflow-x-auto">
        {lines.map((line, i) => {
          if (line.type === 'blank') return <div key={i} className="h-2" />;
          if (line.type === 'comment') return (
            <div key={i} className="text-gray-600">{line.text}</div>
          );
          if (line.type === 'assign') return (
            <div key={i}>
              <span className="text-cyan-400">{line.varName}</span>
              <span className="text-gray-500"> = </span>
              <span className="text-yellow-400">{line.expr}</span>
            </div>
          );
          if (line.type === 'signal') {
            const varName = line.signal === 'buy' ? 'buy_signal' : 'sell_signal';
            const color   = line.signal === 'buy' ? 'text-green-400' : 'text-red-400';
            return (
              <div key={i}>
                <span className={color}>{varName}</span>
                <span className="text-gray-500"> = (</span>
                <span className="text-gray-200 whitespace-pre-wrap">{line.expr}</span>
                <span className="text-gray-500">)</span>
              </div>
            );
          }
          return null;
        })}
        {lines.length === 0 && (
          <div className="text-gray-700 italic">조건을 추가하면 코드가 자동 생성됩니다</div>
        )}
      </div>
    </div>
  );
}

function countFactorUsage(varName, buyConditions, sellConditions) {
  const all = [...buyConditions, ...sellConditions];
  return all.filter(row =>
    row.leftKey?.startsWith(`f:${varName}::`) ||
    row.rightKey?.startsWith(`f:${varName}::`)
  ).length;
}

const StrategyEditorTab = ({
  selectedFactors, onUpdateFactor, onRemoveFactor,
  name, setName,
  buyConditions, sellConditions,
  buyLogic, sellLogic,
  onAddBuy, onChangeBuy, onRemoveBuy, onBuyLogicChange,
  onAddSell, onChangeSell, onRemoveSell, onSellLogicChange,
  varOptions,
  stopLoss, setStopLoss,
  takeProfit, setTakeProfit,
  capital, setCapital,
  notes, setNotes,
  onSave, onSaveNew, saving,
}) => {
  const [showCode, setShowCode] = useState(false);

  const factorById = useMemo(() => {
    const m = {};
    STRATEGY_FACTORS.forEach(f => { m[f.id] = f; });
    return m;
  }, []);

  const inputCls = 'w-full px-2.5 py-1.5 bg-[#0a0a0f] border border-gray-700/80 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500/70 transition-colors';

  const SectionLabel = ({ children }) => (
    <div className="text-[9px] font-semibold text-gray-600 uppercase tracking-widest mb-2.5 pb-1.5 border-b border-gray-800/60">
      {children}
    </div>
  );

  const totalConditions = buyConditions.length + sellConditions.length;

  return (
    <div className="flex h-full overflow-hidden">

      {/* ══ LEFT: Variables Panel ══ */}
      <div className="w-[380px] flex-shrink-0 flex flex-col overflow-hidden border-r border-gray-800">

        <div className="px-4 py-3 border-b border-gray-800 bg-[#0a0a0f] shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white">Variables</span>
              {selectedFactors.length > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 bg-cyan-900/30 text-cyan-400 border border-cyan-800/40 rounded-full tabular-nums">
                  {selectedFactors.length}
                </span>
              )}
            </div>
            {selectedFactors.length > 0 && totalConditions > 0 && (
              <span className="text-[9px] text-gray-600">
                {totalConditions}개 조건 정의됨
              </span>
            )}
          </div>

          {selectedFactors.length === 0 ? (
            <p className="text-[10px] text-gray-700 mt-1.5 leading-relaxed">
              상단 탭 (Macro · Micro · Stock · Alt Data) 에서<br />
              팩터를 <span className="text-cyan-600">+ Add</span>하면 여기에 표시됩니다
            </p>
          ) : (
            <p className="text-[10px] text-gray-700 mt-1.5">
              오른쪽 조건 빌더에서 팩터를 선택해 조건을 만드세요
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {selectedFactors.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-8">
              <FlaskConical size={32} className="text-gray-800 mb-3" />
              <p className="text-[11px] text-gray-700 max-w-[200px] leading-relaxed">
                팩터를 추가하면<br />여기에 카드로 표시되고<br />조건 빌더에서 사용할 수 있습니다
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-[10px] text-gray-700">
                <ArrowRight size={11} className="text-cyan-800" />
                <span>상단 탭 → + Add</span>
              </div>
            </div>
          ) : (
            selectedFactors.map(item => (
              <AddedFactorRow
                key={item.varName}
                item={item}
                factor={factorById[item.factorId]}
                onUpdate={upd => onUpdateFactor(item.varName, upd)}
                onRemove={() => onRemoveFactor(item.varName)}
                usedCount={countFactorUsage(item.varName, buyConditions, sellConditions)}
              />
            ))
          )}
        </div>

        {varOptions.filter(o => !o.key.startsWith('p:')).length > 0 && (
          <div className="border-t border-gray-800 px-3 py-3 bg-[#060608] shrink-0 max-h-[160px] overflow-y-auto">
            <div className="text-[9px] font-semibold text-gray-700 uppercase tracking-widest mb-2">
              조건 빌더 변수 목록
            </div>
            <div className="space-y-1">
              {varOptions.filter(o => !o.key.startsWith('p:')).map(o => {
                const parts = o.label.split(' · ');
                return (
                  <div key={o.key} className="flex items-center gap-1.5 text-[10px]">
                    <code className="text-cyan-400 font-mono shrink-0">{parts[0]}</code>
                    <span className="text-gray-800">=</span>
                    <span className="text-gray-600 truncate">{parts.slice(1).join(' · ')}</span>
                  </div>
                );
              })}
              <div className="mt-1.5 pt-1.5 border-t border-gray-800/60">
                <span className="text-[9px] text-gray-700">+ Close · High · Low · Open · Volume (항상 사용 가능)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ RIGHT: Strategy Builder Panel ══ */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0d12]">
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          <div>
            <SectionLabel>전략 이름</SectionLabel>
            <input
              className={inputCls}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. EMA Momentum + CPI Filter"
            />
          </div>

          <div>
            <SectionLabel>매수 조건 (Buy Conditions)</SectionLabel>
            <ConditionSection
              title="▲ BUY"
              color="text-green-400"
              side="buy"
              conditions={buyConditions}
              logic={buyLogic}
              varOptions={varOptions}
              onAdd={onAddBuy}
              onChange={onChangeBuy}
              onRemove={onRemoveBuy}
              onLogicChange={onBuyLogicChange}
            />
          </div>

          <div>
            <SectionLabel>매도 조건 (Sell Conditions)</SectionLabel>
            <ConditionSection
              title="▼ SELL"
              color="text-red-400"
              side="sell"
              conditions={sellConditions}
              logic={sellLogic}
              varOptions={varOptions}
              onAdd={onAddSell}
              onChange={onChangeSell}
              onRemove={onRemoveSell}
              onLogicChange={onSellLogicChange}
            />
          </div>

          {/* ── Python Code Preview (collapsible) ── */}
          {(buyConditions.length > 0 || sellConditions.length > 0) && (
            <div>
              <div
                onClick={() => setShowCode(v => !v)}
                className="flex items-center gap-2 cursor-pointer select-none"
              >
                <div className="flex items-center gap-1.5 text-[9px] font-semibold text-gray-600 uppercase tracking-widest mb-2.5 pb-1.5 border-b border-gray-800/60 flex-1">
                  <Code size={10} />
                  수식 코드 미리보기
                  <span className="normal-case font-normal text-gray-700 ml-1">
                    {showCode ? '▲ 숨기기' : '▼ 펼치기'}
                  </span>
                </div>
              </div>
              {showCode && (
                <PseudoCodeView
                  name={name}
                  selectedFactors={selectedFactors}
                  buyConditions={buyConditions}
                  sellConditions={sellConditions}
                  buyLogic={buyLogic}
                  sellLogic={sellLogic}
                  varOptions={varOptions}
                />
              )}
            </div>
          )}

          <div>
            <SectionLabel>리스크 관리 (Risk Management)</SectionLabel>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Stop Loss %',   val: stopLoss,   set: setStopLoss,   step: 0.5, min: 0.1, hint: '손실 제한' },
                { label: 'Take Profit %', val: takeProfit, set: setTakeProfit, step: 0.5, min: 0.1, hint: '익절 목표' },
                { label: 'Capital $',     val: capital,    set: setCapital,    step: 1000, min: 100, hint: '초기 자본' },
              ].map(({ label, val, set, step, min, hint }) => (
                <div key={label} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-gray-600">{label}</span>
                    <span className="text-[9px] text-gray-700">{hint}</span>
                  </div>
                  <input
                    type="number"
                    className={`${inputCls} tabular-nums`}
                    value={val}
                    onChange={e => set(Number(e.target.value))}
                    step={step}
                    min={min}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionLabel>리서치 노트</SectionLabel>
            <textarea
              className={`${inputCls} resize-none leading-relaxed`}
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Market conditions, assumptions, edge cases…"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-800 flex items-center gap-2 shrink-0 bg-[#0a0a0f]">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-xs font-semibold rounded transition-colors"
          >
            <Save size={12} />
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onSaveNew}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-xs rounded transition-colors"
          >
            <Plus size={12} /> Save as New
          </button>

          {(buyConditions.length > 0 || sellConditions.length > 0) && (
            <span className="ml-auto text-[10px] text-gray-600 tabular-nums">
              매수 {buyConditions.length}개 · 매도 {sellConditions.length}개 조건
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default StrategyEditorTab;
