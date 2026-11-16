/**
 * ChartStudioWidget — 리디자인 시안의 차트 화면 (design/mockups/Chart.dc.html).
 *
 *   [종목] [비교 최대 3] [주기] [캔들·라인·영역] [지표·매크로·이벤트] …… [1·2·4 분할]
 *   [그리기 도구] [차트 칸 …]                                   [설정 패널: 지표 / 매크로 / 이벤트]
 *
 * - 1분할: 비교 종목을 기준 종목 가격에 맞춰 겹친다. 2·4분할: 기준 종목과 비교 종목을 칸마다 따로.
 * - 매크로: FRED 시계열 하나를 겹치거나 아래 창에 그린다 (발표일 사이는 직전 값).
 * - 이벤트: 실적 발표 · 배당락을 세로 점선으로 (일봉 · 주봉) + 다음 봉 반응.
 * - 그리기: 추세선 · 사각형 (끌어서 옮기기, 모두 지우기). 봉 간격이나 종목을 바꾸면 지워진다.
 *
 * 값은 전부 실제 응답이다 — 가격 Yahoo Finance, 매크로 FRED, 실적 Polygon, 배당 Yahoo.
 */
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import WidgetCard, { HeaderSeg } from '../common/WidgetCard';
import { WidgetState, stateFromError, useWidgetState, useWidgetSymbol, usePopover, PANEL_CLS } from '../ui';
import SymbolAutocomplete from '../../common/SymbolAutocomplete';
import { cachedRequest, normalizeBars, pick } from '../../../mp-widgets/data';
import { fmtPct, toneOf } from '../../../mp-widgets/format';
import { LineSwatch, Switch } from '../../../mp-widgets/views/parts';
import ChartPane from './ChartPane';
import { alignToBars, barIndexOf, correlation } from './indicators';

