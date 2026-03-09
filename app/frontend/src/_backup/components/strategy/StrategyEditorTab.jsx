import { useMemo } from 'react';
import { FlaskConical, Save, Plus, ArrowRight } from 'lucide-react';
import { STRATEGY_FACTORS } from '../../data/strategyFactors';
import ConditionSection from './ConditionSection';
import AddedFactorRow from './AddedFactorRow';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Count how many conditions (buy + sell) reference a given varName.
 *  Keys are now `f:<varName>::<BACKEND_FACTOR>` so we match on varName prefix. */
function countFactorUsage(varName, buyConditions, sellConditions) {
  const all = [...buyConditions, ...sellConditions];
  return all.filter(row =>
    row.leftKey?.startsWith(`f:${varName}::`) ||
    row.rightKey?.startsWith(`f:${varName}::`)
  ).length;
}

// ── Component ─────────────────────────────────────────────────────────────────

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

  // Count total conditions defined
  const totalConditions = buyConditions.length + sellConditions.length;

  return (
    <div className="flex h-full overflow-hidden">

      {/* ══════════════════════════════════════════════════════════
          LEFT: Variables Panel
      ══════════════════════════════════════════════════════════ */}
      <div className="w-[380px] flex-shrink-0 flex flex-col overflow-hidden border-r border-gray-800">

        {/* Panel header */}
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

          {/* Guide message */}
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

        {/* Factor list */}
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

        {/* Variable reference (available when factors exist) */}
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
              {/* Price variables (always available) */}
              <div className="mt-1.5 pt-1.5 border-t border-gray-800/60">
                <span className="text-[9px] text-gray-700">+ Close · High · Low · Open · Volume (항상 사용 가능)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          RIGHT: Strategy Builder Panel
      ══════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0d12]">
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* ── Strategy Name ── */}
          <div>
            <SectionLabel>전략 이름</SectionLabel>
            <input
              className={inputCls}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. EMA Momentum + CPI Filter"
            />
          </div>

          {/* ── Buy Conditions ── */}
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

          {/* ── Sell Conditions ── */}
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

          {/* ── Risk Management ── */}
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

          {/* ── Research Notes ── */}
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

        {/* ── Footer: Save buttons ── */}
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

          {/* Quick summary */}
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
