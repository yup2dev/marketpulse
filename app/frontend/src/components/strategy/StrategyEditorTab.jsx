import { useMemo, useState } from 'react';
import {
  FlaskConical, Save, Plus, ArrowRight, Code, CheckCircle2, Circle,
} from 'lucide-react';
import { useFactorCatalog } from '../../data/factorCatalog';
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
  const isCross = row.op === 'crosses_above' || row.op === 'crosses_below';

  const leftStr = (() => {
    if (row.leftType === 'formula') return `(${row.leftFormula || '...'})`;
    const leftOpt = varOptions.find(o => o.key === row.leftKey) || varOptions[0];
    return leftOpt ? leftOpt.label.split(' · ')[0] : '?';
  })();

  const rightStr = (() => {
    if (row.rightType === 'value')   return `${row.rightValue ?? 0}`;
    if (row.rightType === 'formula') return `(${row.rightFormula || '...'})`;
    const rightOpt = varOptions.find(o => o.key === row.rightKey) || varOptions[0];
    return rightOpt ? rightOpt.label.split(' · ')[0] : '?';
  })();

  if (isCross) return `${leftStr}${OP_PYTHON[row.op] || row.op}(${rightStr})`;
  return `${leftStr}${OP_PYTHON[row.op] || ` ${row.op} `}${rightStr}`;
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
    <div className="font-mono text-xs leading-relaxed bg-[#06080c] border border-gray-800 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 bg-[#0a0a0f]">
        <Code size={11} className="text-gray-400" />
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">Python Pseudocode</span>
        <span className="ml-auto text-[10px] text-gray-500">live preview</span>
      </div>
      <div className="p-4 space-y-0.5 overflow-x-auto">
        {lines.map((line, i) => {
          if (line.type === 'blank') return <div key={i} className="h-2" />;
          if (line.type === 'comment') return (
            <div key={i} className="text-gray-500">{line.text}</div>
          );
          if (line.type === 'assign') return (
            <div key={i}>
              <span className="text-cyan-400">{line.varName}</span>
              <span className="text-gray-400"> = </span>
              <span className="text-gray-200">{line.expr}</span>
            </div>
          );
          if (line.type === 'signal') {
            const varName = line.signal === 'buy' ? 'buy_signal' : 'sell_signal';
            const color   = line.signal === 'buy' ? 'text-green-400' : 'text-red-400';
            return (
              <div key={i}>
                <span className={color}>{varName}</span>
                <span className="text-gray-400"> = (</span>
                <span className="text-gray-200 whitespace-pre-wrap">{line.expr}</span>
                <span className="text-gray-400">)</span>
              </div>
            );
          }
          return null;
        })}
        {lines.length === 0 && (
          <div className="text-gray-500 italic">조건을 추가하면 코드가 자동 생성됩니다</div>
        )}
      </div>
    </div>
  );
}

function countFactorUsage(varName, buyConditions, sellConditions) {
  const all = [...buyConditions, ...sellConditions];
  const nameRe = new RegExp(`\\b${varName}(?:_[a-z0-9_]+)?\\b`);
  return all.filter(row => {
    if (row.leftType === 'factor'  && row.leftKey?.startsWith(`f:${varName}::`))  return true;
    if (row.rightType === 'factor' && row.rightKey?.startsWith(`f:${varName}::`)) return true;
    if (row.leftType  === 'formula' && nameRe.test(row.leftFormula  || '')) return true;
    if (row.rightType === 'formula' && nameRe.test(row.rightFormula || '')) return true;
    return false;
  }).length;
}

// ── Section primitive ────────────────────────────────────────────────────────
// 단순화: border-left 한 줄, 숫자 원형 뱃지 1개, 배경 박스 제거.
// accent는 cyan(기본)/green(buy)/red(sell) 3종만.
const ACCENT = {
  cyan:  { text: 'text-cyan-400',  border: 'border-cyan-600/60'  },
  green: { text: 'text-green-400', border: 'border-green-600/60' },
  red:   { text: 'text-red-400',   border: 'border-red-600/60'   },
};

