/**
 * BtStrategyWidget — 전략 설정·실행 (Backtest Lab · Backtest 탭).
 *
 * 자산(가격 변수) + 진입/청산 수식(변수·지표·event('이름') 조합) + 보유 봉·방향·비용.
 * 실행은 브라우저 엔진이 하고 결과는 Backtest Results 위젯에 표시된다.
 */
import { useEffect, useMemo, useState } from 'react';
import { Workflow, Play, Save, Plus, Trash2 } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import useBacktestStore from '../../../store/backtestStore';
import { buildFrame } from '../../backtest/engine/data';
import { eventMask, eventVariableRefs } from '../../backtest/engine/events';
import { runBacktest, strategyRefs } from '../../backtest/engine/backtest';
import { inputCls, btnPrimary, btnGhost, Field, ErrorText, ExprInput, RangeBar, validateExpr } from '../../backtest/ui';

const PRESETS = [
  { label: '골든크로스 추세추종', entry: 'cross_above(sma({a}, 50), sma({a}, 200))', exit: 'cross_below(sma({a}, 50), sma({a}, 200))', holdBars: 0 },
  { label: 'RSI 과매도 반등', entry: 'rsi({a}, 14) < 30', exit: 'rsi({a}, 14) > 55', holdBars: 20 },
  { label: '20일 신고가 돌파', entry: '{a} >= highest({a}, 20)', exit: '{a} <= lowest({a}, 10)', holdBars: 0 },
  { label: '낙폭 -10% 매수, 60봉 보유', entry: 'drawdown({a}) < -10', exit: '', holdBars: 60 },
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
  const [name, setName] = useState('새 전략');
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
      setName('새 전략');
      setConfig(blankConfig(variableNames[0]));
    }
  };

  const problem = useMemo(() => {
    if (!config.asset) return '자산(가격) 변수를 고르세요';
    if (!variableNames.includes(config.asset)) return `자산 변수 '${config.asset}' 이(가) 없습니다`;
    if (!config.entry.trim()) return '진입 조건을 입력하세요';
    for (const [label, src] of [['진입', config.entry], ['청산', config.exit]]) {
      const v = validateExpr(src, { knownVariables: variableNames, knownEvents: eventNames });
      if (v.error) return `${label}: ${v.error}`;
    }
    if (!config.exit.trim() && !(Number(config.holdBars) > 0)) return '청산 조건 또는 보유 봉 수 중 하나는 필요합니다';
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
      setNotice(`${result.metrics.start} ~ ${result.metrics.end} · ${result.metrics.bars}봉 · 거래 ${result.metrics.trades}회 — 결과 위젯을 확인하세요`);
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
      setNotice(`'${saved.name}' 저장됨`);
    } catch (e) {
      setError(e.detail || e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const s = strategies.find((x) => x.item_id === selectedId);
    if (!s || !window.confirm(`전략 '${s.name}' 을(를) 삭제할까요?`)) return;
    try {
      await deleteItem(s);
      pick('');
    } catch (e) {
      setError(e.detail || e.message);
    }
  };

  return (
    <BaseWidget
      title="Strategy"
      subtitle="진입·청산 규칙 · 백테스트 실행"
      icon={Workflow}
      onRemove={onRemove}
      loading={running}
      showViewToggle={false}
      showPeriodSelector={false}
    >
      <div className="flex flex-col h-full min-h-0 p-2 gap-2 overflow-auto">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <select value={selectedId} onChange={(e) => pick(e.target.value)} className={`${inputCls} flex-1`}>
            <option value="">+ 새 전략</option>
            {strategies.map((s) => <option key={s.item_id} value={s.item_id}>{s.name}</option>)}
          </select>
          {selectedId && (
            <button onClick={remove} className={btnGhost} title="전략 삭제"><Trash2 size={11} /></button>
          )}
        </div>

        <Field label="전략 이름">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={inputCls} />
        </Field>

        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
          <Field label="자산 (가격 변수)" hint="이 변수의 변화율로 손익을 계산합니다">
            <select value={config.asset} onChange={(e) => set({ asset: e.target.value })} className={`${inputCls} font-mono`}>
              {!variableNames.length && <option value="">(변수 없음)</option>}
              {variableNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <div className="flex gap-1 pb-4">
            {[['long', '롱'], ['short', '숏']].map(([d, label]) => (
              <button key={d} onClick={() => set({ direction: d })} className={`px-2 py-0.5 rounded text-[11px] ${config.direction === d ? 'bg-cyan-900/60 text-cyan-300' : 'text-gray-500 hover:text-gray-200'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-gray-600">프리셋:</span>
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
              <Plus size={9} className="inline" /> 이벤트 후 20봉 보유
            </button>
          )}
        </div>

        <Field label="진입 조건 (참인 봉 종가에 진입)">
          <ExprInput value={config.entry} onChange={(entry) => set({ entry })} knownVariables={variableNames} knownEvents={eventNames} placeholder="cross_above(sma(spy_close, 50), sma(spy_close, 200))" />
        </Field>
        <Field label="청산 조건 (선택)">
          <ExprInput value={config.exit} onChange={(exit) => set({ exit })} knownVariables={variableNames} knownEvents={eventNames} placeholder="rsi(spy_close, 14) > 70" />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="최대 보유 (봉, 0=제한 없음)">
            <input type="number" min={0} value={config.holdBars} onChange={(e) => set({ holdBars: e.target.value })} className={inputCls} />
          </Field>
          <Field label="거래 비용 (bp, 편도)">
            <input type="number" min={0} step={1} value={config.costBps} onChange={(e) => set({ costBps: e.target.value })} className={inputCls} />
          </Field>
        </div>

        <Field label="기간">
          <RangeBar />
        </Field>

        <div className="text-[10px] text-gray-600 leading-relaxed">
          신호가 뜬 봉의 종가로 체결하고 다음 봉부터 손익을 반영합니다(미래 데이터 미사용). 포지션은 전량 진입·청산 1개만 보유합니다.
        </div>

        <ErrorText>{error}</ErrorText>
        {notice && <div className="text-[11px] text-emerald-400/90">{notice}</div>}

        <div className="flex items-center justify-between gap-2 flex-shrink-0">
          <span className="text-[10px] text-amber-400/80">{problem}</span>
          <div className="flex gap-1.5">
            <button onClick={save} disabled={!!problem || saving || !name.trim()} className={btnGhost}>
              <Save size={11} /> {saving ? '저장 중…' : '전략 저장'}
            </button>
            <button onClick={run} disabled={!!problem || running} className={btnPrimary}>
              <Play size={11} /> {running ? '실행 중…' : '백테스트 실행'}
            </button>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
