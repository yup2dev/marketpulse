/**
 * BtResultsWidget — 백테스트 결과 (Backtest Lab · Backtest 탭).
 *
 * 최근 실행 또는 저장된 실행의 자산곡선(전략 vs 보유), 낙폭, 성과 지표, 거래 내역.
 * '결과 저장' 은 다운샘플한 스냅샷을 서버에 보관해 나중에 비교할 수 있게 한다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Save, Trash2 } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import PlotlyChart from '../../core/PlotlyChart';
import CommonTable from '../../common/CommonTable';
import useBacktestStore from '../../../store/backtestStore';
import { backtestAPI } from '../../../config/api';
import { compactResult } from '../../backtest/engine/backtest';
import { btnPrimary, btnGhost, ErrorText, Empty, fmt, fmtPct, signCls } from '../../backtest/ui';

const VIEWS = [['summary', '요약'], ['trades', '거래'], ['runs', '저장된 실행']];

function Metric({ label, value, bench, pct = true, digits = 2 }) {
  const show = (v) => (pct ? fmtPct(v, digits) : fmt(v, digits));
  return (
    <div className="bg-[#0a0a0f] border border-gray-800 rounded px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-[13px] font-semibold tabular-nums ${pct ? signCls(value) : 'text-gray-100'}`}>{show(value)}</div>
      {bench !== undefined && <div className="text-[9px] text-gray-600 tabular-nums">보유 {show(bench)}</div>}
    </div>
  );
}

export default function BtResultsWidget({ onRemove }) {
  const { lastRun, setLastRun, runsVersion, bumpRuns } = useBacktestStore();
  const [view, setView] = useState('summary');
  const [runs, setRuns] = useState([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const res = await backtestAPI.listRuns();
      setRuns(res.results || []);
    } catch (e) {
      setError(e.detail || e.message);
    } finally {
      setRunsLoading(false);
    }
  }, []);

  useEffect(() => { loadRuns(); }, [loadRuns, runsVersion]);
  useEffect(() => { if (lastRun && !lastRun.savedRunId) setView('summary'); }, [lastRun]);

  const result = lastRun?.result;
  const m = result?.metrics;

  const equityData = useMemo(
    () => (result ? result.equity.map((p) => ({ date: p.date, strategy: (p.strategy - 1) * 100, benchmark: (p.benchmark - 1) * 100 })) : []),
    [result],
  );
  const ddData = useMemo(() => (result ? result.equity.map((p) => ({ date: p.date, drawdown: p.drawdown })) : []), [result]);

  const saveRun = async () => {
    setSaving(true);
    setError(null);
    try {
      const compact = compactResult(result);
      const res = await backtestAPI.saveRun({
        name: lastRun.name || 'Backtest',
        strategy_id: lastRun.strategyId,
        config: lastRun.config,
        ...compact,
      });
      setLastRun({ ...lastRun, savedRunId: res.results?.[0]?.run_id });
      bumpRuns();
    } catch (e) {
      setError(e.detail || e.message);
    } finally {
      setSaving(false);
    }
  };

  const openRun = async (row) => {
    setError(null);
    try {
      const res = await backtestAPI.getRun(row.run_id);
      const data = res.results?.[0];
      if (!data) throw new Error('실행 결과를 찾을 수 없습니다');
      setLastRun({ name: data.name, strategyId: data.strategy_id, config: data.config, result: { equity: data.equity, trades: data.trades, metrics: data.metrics }, savedRunId: data.run_id });
      setView('summary');
    } catch (e) {
      setError(e.detail || e.message);
    }
  };

  const deleteRun = async (row) => {
    if (!window.confirm(`저장된 실행 '${row.name}' 을(를) 삭제할까요?`)) return;
    try {
      await backtestAPI.deleteRun(row.run_id);
      if (lastRun?.savedRunId === row.run_id) setLastRun({ ...lastRun, savedRunId: null });
      bumpRuns();
    } catch (e) {
      setError(e.detail || e.message);
    }
  };

  const pctCell = (v) => <span className={signCls(v)}>{fmtPct(v)}</span>;
  const tradeColumns = [
    { key: 'entryDate', header: '진입일' },
    { key: 'entryPrice', header: '진입가', align: 'right', renderFn: (v) => fmt(v) },
    { key: 'exitDate', header: '청산일', renderFn: (v, row) => (row.open ? <span className="text-amber-400">{v} (보유 중)</span> : v) },
    { key: 'exitPrice', header: '청산가', align: 'right', renderFn: (v) => fmt(v) },
    { key: 'bars', header: '보유 봉', align: 'right' },
    { key: 'returnPct', header: '수익률', align: 'right', renderFn: pctCell },
  ];
  const runColumns = [
    { key: 'name', header: '이름' },
    { key: 'created_at', header: '저장', renderFn: (v) => (v ? v.slice(0, 16).replace('T', ' ') : '—') },
    { key: 'total', header: '총수익', align: 'right', accessorFn: (r) => r.metrics?.totalReturn, renderFn: pctCell },
    { key: 'cagr', header: 'CAGR', align: 'right', accessorFn: (r) => r.metrics?.cagr, renderFn: pctCell },
    { key: 'sharpe', header: 'Sharpe', align: 'right', accessorFn: (r) => r.metrics?.sharpe, renderFn: (v) => fmt(v) },
    { key: 'mdd', header: 'MDD', align: 'right', accessorFn: (r) => r.metrics?.maxDrawdown, renderFn: pctCell },
    {
      key: 'actions', header: '', sortable: false, accessorFn: () => null,
      renderFn: (_, row) => (
        <span className="flex gap-2 justify-end">
          <button onClick={(e) => { e.stopPropagation(); openRun(row); }} className="text-cyan-400 hover:text-cyan-300 text-[10px]">열기</button>
          <button onClick={(e) => { e.stopPropagation(); deleteRun(row); }} className="text-gray-500 hover:text-red-400"><Trash2 size={11} /></button>
        </span>
      ),
    },
  ];

  return (
    <BaseWidget
      title="Backtest Results"
      subtitle={lastRun ? `${lastRun.name}${lastRun.savedRunId ? ' · 저장됨' : ''}` : '실행 결과'}
      icon={BarChart3}
      onRemove={onRemove}
      loading={runsLoading && view === 'runs'}
      onRefresh={loadRuns}
      showViewToggle={false}
      showPeriodSelector={false}
      headerExtra={result && !lastRun.savedRunId ? (
        <button onClick={saveRun} disabled={saving} className={btnGhost}><Save size={11} /> {saving ? '저장 중…' : '결과 저장'}</button>
      ) : null}
    >
      <div className="flex flex-col h-full min-h-0 p-2 gap-2 overflow-auto">
        <div className="flex items-center gap-1 flex-shrink-0">
          {VIEWS.map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} className={`px-2 py-0.5 rounded text-[11px] ${view === v ? 'bg-cyan-900/60 text-cyan-300' : 'text-gray-500 hover:text-gray-200'}`}>
              {label}{v === 'trades' && result ? ` ${result.trades.length}` : ''}{v === 'runs' ? ` ${runs.length}` : ''}
            </button>
          ))}
        </div>

        <ErrorText>{error}</ErrorText>

        {view === 'runs' && (
          runs.length
            ? <CommonTable data={runs} columns={runColumns} compact searchable exportable={false} pageSize={10} onRowClick={openRun} />
            : <Empty>저장된 실행이 없습니다. 실행 후 '결과 저장' 을 누르면 여기에 쌓입니다.</Empty>
        )}

        {view !== 'runs' && !result && (
          <Empty>Strategy 위젯에서 전략을 설정하고 '백테스트 실행' 을 누르세요.</Empty>
        )}

        {view === 'summary' && result && (
          <>
            <div className="text-[10px] text-gray-500 flex-shrink-0 font-mono truncate" title={`${lastRun.config.entry} / ${lastRun.config.exit}`}>
              {lastRun.config.asset} · {lastRun.config.direction === 'short' ? '숏' : '롱'} · 진입 {lastRun.config.entry}
              {lastRun.config.exit ? ` · 청산 ${lastRun.config.exit}` : ''}{Number(lastRun.config.holdBars) > 0 ? ` · 최대 ${lastRun.config.holdBars}봉` : ''} · 비용 {lastRun.config.costBps}bp
            </div>
            <div className="grid grid-cols-4 gap-1.5 flex-shrink-0">
              <Metric label="총수익" value={m.totalReturn} bench={m.benchmark?.totalReturn} />
              <Metric label="CAGR" value={m.cagr} bench={m.benchmark?.cagr} />
              <Metric label="최대낙폭" value={m.maxDrawdown} bench={m.benchmark?.maxDrawdown} />
              <Metric label="Sharpe" value={m.sharpe} bench={m.benchmark?.sharpe} pct={false} />
              <Metric label="변동성(연) %" value={m.volatility} bench={m.benchmark?.volatility} pct={false} />
              <Metric label="승률 %" value={m.winRate} pct={false} digits={0} />
              <Metric label="평균 거래" value={m.avgTrade} />
              <Metric label="노출도 %" value={m.exposure} pct={false} digits={0} />
            </div>
            <div className="text-[10px] text-gray-600 flex-shrink-0">
              {m.start} ~ {m.end} · {m.bars}봉 · 거래 {m.trades}회 · Sortino {fmt(m.sortino)} · Calmar {fmt(m.calmar)} · 최고/최저 거래 {fmtPct(m.bestTrade)} / {fmtPct(m.worstTrade)}
            </div>
            <div className="h-[220px] flex-shrink-0">
              <PlotlyChart
                data={equityData}
                series={[{ key: 'strategy', name: '전략 누적수익 %', color: '#06b6d4' }, { key: 'benchmark', name: '단순 보유 %', color: '#6b7280' }]}
                xKey="date"
                type="line"
                height={220}
                showTypeSelector={false}
                referenceLines={[{ y: 0 }]}
              />
            </div>
            <div className="h-[120px] flex-shrink-0">
              <PlotlyChart data={ddData} series={[{ key: 'drawdown', name: '낙폭 %', color: '#ef4444' }]} xKey="date" type="area" height={120} showTypeSelector={false} compact />
            </div>
            {!lastRun.savedRunId && (
              <button onClick={saveRun} disabled={saving} className={`${btnPrimary} self-start`}><Save size={11} /> {saving ? '저장 중…' : '결과 저장'}</button>
            )}
          </>
        )}

        {view === 'trades' && result && (
          result.trades.length
            ? <CommonTable data={[...result.trades].reverse()} columns={tradeColumns} compact searchable={false} exportable pageSize={15} />
            : <Empty>거래가 발생하지 않았습니다 — 진입 조건이 기간 내 한 번도 참이 되지 않았습니다.</Empty>
        )}
      </div>
    </BaseWidget>
  );
}
