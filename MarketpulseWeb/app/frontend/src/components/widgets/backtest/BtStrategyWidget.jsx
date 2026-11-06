/**
 * BtStrategyWidget — 전략 설정·실행 (Backtest Lab · Backtest 탭).
 *
 * 자산(가격 변수) + 진입/청산 수식(변수·지표·event('이름') 조합) + 보유 봉·방향·비용.
 * 실행은 브라우저 엔진이 하고 결과는 Backtest Results 위젯에 표시된다.
 */
import { useEffect, useMemo, useState } from 'react';
import { Workflow, Play, Save, Plus, Trash2 } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import { Select, SegmentedControl, INPUT_CLS as inputCls } from '../ui';
import useBacktestStore from '../../../store/backtestStore';
import { buildFrame } from '../../backtest/engine/data';
import { eventMask, eventVariableRefs } from '../../backtest/engine/events';
import { runBacktest, strategyRefs } from '../../backtest/engine/backtest';
import { btnPrimary, btnGhost, Field, ErrorText, ExprInput, RangeBar, validateExpr } from '../../backtest/ui';

const PRESETS = [
  { label: 'Golden cross trend', entry: 'cross_above(sma({a}, 50), sma({a}, 200))', exit: 'cross_below(sma({a}, 50), sma({a}, 200))', holdBars: 0 },
  { label: 'RSI oversold bounce', entry: 'rsi({a}, 14) < 30', exit: 'rsi({a}, 14) > 55', holdBars: 20 },
  { label: '20-day high breakout', entry: '{a} >= highest({a}, 20)', exit: '{a} <= lowest({a}, 10)', holdBars: 0 },
  { label: 'Buy -10% drawdown, hold 60 bars', entry: 'drawdown({a}) < -10', exit: '', holdBars: 60 },
];

const blankConfig = (asset = '') => ({ asset, entry: '', exit: '', holdBars: 0, direction: 'long', costBps: 5 });

