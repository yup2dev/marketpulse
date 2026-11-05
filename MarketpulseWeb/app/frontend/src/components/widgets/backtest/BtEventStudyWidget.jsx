/**
 * BtEventStudyWidget — 이벤트 전후 변수 흐름 (Backtest Lab · Event Mapping 탭).
 *
 * 대상 변수 차트에 이벤트 발생일을 세로선으로 매핑하고, 발생일 기준 앞뒤 w봉의
 * 변화(변화율 또는 차이)를 이벤트별 표와 요약(평균·중앙값·상승 비율·범위)으로 보여준다.
 */
import { useEffect, useMemo, useState } from 'react';
import { Crosshair, Play } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import { Select, INPUT_CLS as inputCls, SegmentedControl } from '../ui';
import PlotlyChart from '../../core/PlotlyChart';
import CommonTable from '../../common/CommonTable';
import useBacktestStore from '../../../store/backtestStore';
import { buildFrame } from '../../backtest/engine/data';
import { eventMask, eventVariableRefs, occurrences } from '../../backtest/engine/events';
import { eventStudy, parseWindows } from '../../backtest/engine/study';
import { btnPrimary, Field, ErrorText, Empty, RangeBar, fmt, fmtPct, signCls } from '../../backtest/ui';

const MAX_MARKERS = 150;

export default function BtEventStudyWidget({ onRemove }) {
  const { items, load, range, study, setStudy } = useBacktestStore();
  const variables = items.variable;
  const events = items.event;
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, [load]);

  // 선택값이 비어 있으면 첫 항목으로
  useEffect(() => {
    const patch = {};
    if (!study.event && events.length) patch.event = events[0].name;
    if (!study.target && variables.length) patch.target = variables[0].name;
    if (Object.keys(patch).length) setStudy(patch);
  }, [events, variables]); // eslint-disable-line react-hooks/exhaustive-deps

  const windows = useMemo(() => parseWindows(study.windows), [study.windows]);
  const eventItem = events.find((e) => e.name === study.event);

  const run = async () => {
    if (!eventItem || !study.target) return;
    setLoading(true);
    setError(null);
    try {
      const refs = eventVariableRefs(eventItem);
      const frame = await buildFrame([study.target, ...refs], variables, range);
      const { mask, labels } = eventMask(eventItem, frame);
      const occ = occurrences(mask, frame, labels);
      const values = frame.columns[study.target];
      setResult({ frame, occ, values, ...eventStudy(values, occ, windows, study.mode), target: study.target, event: eventItem, windows });
    } catch (e) {
      setResult(null);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventItem && study.target && windows.length) run();
  }, [study.event, study.target, study.mode, study.windows, range.start, range.end, eventItem?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const chartData = useMemo(
    () => (result ? result.frame.dates.map((date, i) => ({ date, value: Number.isFinite(result.values[i]) ? result.values[i] : null })) : []),
    [result],
  );
  const annotations = useMemo(
    () => (result ? result.occ.slice(-MAX_MARKERS).map((o) => ({ x: o.date, label: result.occ.length <= 30 ? (o.label || '') : '', color: result.event.spec?.color })) : []),
    [result],
  );

  const unit = study.mode === 'diff' ? '' : '%';
  const cell = (v) => <span className={signCls(v)}>{study.mode === 'diff' ? fmt(v, 3) : fmtPct(v)}</span>;
  const wLabel = (w) => (w > 0 ? `+${w} bars` : `${w} bars`);

  const summaryColumns = [
    { key: 'window', header: 'Window', renderFn: (w) => wLabel(w) },
    { key: 'count', header: 'Samples', align: 'right' },
    { key: 'mean', header: `Mean${unit && ' %'}`, align: 'right', renderFn: cell },
    { key: 'median', header: 'Median', align: 'right', renderFn: cell },
    { key: 'hit', header: 'Up ratio', align: 'right', renderFn: (v) => (v === null ? '—' : `${v.toFixed(0)}%`) },
    { key: 'min', header: 'Min', align: 'right', renderFn: cell },
    { key: 'max', header: 'Max', align: 'right', renderFn: cell },
  ];
  const rowColumns = [
    { key: 'date', header: 'Date' },
    { key: 'label', header: 'Label', renderFn: (v) => v || '—' },
    { key: 'base', header: 'Value on day', align: 'right', renderFn: (v) => fmt(v) },
    ...(result?.windows || []).map((w) => ({ key: `w${w}`, header: wLabel(w), align: 'right', renderFn: cell })),
  ];

  return (
    <BaseWidget
      title="Event Study"
      subtitle="Event mapping · before/after"
      icon={Crosshair}
      onRemove={onRemove}
      loading={loading}
      onRefresh={eventItem ? run : undefined}
      showPeriodSelector={false}
    >
      <div className="flex flex-col h-full min-h-0 p-2 gap-2 overflow-auto">
        <div className="flex-shrink-0 space-y-1.5">
          <RangeBar />
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
            <Field label="Event">
              <Select size="md" align="left" value={study.event} onChange={(v) => setStudy({ event: v })}
                placeholder="No events" options={events.map((e) => ({ value: e.name, label: e.name }))} />
            </Field>
            <Field label="Target variable">
              <Select size="md" align="left" value={study.target} onChange={(v) => setStudy({ target: v })}
                placeholder="No variables" options={variables.map((v) => ({ value: v.name, label: v.name }))} />
            </Field>
            <Field label="Windows (bars, negative = before)">
              <input value={study.windows} onChange={(e) => setStudy({ windows: e.target.value })} className={`${inputCls} font-mono`} />
            </Field>
            <div className="pb-1">
              <SegmentedControl value={study.mode} onChange={(m) => setStudy({ mode: m })} ariaLabel="Mode" options={[
                { value: 'pct', label: 'Change %', title: 'For prices and indices (percent change)' },
                { value: 'diff', label: 'Difference', title: 'For rates and spreads (level difference)' },
              ]} />
            </div>
          </div>
        </div>

        <ErrorText>{error}</ErrorText>

        {!events.length || !variables.length ? (
          <Empty>Create events in the Events widget and variables in the Variables tab first.</Empty>
        ) : result && (
          <>
            <div className="text-[10px] text-gray-500 flex-shrink-0">
              {result.frame.dates[0]} ~ {result.frame.dates[result.frame.dates.length - 1]} · {result.occ.length} occurrences
              {result.occ.length > MAX_MARKERS && ` (chart shows the latest ${MAX_MARKERS})`}
            </div>
            <div className="h-[220px] flex-shrink-0">
              <PlotlyChart data={chartData} series={[{ key: 'value', name: result.target }]} xKey="date" type="line" height={220} showTypeSelector={false} annotations={annotations} />
            </div>
            {result.occ.length ? (
              <>
                <CommonTable data={result.summary} columns={summaryColumns} compact searchable={false} exportable={false} pageSize={10} />
                <CommonTable data={[...result.rows].reverse()} columns={rowColumns} compact searchable exportable pageSize={10} />
              </>
            ) : (
              <Empty>The event did not occur in the selected range.</Empty>
            )}
          </>
        )}
        {!result && !loading && !error && eventItem && (
          <button onClick={run} className={`${btnPrimary} self-start`}><Play size={11} /> Analyze</button>
        )}
      </div>
    </BaseWidget>
  );
}