function Section({ step, title, subtitle, accent = 'cyan', badge, children }) {
  const a = ACCENT[accent] || ACCENT.cyan;
  return (
    <section className={`pl-3 border-l-2 ${a.border} space-y-2.5`}>
      <header className="flex items-baseline gap-2">
        {step !== undefined && (
          <span className={`text-[11px] font-semibold tabular-nums ${a.text}`}>
            {String(step).padStart(2, '0')}
          </span>
        )}
        <h3 className="text-xs font-semibold text-gray-100">{title}</h3>
        {subtitle && <span className="text-[11px] text-gray-500">— {subtitle}</span>}
        {badge && <span className="ml-auto">{badge}</span>}
      </header>
      <div>{children}</div>
    </section>
  );
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
  const { factors: STRATEGY_FACTORS } = useFactorCatalog();

  const factorById = useMemo(() => {
    const m = {};
    STRATEGY_FACTORS.forEach(f => { m[f.id] = f; });
    return m;
  }, [STRATEGY_FACTORS]);

  const inputCls = 'w-full px-2.5 py-1.5 bg-[#0a0a0f] border border-gray-700 rounded text-xs text-gray-100 focus:outline-none focus:border-cyan-500 transition-colors';

  const totalConditions = buyConditions.length + sellConditions.length;

  // Validation flags
  const checks = [
    { label: '이름',       ok: name.trim().length > 0 },
    { label: '변수',       ok: selectedFactors.length > 0 },
    { label: '매수 조건',  ok: buyConditions.length > 0 },
    { label: '매도 조건',  ok: sellConditions.length > 0 },
    { label: '리스크',     ok: stopLoss > 0 && takeProfit > 0 },
  ];
  const okCount = checks.filter(c => c.ok).length;
  const ready   = okCount === checks.length;

  return (
    <div className="flex h-full overflow-hidden">

      {/* ══ LEFT: Variables Panel ══ */}
      <div className="w-[380px] flex-shrink-0 flex flex-col overflow-hidden border-r border-gray-800">

        <div className="px-4 py-3 border-b border-gray-800 bg-[#0a0a0f] shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-100">Variables</span>
              {selectedFactors.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-cyan-900/30 text-cyan-400 border border-cyan-800/40 rounded-full tabular-nums">
                  {selectedFactors.length}
                </span>
              )}
            </div>
            {selectedFactors.length > 0 && totalConditions > 0 && (
              <span className="text-[10px] text-gray-500">
                {totalConditions}개 조건 정의됨
              </span>
            )}
          </div>

          {selectedFactors.length === 0 ? (
            <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
              상단 탭 (Macro · Micro · Stock · Alt Data) 에서<br />
              팩터를 <span className="text-cyan-400">+ Add</span>하면 여기에 표시됩니다
            </p>
          ) : (
            <p className="text-[11px] text-gray-500 mt-1.5">
              오른쪽 조건 빌더에서 팩터를 선택해 조건을 만드세요
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {selectedFactors.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-8">
              <FlaskConical size={32} className="text-gray-600 mb-3" />
              <p className="text-[11px] text-gray-500 max-w-[200px] leading-relaxed">
                팩터를 추가하면<br />여기에 카드로 표시되고<br />조건 빌더에서 사용할 수 있습니다
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-[11px] text-gray-500">
                <ArrowRight size={11} className="text-cyan-500" />
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
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
              조건 빌더 변수 목록
            </div>
            <div className="space-y-1">
              {varOptions.filter(o => !o.key.startsWith('p:')).map(o => {
                const parts = o.label.split(' · ');
                return (
                  <div key={o.key} className="flex items-center gap-1.5 text-[11px]">
                    <code className="text-cyan-400 font-mono shrink-0">{parts[0]}</code>
                    <span className="text-gray-500">=</span>
                    <span className="text-gray-400 truncate">{parts.slice(1).join(' · ')}</span>
                  </div>
                );
              })}
              <div className="mt-1.5 pt-1.5 border-t border-gray-800">
                <span className="text-[10px] text-gray-500">+ Close · High · Low · Open · Volume (항상 사용 가능)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ RIGHT: Strategy Builder Panel ══ */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0d12]">

        {/* Compact status bar */}
        <div className="flex items-center gap-3 px-5 py-2 border-b border-gray-800 bg-[#0a0a0f] shrink-0">
          <span className={`text-[11px] font-semibold tabular-nums ${ready ? 'text-green-400' : 'text-cyan-400'}`}>
            {okCount} / {checks.length} 완료
          </span>
          <div className="flex items-center gap-2">
            {checks.map(c => (
              <div key={c.label} className="flex items-center gap-1">
                {c.ok
                  ? <CheckCircle2 size={10} className="text-green-500" />
                  : <Circle       size={10} className="text-gray-500" />}
                <span className={`text-[11px] ${c.ok ? 'text-gray-300' : 'text-gray-500'}`}>
                  {c.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          <Section step={1} title="전략 이름" subtitle="전략을 식별할 이름">
            <input
              className={inputCls}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. EMA Momentum + CPI Filter"
            />
          </Section>

          <Section
            step={2}
            title="매수 조건"
            subtitle="진입 시점을 정의"
            accent="green"
            badge={buyConditions.length > 0 && (
              <span className="text-[11px] text-green-400 tabular-nums">{buyConditions.length}개</span>
            )}
          >
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
          </Section>

          <Section
            step={3}
            title="매도 조건"
            subtitle="청산 시점을 정의"
            accent="red"
            badge={sellConditions.length > 0 && (
              <span className="text-[11px] text-red-400 tabular-nums">{sellConditions.length}개</span>
            )}
          >
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
          </Section>

          {/* ── Python Code Preview (collapsible) ── */}
          {(buyConditions.length > 0 || sellConditions.length > 0) && (
            <section className="pl-3">
              <button
                onClick={() => setShowCode(v => !v)}
                className="flex items-center gap-2 text-[11px] text-gray-400 hover:text-cyan-400 transition-colors"
              >
                <Code size={11} />
                <span className="font-medium">Python Pseudocode Preview</span>
                <span className="text-gray-500">{showCode ? '▲ 숨기기' : '▼ 펼치기'}</span>
              </button>
              {showCode && (
                <div className="mt-2">
                  <PseudoCodeView
                    name={name}
                    selectedFactors={selectedFactors}
                    buyConditions={buyConditions}
                    sellConditions={sellConditions}
                    buyLogic={buyLogic}
                    sellLogic={sellLogic}
                    varOptions={varOptions}
                  />
                </div>
              )}
            </section>
          )}

          <Section step={4} title="리스크 관리" subtitle="손절·익절·자본">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Stop Loss',   unit: '%', val: stopLoss,   set: setStopLoss,   step: 0.5, min: 0.1, hint: '손실 제한' },
                { label: 'Take Profit', unit: '%', val: takeProfit, set: setTakeProfit, step: 0.5, min: 0.1, hint: '익절 목표' },
                { label: 'Capital',     unit: '$', val: capital,    set: setCapital,    step: 1000, min: 100, hint: '초기 자본' },
              ].map(({ label, unit, val, set, step, min, hint }) => (
                <div key={label} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-medium text-gray-300">{label}</span>
                    <span className="text-[10px] text-gray-500">{hint}</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      className={`${inputCls} tabular-nums pr-7`}
                      value={val}
                      onChange={e => set(Number(e.target.value))}
                      step={step}
                      min={min}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-500 pointer-events-none">
                      {unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section step={5} title="리서치 노트" subtitle="가정·시장 조건·엣지 케이스">
            <textarea
              className={`${inputCls} resize-none leading-relaxed`}
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Market conditions, assumptions, edge cases…"
            />
          </Section>
        </div>

        {/* Sticky action bar */}
        <div className="px-5 py-3 border-t border-gray-800 flex items-center gap-2 shrink-0 bg-[#0a0a0f]">
          <button
            onClick={onSave}
            disabled={saving || !ready}
            title={!ready ? '상단 체크리스트를 모두 완료하세요' : 'Save strategy'}
            className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-xs font-semibold rounded transition-colors"
          >
            <Save size={12} />
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onSaveNew}
            disabled={saving || !ready}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-200 text-xs rounded transition-colors"
          >
            <Plus size={12} /> Save as New
          </button>

          <div className="ml-auto flex items-center gap-3 text-[11px] tabular-nums">
            {selectedFactors.length > 0 && (
              <span className="text-gray-400">
                <span className="text-cyan-400 font-semibold">{selectedFactors.length}</span> 변수
              </span>
            )}
            {totalConditions > 0 && (
              <span className="text-gray-400">
                매수 <span className="text-green-400 font-semibold">{buyConditions.length}</span>
                {' · '}
                매도 <span className="text-red-400 font-semibold">{sellConditions.length}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategyEditorTab;