export default function BtStrategyWidget({ onRemove }) {
  const { items, load, saveItem, deleteItem, range, setLastRun } = useBacktestStore();
  const variables = items.variable;
  const events = items.event;
  const strategies = items.strategy;
  const variableNames = useMemo(() => variables.map((v) => v.name), [variables]);
  const eventNames = useMemo(() => events.map((e) => e.name), [events]);

  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('New strategy');
  const [config, setConfig] = useState(blankConfig());
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!config.asset && variableNames.length) setConfig((c) => ({ ...c, asset: variableNames[0] }));
  }, [variableNames]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch) => setConfig((c) => ({ ...c, ...patch }));

  const pick = (id) => {
    setSelectedId(id);
    setError(null);
    setNotice(null);
    const s = strategies.find((x) => x.item_id === id);
    if (s) {
      setName(s.name);
      setConfig({ ...blankConfig(variableNames[0]), ...s.spec });
    } else {
      setName('New strategy');
      setConfig(blankConfig(variableNames[0]));
    }
  };

  const problem = useMemo(() => {
    if (!config.asset) return 'Pick an asset (price) variable';
    if (!variableNames.includes(config.asset)) return `Asset variable '${config.asset}' does not exist`;
    if (!config.entry.trim()) return 'Enter an entry condition';
    for (const [label, src] of [['Entry', config.entry], ['Exit', config.exit]]) {
      const v = validateExpr(src, { knownVariables: variableNames, knownEvents: eventNames });
      if (v.error) return `${label}: ${v.error}`;
    }
    if (!config.exit.trim() && !(Number(config.holdBars) > 0)) return 'Set an exit condition or a max holding period';
    return null;
  }, [config, variableNames, eventNames]);

  const run = async () => {
    setRunning(true);
    setError(null);
    setNotice(null);
    try {
      const refs = strategyRefs(config);
      const usedEvents = events.filter((e) => refs.events.includes(e.name));
      const targets = [...refs.variables, ...usedEvents.flatMap(eventVariableRefs)];
      const frame = await buildFrame(targets, variables, range);
      const masks = Object.fromEntries(usedEvents.map((e) => [e.name, eventMask(e, frame).mask]));
      const result = runBacktest(frame, config, masks);
      setLastRun({
        name,
        strategyId: selectedId || null,
        config: { ...config, range: { start: range.start, end: range.end } },
        result,
        savedRunId: null,
      });
      setNotice(`${result.metrics.start} – ${result.metrics.end} · ${result.metrics.bars} bars · ${result.metrics.trades} trades — see the Results widget`);
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const spec = {
        asset: config.asset,
        entry: config.entry.trim(),
        exit: config.exit.trim(),
        holdBars: Math.max(0, Math.floor(Number(config.holdBars) || 0)),
        direction: config.direction,
        costBps: Math.max(0, Number(config.costBps) || 0),
      };
      const saved = await saveItem('strategy', { item_id: selectedId || null, name: name.trim(), spec });
      setSelectedId(saved.item_id);
      setNotice(`Saved '${saved.name}'`);
    } catch (e) {
      setError(e.detail || e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const s = strategies.find((x) => x.item_id === selectedId);
    if (!s || !window.confirm(`Delete strategy '${s.name}'?`)) return;
    try {
      await deleteItem(s);
      pick('');
    } catch (e) {
      setError(e.detail || e.message);
    }
  };

  return (
    <BaseWidget
      source="user"
      sourceNote="your strategy rules"
      title="Strategy"
      subtitle="Entry/exit rules · run backtest"
      icon={Workflow}
      onRemove={onRemove}
      loading={running}
      showPeriodSelector={false}
    >
      <div className="flex flex-col h-full min-h-0 p-2 gap-2 overflow-auto">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <Select size="md" align="left" value={selectedId} onChange={pick}
              options={[{ value: '', label: '+ New strategy' }, ...strategies.map((s) => ({ value: s.item_id, label: s.name }))]} />
          </div>
          {selectedId && (
            <button onClick={remove} className={btnGhost} title="Delete strategy"><Trash2 size={11} /></button>
          )}
        </div>

        <Field label="Strategy name">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={inputCls} />
        </Field>

        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
          <Field label="Asset (price variable)" hint="P&L is computed from this variable's returns">
            <Select size="md" align="left" value={config.asset} onChange={(v) => set({ asset: v })}
              placeholder="No variables" options={variableNames} />
          </Field>
          <div className="pb-4">
            <SegmentedControl value={config.direction} onChange={(d) => set({ direction: d })} ariaLabel="Direction"
              options={[{ value: 'long', label: 'Long' }, { value: 'short', label: 'Short' }]} />
          </div>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-gray-600">Presets:</span>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              disabled={!config.asset}
              onClick={() => set({ entry: p.entry.replaceAll('{a}', config.asset), exit: p.exit.replaceAll('{a}', config.asset), holdBars: p.holdBars })}
              className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800/60 text-gray-400 hover:text-cyan-300 disabled:opacity-40"
            >
              {p.label}
            </button>
          ))}
          {eventNames.length > 0 && (
            <button
              onClick={() => set({ entry: `event('${eventNames[0]}')`, exit: '', holdBars: 20 })}
              className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800/60 text-gray-400 hover:text-cyan-300"
            >
              <Plus size={9} className="inline" /> Hold 20 bars after event
            </button>
          )}
        </div>

        <Field label="Entry condition (enter at the close of a true bar)">
          <ExprInput value={config.entry} onChange={(entry) => set({ entry })} knownVariables={variableNames} knownEvents={eventNames} placeholder="cross_above(sma(spy_close, 50), sma(spy_close, 200))" />
        </Field>
        <Field label="Exit condition (optional)">
          <ExprInput value={config.exit} onChange={(exit) => set({ exit })} knownVariables={variableNames} knownEvents={eventNames} placeholder="rsi(spy_close, 14) > 70" />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Max hold (bars, 0 = no limit)">
            <input type="number" min={0} value={config.holdBars} onChange={(e) => set({ holdBars: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Cost (bp, one way)">
            <input type="number" min={0} step={1} value={config.costBps} onChange={(e) => set({ costBps: e.target.value })} className={inputCls} />
          </Field>
        </div>

        <Field label="Range">
          <RangeBar />
        </Field>

        <div className="text-[10px] text-gray-600 leading-relaxed">
          Fills at the close of the signal bar; P&L starts on the next bar (no look-ahead). One full position at a time.
        </div>

        <ErrorText>{error}</ErrorText>
        {notice && <div className="text-[11px] text-emerald-400/90">{notice}</div>}

        <div className="flex items-center justify-between gap-2 flex-shrink-0">
          <span className="text-[10px] text-amber-400/80">{problem}</span>
          <div className="flex gap-1.5">
            <button onClick={save} disabled={!!problem || saving || !name.trim()} className={btnGhost}>
              <Save size={11} /> {saving ? 'Saving…' : 'Save strategy'}
            </button>
            <button onClick={run} disabled={!!problem || running} className={btnPrimary}>
              <Play size={11} /> {running ? 'Running…' : 'Run backtest'}
            </button>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
