/**
 * BtEventStudyWidget — 이벤트 전후 변수 흐름 (Backtest Lab · Event Mapping 탭).
 *
 * 대상 변수 차트에 이벤트 발생일을 세로선으로 매핑하고, 발생일 기준 앞뒤 w봉의
 * 변화(변화율 또는 차이)를 이벤트별 표와 요약(평균·중앙값·상승 비율·범위)으로 보여준다.
 */
import { useEffect, useMemo, useState } from 'react';
import { Crosshair, Play } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import PlotlyChart from '../../core/PlotlyChart';
import CommonTable from '../../common/CommonTable';
import useBacktestStore from '../../../store/backtestStore';
import { buildFrame } from '../../backtest/engine/data';
import { eventMask, eventVariableRefs, occurrences } from '../../backtest/engine/events';
import { eventStudy, parseWindows } from '../../backtest/engine/study';
import { inputCls, btnPrimary, Field, ErrorText, Empty, RangeBar, fmt, fmtPct, signCls } from '../../backtest/ui';

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
  const wLabel = (w) => (w > 0 ? `+${w}봉` : `${w}봉`);

  const summaryColumns = [
    { key: 'window', header: '구간', renderFn: (w) => wLabel(w) },
    { key: 'count', header: '표본', align: 'right' },
    { key: 'mean', header: `평균${unit && ' %'}`, align: 'right', renderFn: cell },
    { key: 'median', header: '중앙값', align: 'right', renderFn: cell },
    { key: 'hit', header: '상승 비율', align: 'right', renderFn: (v) => (v === null ? '—' : `${v.toFixed(0)}%`) },
    { key: 'min', header: '최저', align: 'right', renderFn: cell },
    { key: 'max', header: '최고', align: 'right', renderFn: cell },
  ];
  const rowColumns = [
    { key: 'date', header: '발생일' },
    { key: 'label', header: '라벨', renderFn: (v) => v || '—' },
    { key: 'base', header: '당일 값', align: 'right', renderFn: (v) => fmt(v) },
    ...(result?.windows || []).map((w) => ({ key: `w${w}`, header: wLabel(w), align: 'right', renderFn: cell })),
  ];

  return (
    <BaseWidget
      title="Event Study"
      subtitle="이벤트 매핑 · 전후 흐름"
      icon={Crosshair}
      onRemove={onRemove}
      loading={loading}
      onRefresh={eventItem ? run : undefined}
      showViewToggle={false}
      showPeriodSelector={false}
    >
      <div className="flex flex-col h-full min-h-0 p-2 gap-2 overflow-auto">
        <div className="flex-shrink-0 space-y-1.5">
          <RangeBar />
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
            <Field label="이벤트">
              <select value={study.event} onChange={(e) => setStudy({ event: e.target.value })} className={inputCls}>
                {!events.length && <option value="">(이벤트 없음)</option>}
                {events.map((e) => <option key={e.item_id} value={e.name}>{e.name}</option>)}
              </select>
            </Field>
            <Field label="대상 변수">
              <select value={study.target} onChange={(e) => setStudy({ target: e.target.value })} className={inputCls}>
                {!variables.length && <option value="">(변수 없음)</option>}
                {variables.map((v) => <option key={v.item_id} value={v.name}>{v.name}</option>)}
              </select>
            </Field>
            <Field label="구간 (봉, 음수=이전)">
              <input value={study.windows} onChange={(e) => setStudy({ windows: e.target.value })} className={`${inputCls} font-mono`} />
            </Field>
            <div className="flex gap-1 pb-0.5">
              {[['pct', '변화율'], ['diff', '차이']].map(([m, label]) => (
                <button key={m} onClick={() => setStudy({ mode: m })} className={`px-1.5 py-0.5 rounded text-[10px] ${study.mode === m ? 'bg-cyan-900/60 text-cyan-300' : 'text-gray-500 hover:text-gray-200'}`} title={m === 'diff' ? '금리·스프레드처럼 수준 차이로 볼 변수' : '가격·지수처럼 변화율로 볼 변수'}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <ErrorText>{error}</ErrorText>

        {!events.length || !variables.length ? (
          <Empty>Events 위젯에서 이벤트를, Variables 탭에서 변수를 먼저 만드세요.</Empty>
        ) : result && (
          <>
            <div className="text-[10px] text-gray-500 flex-shrink-0">
              {result.frame.dates[0]} ~ {result.frame.dates[result.frame.dates.length - 1]} · 이벤트 {result.occ.length}회 발생
              {result.occ.length > MAX_MARKERS && ` (차트에는 최근 ${MAX_MARKERS}개 표시)`}
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
              <Empty>선택한 기간에 이벤트가 발생하지 않았습니다.</Empty>
            )}
          </>
        )}
        {!result && !loading && !error && eventItem && (
          <button onClick={run} className={`${btnPrimary} self-start`}><Play size={11} /> 분석</button>
        )}
      </div>
    </BaseWidget>
  );
}
