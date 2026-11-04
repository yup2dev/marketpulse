/**
 * BtVariableExplorerWidget — 변수들이 어떻게 움직였는지 (Backtest Lab · Variables 탭).
 *
 * 선택한 변수를 같은 날짜 축에 정렬해 차트(원값 / 100 기준 리베이스 / z-score)와
 * 통계표(최근값·기간 변화·범위·z-score·첫 변수와의 일간 변화 상관계수)로 보여준다.
 */
import { useEffect, useMemo, useState } from 'react';
import { Activity, Play } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import PlotlyChart from '../../core/PlotlyChart';
import CommonTable from '../../common/CommonTable';
import useBacktestStore from '../../../store/backtestStore';
import { buildFrame } from '../../backtest/engine/data';
import { btnPrimary, ErrorText, Empty, RangeBar, fmt, fmtPct, signCls } from '../../backtest/ui';

const MODES = [['raw', '원값'], ['rebase', '100 기준'], ['zscore', 'z-score']];

function transform(values, mode) {
  if (mode === 'raw') return values;
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return values;
  if (mode === 'rebase') {
    const base = finite[0];
    return values.map((v) => (Number.isFinite(v) && base !== 0 ? (v / base) * 100 : NaN));
  }
  const mean = finite.reduce((a, b) => a + b, 0) / finite.length;
  const sd = Math.sqrt(finite.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, finite.length - 1));
  return values.map((v) => (Number.isFinite(v) && sd > 0 ? (v - mean) / sd : NaN));
}

function lastFinite(values) {
  for (let i = values.length - 1; i >= 0; i -= 1) if (Number.isFinite(values[i])) return { value: values[i], index: i };
  return { value: NaN, index: -1 };
}

function changeOver(values, bars) {
  const { value, index } = lastFinite(values);
  const j = index - bars;
  if (index < 0 || j < 0 || !Number.isFinite(values[j]) || values[j] === 0) return null;
  return (value / values[j] - 1) * 100;
}

function dailyChanges(values) {
  return values.map((v, i) => (i > 0 && Number.isFinite(v) && Number.isFinite(values[i - 1]) && values[i - 1] !== 0 ? v / values[i - 1] - 1 : NaN));
}

function correlation(a, b) {
  const pairs = a.map((v, i) => [v, b[i]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (pairs.length < 3) return null;
  const mx = pairs.reduce((s, [x]) => s + x, 0) / pairs.length;
  const my = pairs.reduce((s, [, y]) => s + y, 0) / pairs.length;
  let sxy = 0; let sxx = 0; let syy = 0;
  for (const [x, y] of pairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

export default function BtVariableExplorerWidget({ onRemove }) {
  const { items, load, range, explorer, toggleExplorer } = useBacktestStore();
  const variables = items.variable;
  const [mode, setMode] = useState('rebase');
  const [frame, setFrame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, [load]);

  const names = explorer.names.filter((n) => variables.some((v) => v.name === n));

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      setFrame(await buildFrame(names, variables, range));
    } catch (e) {
      setFrame(null);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // 선택·기간이 바뀌면 자동 갱신
  useEffect(() => {
    if (names.length) run();
    else setFrame(null);
  }, [names.join(','), range.start, range.end, variables]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = frame ? names.filter((n) => frame.columns[n]) : [];

  const chartData = useMemo(() => {
    if (!frame) return [];
    const cols = Object.fromEntries(shown.map((n) => [n, transform(frame.columns[n], mode)]));
    return frame.dates.map((date, i) => {
      const row = { date };
      for (const n of shown) row[n] = Number.isFinite(cols[n][i]) ? cols[n][i] : null;
      return row;
    });
  }, [frame, mode, shown.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    if (!frame || !shown.length) return [];
    const baseChanges = dailyChanges(frame.columns[shown[0]]);
    return shown.map((n) => {
      const values = frame.columns[n];
      const finite = values.filter(Number.isFinite);
      const z = transform(values, 'zscore');
      return {
        name: n,
        last: lastFinite(values).value,
        chg1m: changeOver(values, 21),
        chg3m: changeOver(values, 63),
        chgAll: changeOver(values, values.length - 1 - values.findIndex(Number.isFinite)),
        min: finite.length ? Math.min(...finite) : null,
        max: finite.length ? Math.max(...finite) : null,
        z: lastFinite(z).value,
        corr: n === shown[0] ? null : correlation(baseChanges, dailyChanges(values)),
      };
    });
  }, [frame, shown.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const pctCell = (v) => <span className={signCls(v)}>{fmtPct(v)}</span>;
  const columns = [
    { key: 'name', header: '변수', renderFn: (v) => <span className="font-mono">{v}</span> },
    { key: 'last', header: '최근', align: 'right', renderFn: (v) => fmt(v) },
    { key: 'chg1m', header: '1M', align: 'right', renderFn: pctCell },
    { key: 'chg3m', header: '3M', align: 'right', renderFn: pctCell },
    { key: 'chgAll', header: '기간', align: 'right', renderFn: pctCell },
    { key: 'min', header: '최저', align: 'right', renderFn: (v) => fmt(v) },
    { key: 'max', header: '최고', align: 'right', renderFn: (v) => fmt(v) },
    { key: 'z', header: 'z(기간)', align: 'right', renderFn: (v) => fmt(v) },
    { key: 'corr', header: `상관(${shown[0] || '-'})`, align: 'right', renderFn: (v) => fmt(v) },
  ];

  return (
    <BaseWidget
      title="Variable Explorer"
      subtitle="변수 흐름 · 통계 · 상관"
      icon={Activity}
      onRemove={onRemove}
      loading={loading}
      onRefresh={names.length ? run : undefined}
      showViewToggle={false}
      showPeriodSelector={false}
    >
      <div className="flex flex-col h-full min-h-0 p-2 gap-2">
        <div className="flex items-center justify-between gap-2 flex-wrap flex-shrink-0">
          <RangeBar />
          <div className="flex items-center gap-1">
            {MODES.map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)} className={`px-1.5 py-0.5 rounded text-[10px] ${mode === m ? 'bg-cyan-900/60 text-cyan-300' : 'text-gray-500 hover:text-gray-200'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-wrap flex-shrink-0">
          {variables.map((v) => (
            <button
              key={v.item_id}
              onClick={() => toggleExplorer(v.name)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${names.includes(v.name) ? 'border-cyan-700 bg-cyan-900/40 text-cyan-200' : 'border-gray-800 text-gray-500 hover:text-gray-200'}`}
            >
              {v.name}
            </button>
          ))}
          {!variables.length && <span className="text-[10px] text-gray-600">Variables 위젯에서 변수를 먼저 만드세요</span>}
        </div>

        <ErrorText>{error}</ErrorText>

        {!names.length ? (
          <Empty>위의 변수 칩을 눌러 비교할 변수를 고르세요 (최대 8개)</Empty>
        ) : (
          <>
            <div className="flex-1 min-h-[180px]">
              <PlotlyChart
                data={chartData}
                series={shown.map((n) => ({ key: n, name: n }))}
                xKey="date"
                type="line"
                height={180}
                showTypeSelector={false}
              />
            </div>
            <div className="flex-shrink-0 max-h-[40%] overflow-auto">
              <CommonTable data={stats} columns={columns} compact searchable={false} exportable pageSize={10} />
            </div>
          </>
        )}
        {names.length > 0 && !frame && !loading && !error && (
          <button onClick={run} className={`${btnPrimary} self-start`}><Play size={11} /> 불러오기</button>
        )}
      </div>
    </BaseWidget>
  );
}