const INTERVALS = [
  { id: '5m', label: '5분', period: '5d', show: 156 },
  { id: '15m', label: '15분', period: '1mo', show: 160 },
  { id: '1h', label: '1시간', period: '3mo', show: 180 },
  { id: '1d', label: '일', period: '2y', show: 180 },
  { id: '1wk', label: '주', period: '10y', show: 200 },
];
const TYPES = [
  { id: 'candle', label: '캔들', icon: 'M7 3v4M7 17v4M5 7h4v10H5zM17 4v4M17 15v5M15 8h4v7h-4z' },
  { id: 'line', label: '라인', icon: 'M3 17l5-6 4 3 8-9' },
  { id: 'area', label: '영역', icon: 'M3 20V17l5-6 4 3 8-9v15z' },
];
const LAYOUTS = [
  { id: 1, label: '1분할', icon: 'M4 4h16v16H4z' },
  { id: 2, label: '2분할', icon: 'M4 4h16v16H4zM12 4v16' },
  { id: 4, label: '4분할', icon: 'M4 4h16v16H4zM12 4v16M4 12h16' },
];
const TOOLS = [
  { id: 'cursor', label: '커서 — 끌어서 기간 옮기기', icon: 'M5 3l14 8-6 2-2 6z' },
  { id: 'trend', label: '추세선 — 끌어서 긋기', icon: 'M4 19L20 5M4 19h.01M20 5h.01' },
  { id: 'rect', label: '사각형 — 끌어서 그리기', icon: 'M5 6h14v12H5z' },
  { id: 'erase', label: '그림 모두 지우기', icon: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13' },
];
const INDICATORS = [
  { id: 'ma20', name: '이동평균 20', desc: '단순 · 종가', on: true },
  { id: 'ma60', name: '이동평균 60', desc: '단순 · 종가', on: true, dash: '4 3' },
  { id: 'bb', name: '볼린저 밴드', desc: '20, 2σ', on: false },
  { id: 'vol', name: '거래량', desc: '하단 막대', on: true },
  { id: 'rsi', name: 'RSI', desc: '14 · 보조창', on: true },
  { id: 'macd', name: 'MACD', desc: '12, 26, 9 · 보조창', on: false },
];
const pct2 = (v) => `${Number(v).toFixed(2)}%`;
const MACROS = [
  { id: 'DGS10', name: '미국 10년물 금리', src: 'FRED · DGS10', format: pct2, unit: '%p' },
  { id: 'DGS2', name: '미국 2년물 금리', src: 'FRED · DGS2', format: pct2, unit: '%p' },
  { id: 'DFEDTARU', name: '기준금리 (상단)', src: 'FRED · DFEDTARU', format: pct2, unit: '%p' },
  { id: 'VIXCLS', name: 'VIX', src: 'FRED · VIXCLS', format: (v) => Number(v).toFixed(2) },
  { id: 'DEXKOUS', name: '원/달러 환율', src: 'FRED · DEXKOUS', format: (v) => Number(v).toLocaleString('en-US', { maximumFractionDigits: 1 }) },
];
const EVENTS = [
  { id: 'earn', letter: 'E', label: '실적 발표', desc: '분기 실적', path: '/stock/earnings/{symbol}?period=3y', on: true },
  { id: 'div', letter: 'D', label: '배당락', desc: '분기 배당', path: '/stock/dividends/{symbol}?period=3y', on: false },
];
const MAX_COMPARE = 3;
const defaults = (list) => Object.fromEntries(list.map((x) => [x.id, x.on]));

function Icon({ d, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** 아이콘 한 줄 선택 (차트 종류 · 분할) */
function IconSeg({ value, options, onChange, ariaLabel }) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex gap-0.5 flex-shrink-0">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={o.id === value}
          aria-label={o.label}
          title={o.label}
          onClick={() => onChange(o.id)}
          className={`w-8 h-7 rounded-md flex items-center justify-center transition-colors ${o.id === value ? 'bg-[var(--mp-chip-on)] text-[var(--mp-text)]' : 'text-[var(--mp-muted)] hover:text-[var(--mp-text)]'}`}
        >
          <Icon d={o.icon} />
        </button>
      ))}
    </div>
  );
}

/** 종목 고르기 — 누르면 검색 상자가 뜬다 */
function SymbolPicker({ onSelect, children, title, className }) {
  const picker = usePopover();
  return (
    <div ref={picker.ref} className="relative flex-shrink-0">
      <button type="button" onClick={picker.toggle} aria-haspopup="dialog" aria-expanded={picker.open} title={title} className={className}>
        {children}
      </button>
      {picker.open && (
        <div className={`${PANEL_CLS} left-0 w-64 p-2`}>
          <SymbolAutocomplete
            value=""
            onChange={() => {}}
            onSelect={(s) => { onSelect(s.symbol.toUpperCase()); picker.close(); }}
            placeholder="종목 검색"
            compact
          />
        </div>
      )}
    </div>
  );
}

/** 경로들을 받아 { 경로: 행 } 으로 — 도착하는 대로 채운다. 실패한 경로는 errors 에 */
function useRows(paths) {
  const [rows, setRows] = useState({});
  const [errors, setErrors] = useState({});
  const key = paths.join('\n');
  useEffect(() => {
    let alive = true;
    for (const path of key ? key.split('\n') : []) {
      cachedRequest(path).then(
        (res) => { if (alive) setRows((prev) => ({ ...prev, [path]: pick(res) || [] })); },
        (err) => { if (alive) setErrors((prev) => ({ ...prev, [path]: err })); },
      );
    }
    return () => { alive = false; };
  }, [key]);
  return { rows, errors };
}

const eventDate = (r) => r.date || r.report_date || r.ex_dividend_date || r.period_ending || r.fiscal_date;

export default function ChartStudioWidget({ symbol: pageSymbol, onRemove }) {
  const [symbol, setSymbol] = useWidgetSymbol(pageSymbol, 'AAPL');
  const [iv, setIv] = useWidgetState('iv', '1d');
  const [type, setType] = useWidgetState('type', 'candle');
  const [layout, setLayout] = useWidgetState('layout', 1);
  const [compare, setCompare] = useWidgetState('compare', []);
  const [ind, setInd] = useWidgetState('ind', () => defaults(INDICATORS));
  const [macroId, setMacroId] = useWidgetState('macro', '');
  const [macroMode, setMacroMode] = useWidgetState('macroMode', 'overlay');
  const [evOn, setEvOn] = useWidgetState('events', () => defaults(EVENTS));
  const [side, setSide] = useWidgetState('side', 'ind');      // 'ind' | 'macro' | 'event' | '' (접음)
  const [tool, setTool] = useState('cursor');
  const [shapes, setShapes] = useState([]);

  const interval = INTERVALS.find((x) => x.id === iv) || INTERVALS[3];
  const daily = iv === '1d' || iv === '1wk';
  const others = compare.filter((s) => s !== symbol).slice(0, MAX_COMPARE);
  const symbols = [symbol, ...others];
  const barPath = (s) => `/stock/history/${encodeURIComponent(s)}?period=${interval.period}&interval=${interval.id}`;
  const macroDef = MACROS.find((m) => m.id === macroId);
  const macroPath = macroDef ? `/data/fred/series?series_id=${macroDef.id}&period=${iv === '1wk' ? '10y' : '5y'}` : null;
  const eventPaths = daily ? EVENTS.filter((e) => evOn[e.id]).map((e) => e.path.replace('{symbol}', encodeURIComponent(symbol))) : [];

  const { rows, errors } = useRows([...symbols.map(barPath), ...(macroPath ? [macroPath] : []), ...eventPaths]);

  // 그린 도형은 봉 자리에 묶여 있다 — 봉이 바뀌면 지운다
  useEffect(() => { setShapes([]); }, [symbol, iv]);

  const bars = useMemo(() => normalizeBars(rows[barPath(symbol)]), [rows, symbol, iv]);   // eslint-disable-line react-hooks/exhaustive-deps
  const dates = useMemo(() => bars.map((b) => String(b.date)), [bars]);

  // 비교 종목 — 기준 종목의 봉 날짜에 맞춘 종가
  const compares = useMemo(() => others.map((s) => {
    const byDate = new Map(normalizeBars(rows[barPath(s)]).map((b) => [String(b.date), b.close]));
    return { symbol: s, bars: normalizeBars(rows[barPath(s)]), values: dates.map((d) => byDate.get(d) ?? null) };
  }), [rows, others.join(','), dates, iv]);   // eslint-disable-line react-hooks/exhaustive-deps

  const macroValues = useMemo(
    () => (macroPath && rows[macroPath] ? alignToBars(rows[macroPath], dates) : null),
    [rows, macroPath, dates],
  );
  const macro = macroDef && macroValues?.some((v) => v != null)
    ? { name: macroDef.name, values: macroValues, format: (v) => (v == null ? '—' : macroDef.format(v)), mode: macroMode }
    : null;

  // 이벤트 — 같은 봉에 겹치면 글자를 이어 붙인다. 목록에는 다음 봉의 반응을 적는다
  const from = Math.max(0, bars.length - interval.show);
  const eventList = useMemo(() => {
    const out = [];
    for (const def of EVENTS) {
      const list = rows[def.path.replace('{symbol}', encodeURIComponent(symbol))];
      if (!daily || !evOn[def.id] || !list) continue;
      for (const r of list) {
        const date = eventDate(r);
        const index = date ? barIndexOf(date, dates) : -1;
        if (index < 0) continue;
        const next = bars[index + 1];
        out.push({
          index, date: String(date).slice(0, 10), letter: def.letter,
          title: def.id === 'div' && r.dividend != null ? `${def.label} $${Number(r.dividend).toFixed(2)}` : def.label,
          react: next ? (next.close / bars[index].close - 1) * 100 : null,
        });
      }
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [rows, symbol, daily, evOn, dates, bars]);
  const marks = useMemo(() => {
    const byIndex = new Map();
    for (const e of eventList) {
      const cur = byIndex.get(e.index) || { index: e.index, letters: [], titles: [] };
      cur.letters.push(e.letter);
      cur.titles.push(`${e.date} ${e.title}`);
      byIndex.set(e.index, cur);
    }
    return [...byIndex.values()].map((m) => ({ index: m.index, letters: m.letters.join('·'), title: m.titles.join(' / ') }));
  }, [eventList]);
  const visibleEvents = eventList.filter((e) => e.index >= from);

  const pickTool = (id) => {
    if (id === 'erase') { setShapes([]); setTool('cursor'); } else setTool(id);
  };
  const toggleSide = (tab) => setSide(side === tab ? '' : tab);
  const indCount = INDICATORS.filter((x) => ind[x.id]).length;
  const tabs = [
    { id: 'ind', label: '지표', n: indCount },
    { id: 'macro', label: '매크로', n: macro ? 1 : 0 },
    { id: 'event', label: '이벤트', n: visibleEvents.length },
  ];

  // 매크로 요약 — 보이는 구간에서
  const macroSeen = macro ? macro.values.slice(from).filter((v) => v != null) : [];
  const macroCorr = macro ? correlation(bars.slice(from).map((b) => b.close), macro.values.slice(from)) : null;
  const macroDelta = macroSeen.length > 1 ? macroSeen[macroSeen.length - 1] - macroSeen[0] : null;

  const mainError = errors[barPath(symbol)];
  const loading = !rows[barPath(symbol)] && !mainError;
  let state = null;
  if (loading) state = <WidgetState kind="loading" />;
  else if (mainError) state = <WidgetState {...stateFromError(mainError)} compact />;
  else if (bars.length < 2) state = <WidgetState kind="empty" title={`${symbol} 차트 데이터가 없어요`} compact />;

  const split = layout > 1;
  const paneSymbols = split ? symbols.slice(0, layout) : [symbol];
  const chip = 'h-7 px-2.5 rounded-md text-xs transition-colors';

  return (
    <WidgetCard
      title="차트"
      source={['yahoo', macro && 'fred'].filter(Boolean)}
      sourceNote={`${interval.label}봉`}
      actions={<IconSeg value={layout} options={LAYOUTS} onChange={setLayout} ariaLabel="화면 분할" />}
      onRemove={onRemove}
    >
      <div className="h-full flex flex-col min-h-0">
        {/* 툴바 */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-2 pb-2 flex-shrink-0">
          <SymbolPicker
            onSelect={setSymbol}
            title="종목 바꾸기"
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-[var(--mp-raised)] font-bold hover:text-[var(--mp-accent)] transition-colors"
          >
            {symbol}<ChevronDown size={12} className="text-[var(--mp-muted)]" />
          </SymbolPicker>
          {others.map((s, i) => (
            <span key={s} className="flex items-center gap-1.5 h-7 pl-2 pr-0.5 rounded-md bg-[var(--mp-raised)] text-xs font-semibold flex-shrink-0">
              <LineSwatch color="var(--mp-text)" width={1.6} dash={['6 3', '2 3', '8 3 2 3'][i]} />{s}
              <button
                type="button"
                aria-label={`${s} 비교 해제`}
                onClick={() => setCompare(others.filter((x) => x !== s))}
                className="w-6 h-6 rounded flex items-center justify-center text-[var(--mp-muted)] hover:text-[var(--mp-text)]"
              >
                <X size={11} />
              </button>
            </span>
          ))}
          {others.length < MAX_COMPARE ? (
            <SymbolPicker
              onSelect={(s) => { if (s !== symbol && !others.includes(s)) setCompare([...others, s]); }}
              title={split ? '칸에 띄울 종목 추가' : '비교 종목 추가 — 구간 시작점을 기준 종목 가격에 맞춰 겹쳐요'}
              className="flex items-center gap-1 h-7 px-2.5 rounded-md border border-dashed border-[var(--mp-chip-on)] text-xs font-semibold text-[var(--mp-text-2)] hover:text-[var(--mp-text)] transition-colors"
            >
              <Plus size={11} />비교 {others.length}/{MAX_COMPARE}
            </SymbolPicker>
          ) : (
            <span className="text-[11px] text-[var(--mp-faint)]">비교 {MAX_COMPARE}/{MAX_COMPARE} · 최대</span>
          )}
          <HeaderSeg value={iv} options={INTERVALS.map((x) => ({ value: x.id, label: x.label }))} onChange={setIv} ariaLabel="주기" />
          <IconSeg value={type} options={TYPES} onChange={setType} ariaLabel="차트 종류" />
          <div role="group" aria-label="설정 패널" className="flex gap-0.5 flex-shrink-0 ml-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={side === t.id}
                onClick={() => toggleSide(t.id)}
                className={`${chip} flex items-center gap-1.5 ${side === t.id ? 'bg-[var(--mp-chip-on)] text-[var(--mp-text)] font-bold' : 'text-[var(--mp-muted)] hover:text-[var(--mp-text)]'}`}
              >
                {t.label}
                {t.n > 0 && <span className="min-w-4 h-4 px-1 rounded-full bg-[var(--mp-tag)] text-[var(--mp-text-2)] text-[10.5px] flex items-center justify-center">{t.n}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex gap-2 px-2 pb-2">
          {/* 그리기 도구 */}
          <div className="w-9 flex-shrink-0 flex flex-col items-center gap-0.5 py-1 rounded-md bg-[var(--mp-tile)]">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={tool === t.id}
                aria-label={t.label}
                title={t.label}
                onClick={() => pickTool(t.id)}
                className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${tool === t.id ? 'bg-[var(--mp-chip-on)] text-[var(--mp-text)]' : 'text-[var(--mp-muted)] hover:bg-[var(--mp-raised)] hover:text-[var(--mp-text)]'} ${t.id === 'erase' ? 'mt-1.5' : ''}`}
              >
                <Icon d={t.icon} size={17} />
              </button>
            ))}
          </div>

          {/* 차트 칸 */}
          <div
            className="flex-1 min-w-0 min-h-0 grid gap-1.5"
            style={{
              gridTemplateColumns: split ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)',
              gridTemplateRows: layout === 4 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)',
            }}
          >
            {state || paneSymbols.map((s, i) => {
              const own = i === 0 ? bars : compares.find((c) => c.symbol === s)?.bars || [];
              if (own.length < 2) {
                return (
                  <div key={s} className="rounded-md border border-[var(--mp-tile-line)] bg-[var(--mp-tile)] flex items-center justify-center text-xs text-[var(--mp-muted)]">
                    {errors[barPath(s)] ? `${s} 데이터를 불러오지 못했어요` : `${s} 불러오는 중…`}
                  </div>
                );
              }
              const ownDates = own.map((b) => String(b.date));
              return (
                <ChartPane
                  key={s}
                  symbol={s}
                  bars={own}
                  intervalLabel={`${interval.label}봉`}
                  show={split ? Math.round(interval.show * (layout === 4 ? 0.5 : 0.7)) : interval.show}
                  type={type}
                  ind={ind}
                  subs={!split}
                  compares={split ? [] : compares}
                  macro={macro && { ...macro, values: i === 0 ? macro.values : alignToBars(rows[macroPath] || [], ownDates), mode: split ? 'overlay' : macro.mode }}
                  events={i === 0 ? marks : []}
                  tool={i === 0 ? tool : 'cursor'}
                  shapes={i === 0 ? shapes : undefined}
                  onShapes={i === 0 ? setShapes : undefined}
                  active={split && i === 0}
                />
              );
            })}
          </div>

          {/* 설정 패널 */}
          {side && (
            <aside aria-label="차트 설정" className="w-60 flex-shrink-0 flex flex-col rounded-md bg-[var(--mp-tile)] overflow-auto text-[13px]">
              <div className="flex items-center h-9 px-3 flex-shrink-0">
                <span className="font-bold text-xs">{tabs.find((t) => t.id === side)?.label}</span>
                <button type="button" aria-label="설정 패널 접기" onClick={() => setSide('')} className="ml-auto w-7 h-7 rounded-md flex items-center justify-center text-[var(--mp-muted)] hover:text-[var(--mp-text)]">
                  <ChevronRight size={15} />
                </button>
              </div>

              {side === 'ind' && (
                <>
                  {INDICATORS.map((d) => (
                    <div key={d.id} className="flex items-center gap-2.5 min-h-[44px] px-3 border-t border-[var(--mpc-grid)]">
                      <LineSwatch color={ind[d.id] ? 'var(--mp-text-2)' : 'var(--mp-grip)'} dash={d.dash} width={d.id === 'vol' ? 4 : 1.6} />
                      <span className="flex-1 min-w-0 flex flex-col">
                        <span className={`font-semibold ${ind[d.id] ? '' : 'text-[var(--mp-muted)]'}`}>{d.name}</span>
                        <span className="text-[11px] text-[var(--mp-muted)]">{d.desc}</span>
                      </span>
                      <Switch checked={!!ind[d.id]} onChange={(v) => setInd({ ...ind, [d.id]: v })} label={`${d.name} 표시`} />
                    </div>
                  ))}
                  <p className="m-0 px-3 py-2.5 text-[11px] text-[var(--mp-faint)]">RSI · MACD 보조창은 1분할에서만 보여요</p>
                </>
              )}

              {side === 'macro' && (
                <>
                  <div className="flex items-center gap-2 px-3 pb-2">
                    <span className="text-xs text-[var(--mp-muted)]">표시</span>
                    <HeaderSeg
                      value={macroMode}
                      options={[{ value: 'overlay', label: '겹쳐 보기' }, { value: 'pane', label: '아래 창' }]}
                      onChange={setMacroMode}
                      ariaLabel="매크로 표시 방식"
                    />
                  </div>
                  <div role="radiogroup" aria-label="매크로 지표">
                    {[{ id: '', name: '없음', src: '가격만 보기' }, ...MACROS].map((m) => {
                      const on = m.id === macroId;
                      return (
                        <button
                          key={m.id || 'none'}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => setMacroId(m.id)}
                          className={`w-full flex items-center gap-2.5 min-h-[44px] px-3 text-left border-t border-[var(--mpc-grid)] transition-colors ${on ? 'bg-[var(--mp-raised)]' : 'hover:bg-[var(--mp-row-hover)]'}`}
                        >
                          <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ border: on ? '4px solid var(--mp-accent)' : '1.5px solid var(--mp-grip)' }} />
                          <span className="flex-1 min-w-0 flex flex-col">
                            <span className="font-semibold">{m.name}</span>
                            <span className="text-[11px] text-[var(--mp-muted)]">{m.src}</span>
                          </span>
                          {on && macro && <span className="font-semibold text-[var(--mp-text-2)]">{macro.format(macro.values[macro.values.length - 1])}</span>}
                        </button>
                      );
                    })}
                  </div>
                  {macroDef && !macro && (
                    <p className="m-0 px-3 py-2.5 text-[11px] text-[var(--mp-muted)]">
                      {errors[macroPath] ? `${macroDef.name} 을(를) 불러오지 못했어요 — FRED 키를 확인해 주세요` : '불러오는 중…'}
                    </p>
                  )}
                  {macro && (
                    <dl className="mx-3 my-2.5 p-2.5 rounded-md bg-[var(--mp-panel)] grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-xs">
                      <dt className="text-[var(--mp-muted)]">{symbol} 가격과 상관계수</dt>
                      <dd className="m-0 text-right font-semibold">{macroCorr == null ? '—' : macroCorr.toFixed(2)}</dd>
                      <dt className="text-[var(--mp-muted)]">표시 구간 변화</dt>
                      <dd className="m-0 text-right font-semibold">
                        {macroDelta == null ? '—' : macroDef.unit
                          ? `${macroDelta >= 0 ? '+' : '−'}${Math.abs(macroDelta).toFixed(2)}${macroDef.unit}`
                          : fmtPct((macroSeen[macroSeen.length - 1] / macroSeen[0] - 1) * 100)}
                      </dd>
                      <dt className="text-[var(--mp-muted)]">구간 범위</dt>
                      <dd className="m-0 text-right text-[var(--mp-text-2)]">{macroSeen.length ? `${macro.format(Math.min(...macroSeen))} – ${macro.format(Math.max(...macroSeen))}` : '—'}</dd>
                    </dl>
                  )}
                  {macro && split && macroMode === 'pane' && (
                    <p className="m-0 px-3 pb-2.5 text-[11px] text-[var(--mp-faint)]">분할 화면에서는 겹쳐 보기로 표시돼요</p>
                  )}
                </>
              )}

              {side === 'event' && (
                <>
                  {EVENTS.map((e) => (
                    <div key={e.id} className="flex items-center gap-2.5 min-h-[44px] px-3 border-t border-[var(--mpc-grid)]">
                      <span className="w-4 h-4 rounded-full bg-[var(--mp-chip-on)] text-[var(--mp-text-2)] text-[9.5px] font-bold flex items-center justify-center flex-shrink-0">{e.letter}</span>
                      <span className="flex-1 min-w-0 flex flex-col">
                        <span className={`font-semibold ${evOn[e.id] ? '' : 'text-[var(--mp-muted)]'}`}>{e.label}</span>
                        <span className="text-[11px] text-[var(--mp-muted)]">{e.desc}</span>
                      </span>
                      <Switch checked={!!evOn[e.id]} onChange={(v) => setEvOn({ ...evOn, [e.id]: v })} label={`${e.label} 표시`} />
                    </div>
                  ))}
                  {!daily && <p className="m-0 px-3 py-2.5 text-[11px] text-[var(--mp-faint)]">이벤트는 일봉 · 주봉에서 날짜에 맞춰 표시돼요</p>}
                  {daily && eventPaths.some((p) => errors[p]) && (
                    <p className="m-0 px-3 py-2.5 text-[11px] text-[var(--mp-muted)]">일부 일정을 불러오지 못했어요 (실적 발표는 Polygon 키가 필요해요)</p>
                  )}
                  {visibleEvents.length > 0 && (
                    <>
                      <p className="m-0 px-3 pt-3 pb-1.5 text-[11px] text-[var(--mp-muted)]">표시 구간 이벤트 · 다음 봉 반응</p>
                      {visibleEvents.map((e) => (
                        <div key={`${e.letter}${e.date}`} className="flex items-center gap-2 min-h-[38px] px-3 border-t border-[var(--mpc-grid)] text-xs">
                          <span className="w-4 h-4 rounded-full bg-[var(--mp-chip-on)] text-[var(--mp-text-2)] text-[9.5px] font-bold flex items-center justify-center flex-shrink-0">{e.letter}</span>
                          <span className="flex-1 min-w-0 flex flex-col">
                            <span className="truncate">{e.title}</span>
                            <span className="text-[11px] text-[var(--mp-faint)]">{e.date}</span>
                          </span>
                          <span className="font-semibold" style={{ color: e.react == null ? 'var(--mp-faint)' : toneOf(e.react) }}>{e.react == null ? '—' : fmtPct(e.react)}</span>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </aside>
          )}
        </div>
      </div>
    </WidgetCard>
  );
}
