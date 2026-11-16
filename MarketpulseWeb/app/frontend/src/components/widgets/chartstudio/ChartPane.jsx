/**
 * ChartPane — 한 종목의 차트 한 칸: 위에 시세 줄(시·고·저·종 · 지표 값 · 비교), 아래에 Plotly.
 *
 *   가격(캔들·라인·영역) + 이동평균 · 볼린저 · 거래량 · 비교 종목 · 매크로 겹침 · 이벤트 세로선
 *   아래 보조창: 매크로(아래 창 모드) · RSI · MACD — subs 가 true 일 때만 (1분할)
 *
 * 봉은 보이는 구간보다 넉넉히 받는다 — 지표는 전체로 계산하고 처음에는 마지막 show 개만 보여 준다.
 * 커서 도구로 끌면 앞 구간으로 옮겨 간다.
 */
import { useCallback, useMemo } from 'react';
import Plot, { FONT, withAlpha } from '../../../mp-widgets/Plot';
import { fmtNumber, fmtPct, toneOf } from '../../../mp-widgets/format';
import { LineSwatch } from '../../../mp-widgets/views/parts';
import { bollinger, macd, rsi, sma } from './indicators';

const ACCENT = '#3182F6';
const CMP_DASH = ['dash', 'dot', 'dashdot'];
const CMP_SWATCH = ['6 3', '2 3', '8 3 2 3'];
const SUB_H = 0.15;     // 보조창 하나의 높이 (전체 대비)
const SUB_GAP = 0.03;
// 그리기 도구 — 그린 선·사각형을 끌어 옮기거나 지울 수 있다
const DRAW_CONFIG = { edits: { shapePosition: true }, scrollZoom: false };
const DRAGMODE = { cursor: 'pan', trend: 'drawline', rect: 'drawrect', erase: 'pan' };

function tickLabel(date, intraday, long) {
  const m = /(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(date));
  if (!m) return String(date);
  if (intraday && m[4]) return `${m[2]}.${m[3]} ${m[4]}:${m[5]}`;
  return long ? `${m[1].slice(2)}.${m[2]}` : `${m[2]}.${m[3]}`;
}

export default function ChartPane({
  symbol, bars, intervalLabel, show, type, ind, subs,
  compares = [],            // [{ symbol, values }] — 봉에 맞춘 종가 (비교 종목)
  macro,                    // { name, values, format, mode: 'overlay' | 'pane' } | null
  events = [],              // [{ index, letters, title }]
  tool = 'cursor', shapes, onShapes,
  active = false,
}) {
  const n = bars.length;
  const from = Math.max(0, n - show);
  const closes = useMemo(() => bars.map((b) => b.close), [bars]);
  const calc = useMemo(() => ({
    ma20: sma(closes, 20), ma60: sma(closes, 60), bb: bollinger(closes), rsi: rsi(closes), macd: macd(closes),
  }), [closes]);

  const last = bars[n - 1];
  const prev = bars[n - 2];
  const chg = last && prev ? (last.close / prev.close - 1) * 100 : null;
  const viewChg = last && bars[from] ? (last.close / bars[from].close - 1) * 100 : null;
  // 비교 종목은 보이는 구간의 시작점을 기준 종목 가격에 맞춰 겹친다
  const scaled = useMemo(() => compares.map((c) => {
    const base = c.values[from];
    const k = base ? bars[from].close / base : null;
    const end = c.values[n - 1];
    return { symbol: c.symbol, y: c.values.map((v) => (v != null && k ? v * k : null)), chg: base && end ? (end / base - 1) * 100 : null };
  }), [compares, bars, from, n]);

  const macroPane = !!macro && macro.mode === 'pane' && subs;
  const showRsi = subs && ind.rsi;
  const showMacd = subs && ind.macd;

  const figure = useCallback((c) => {
    const x = bars.map((b) => String(b.date));
    const intraday = /[T ]\d{2}:\d{2}/.test(x[0] || '');
    const long = !intraday && show > 150;
    const ticks = [0, 1, 2, 3, 4].map((i) => Math.min(n - 1, from + Math.round(((i + 0.5) * (n - from)) / 5)));
    const tickfont = { color: c.muted, size: 10.5, family: FONT };
    const line = (y, color, width = 1.3, dash) => ({
      type: 'scatter', mode: 'lines', x, y, hoverinfo: 'skip', connectgaps: true, line: { color, width, dash },
    });

    // 아래에서부터 보조창을 쌓고 남는 자리가 가격 창이다
    const panes = [showMacd && 'macd', showRsi && 'rsi', macroPane && 'macro'].filter(Boolean);
    const domains = {};
    let floor = 0;
    for (const p of panes) {
      domains[p] = [floor, floor + SUB_H];
      floor += SUB_H + SUB_GAP;
    }
    const price = [floor, 1];
    const volume = [floor, floor + (1 - floor) * 0.18];

    const up = bars.map((b) => b.close >= b.open);
    const data = [];
    if (ind.vol && bars.some((b) => b.volume)) {
      data.push({
        type: 'bar', x, y: bars.map((b) => b.volume), yaxis: 'y2', hoverinfo: 'skip',
        marker: { color: up.map((u) => (u ? c.up : c.down)), opacity: 0.28 },
      });
    }
    if (ind.bb) {
      data.push(line(calc.bb.upper, c.axis, 1));
      data.push({ ...line(calc.bb.lower, c.axis, 1), fill: 'tonexty', fillcolor: withAlpha(c.text, 0.04) });
    }
    if (type === 'candle') {
      data.push({
        type: 'candlestick', x, name: symbol,
        open: bars.map((b) => b.open), high: bars.map((b) => b.high), low: bars.map((b) => b.low), close: closes,
        increasing: { line: { color: c.up, width: 1 }, fillcolor: c.up },
        decreasing: { line: { color: c.down, width: 1 }, fillcolor: c.down },
      });
    } else {
      data.push({
        type: 'scatter', mode: 'lines', x, y: closes, name: symbol, line: { color: c.text, width: 1.8 },
        fill: type === 'area' ? 'tozeroy' : undefined, fillcolor: withAlpha(c.text, 0.06),
        hovertemplate: '%{y:,.2f}<extra></extra>',
      });
    }
    if (ind.ma20) data.push(line(calc.ma20, c.text, 1.2));
    if (ind.ma60) data.push(line(calc.ma60, c.muted, 1.2, 'dash'));
    scaled.forEach((s, i) => data.push({ ...line(s.y, c.text, 1.5, CMP_DASH[i]), opacity: 0.9 }));
    if (macro && !macroPane) {
      data.push({ ...line(macro.values, ACCENT, 1.8), yaxis: 'y6', hoverinfo: 'y', name: macro.name });
    }
    if (macroPane) data.push({ ...line(macro.values, ACCENT, 1.6), yaxis: 'y5' });
    if (showRsi) data.push({ ...line(calc.rsi, c.text, 1.3), yaxis: 'y3' });
    if (showMacd) {
      data.push({
        type: 'bar', x, y: calc.macd.hist, yaxis: 'y4', hoverinfo: 'skip',
        marker: { color: calc.macd.hist.map((v) => (v >= 0 ? c.up : c.down)), opacity: 0.45 },
      });
      data.push({ ...line(calc.macd.macd, c.text, 1.3), yaxis: 'y4' });
      data.push({ ...line(calc.macd.signal, c.muted, 1.2, 'dash'), yaxis: 'y4' });
    }

    // 세로축 범위는 처음 보이는 구간에 맞춘다 (가격 축은 가격 · 밴드 · 비교 선)
    const seen = (arr) => arr.slice(from).filter((v) => v != null);
    const priceVals = [
      ...bars.slice(from).flatMap((b) => [b.high, b.low]),
      ...(ind.bb ? [...seen(calc.bb.upper), ...seen(calc.bb.lower)] : []),
      ...scaled.flatMap((s) => seen(s.y)),
    ];
    const lo = Math.min(...priceVals);
    const hi = Math.max(...priceVals);
    const pad = (hi - lo || 1) * 0.06;
    const sub = { fixedrange: true, side: 'right', gridcolor: c.grid, zeroline: false, tickfont, nticks: 3 };

    const lines = [
      // 마지막 종가 점선
      { type: 'line', xref: 'paper', x0: 0, x1: 1, yref: 'y', y0: last.close, y1: last.close, editable: false,
        line: { color: chg >= 0 ? c.up : c.down, width: 1, dash: 'dot' } },
      ...events.map((e) => ({
        type: 'line', xref: 'x', x0: x[e.index], x1: x[e.index], yref: 'paper', y0: 0, y1: 1, editable: false,
        line: { color: c.axis, width: 1, dash: 'dot' },
      })),
      ...(showRsi ? [70, 30].map((v) => ({
        type: 'line', xref: 'paper', x0: 0, x1: 1, yref: 'y3', y0: v, y1: v, editable: false, line: { color: c.axis, width: 1, dash: 'dot' },
      })) : []),
    ];

    return {
      data,
      layout: {
        margin: { t: 4, r: 56, b: 22, l: macro && !macroPane ? 46 : 8 },
        showlegend: false,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: FONT, color: c.muted, size: 10.5 },
        bargap: 0.35,
        dragmode: DRAGMODE[tool] || 'pan',
        newshape: { line: { color: c.text, width: 1.3 }, fillcolor: withAlpha(c.text, 0.05), opacity: 1 },
        hovermode: 'x unified',
        hoverlabel: { bgcolor: c.surface, bordercolor: c.line, font: { color: c.text, size: 11, family: FONT } },
        xaxis: {
          type: 'category', rangeslider: { visible: false }, range: [from - 0.5, n - 0.5],
          tickmode: 'array', tickvals: ticks.map((i) => x[i]), ticktext: ticks.map((i) => tickLabel(x[i], intraday, long)),
          tickfont, showgrid: false, linecolor: c.axis, tickangle: 0,
          showspikes: true, spikemode: 'across', spikecolor: c.muted, spikethickness: 1, spikedash: 'dot',
        },
        yaxis: { domain: price, side: 'right', nticks: 5, fixedrange: true, gridcolor: c.grid, zeroline: false, tickfont, range: [lo - pad, hi + pad] },
        yaxis2: { domain: volume, showticklabels: false, showgrid: false, zeroline: false, fixedrange: true },
        yaxis3: { ...sub, domain: domains.rsi || [0, 0], range: [0, 100], tickvals: [30, 70], visible: showRsi },
        yaxis4: { ...sub, domain: domains.macd || [0, 0], showticklabels: false, zeroline: true, zerolinecolor: c.axis, visible: showMacd },
        yaxis5: { ...sub, domain: domains.macro || [0, 0], tickfont: { ...tickfont, color: ACCENT }, visible: macroPane },
        yaxis6: {
          overlaying: 'y', side: 'left', fixedrange: true, showgrid: false, zeroline: false, nticks: 4,
          tickfont: { ...tickfont, color: ACCENT }, visible: !!macro && !macroPane,
          range: macro && !macroPane ? paddedRange(seen(macro.values)) : undefined,
        },
        shapes: [...lines, ...(shapes || [])],
        annotations: events.map((e) => ({
          x: x[e.index], xref: 'x', y: 0, yref: 'paper', yanchor: 'bottom', showarrow: false,
          text: e.letters, hovertext: e.title,
          font: { size: 9.5, color: c.text, family: FONT }, bgcolor: c.surface, bordercolor: c.axis, borderpad: 2,
        })),
      },
    };
  }, [bars, closes, calc, n, from, show, type, ind, symbol, scaled, macro, macroPane, showRsi, showMacd, events, tool, shapes, last, chg]);

  // 그린 도형(editable 인 것)만 위로 올린다 — 기준선 · 이벤트선은 우리가 그린 것이다
  const onRelayout = useCallback((layout) => {
    if (!onShapes) return;
    const drawn = (layout.shapes || []).filter((s) => s.editable !== false);
    if (drawn.length !== (shapes || []).length) onShapes(drawn.map((s) => ({ ...s })));
  }, [onShapes, shapes]);

  const value = (arr) => (arr[n - 1] != null ? fmtNumber(arr[n - 1]) : '—');
  const tone = toneOf(chg);

  return (
    <div className={`min-w-0 min-h-0 flex flex-col rounded-md border bg-[var(--mp-tile)] overflow-hidden ${active ? 'border-[var(--mp-chip-on)]' : 'border-[var(--mp-tile-line)]'}`}>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 px-2.5 pt-2 text-xs flex-shrink-0">
        <span className="text-[13px] font-bold">{symbol}</span>
        <span className="text-[var(--mp-muted)]">{intervalLabel}</span>
        {[['시', last.open], ['고', last.high], ['저', last.low], ['종', last.close]].map(([k, v]) => (
          <span key={k} className="text-[var(--mp-muted)]">{k} <span style={{ color: tone }}>{fmtNumber(v)}</span></span>
        ))}
        <span className="font-semibold" style={{ color: tone }}>{fmtPct(chg)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-2.5 pb-0.5 text-[11px] text-[var(--mp-muted)] flex-shrink-0 min-h-[18px]">
        {ind.ma20 && <span className="flex items-center gap-1.5"><LineSwatch color="var(--mp-text)" width={1.6} />MA 20 <b className="font-semibold text-[var(--mp-text-2)]">{value(calc.ma20)}</b></span>}
        {ind.ma60 && <span className="flex items-center gap-1.5"><LineSwatch color="var(--mp-muted)" width={1.6} dash="3 2" />MA 60 <b className="font-semibold text-[var(--mp-text-2)]">{value(calc.ma60)}</b></span>}
        {ind.bb && <span>BB 20 2 <b className="font-semibold text-[var(--mp-text-2)]">{value(calc.bb.upper)} / {value(calc.bb.lower)}</b></span>}
        {showRsi && <span>RSI 14 <b className="font-semibold text-[var(--mp-text-2)]">{calc.rsi[n - 1] != null ? calc.rsi[n - 1].toFixed(1) : '—'}</b></span>}
        {showMacd && <span>MACD <b className="font-semibold text-[var(--mp-text-2)]">{calc.macd.macd[n - 1].toFixed(2)}</b> · 시그널 <b className="font-semibold text-[var(--mp-text-2)]">{calc.macd.signal[n - 1].toFixed(2)}</b></span>}
        {scaled.length > 0 && <span>{symbol} 구간 <b className="font-semibold" style={{ color: toneOf(viewChg) }}>{fmtPct(viewChg)}</b></span>}
        {scaled.map((s, i) => (
          <span key={s.symbol} className="flex items-center gap-1.5">
            <LineSwatch color="var(--mp-text)" width={1.6} dash={CMP_SWATCH[i]} />
            <span className="font-semibold text-[var(--mp-text)]">{s.symbol}</span>
            <b className="font-semibold" style={{ color: toneOf(s.chg) }}>{s.chg != null ? fmtPct(s.chg) : '—'}</b>
          </span>
        ))}
        {macro && (
          <span className="flex items-center gap-1.5 text-[var(--mp-accent)]">
            <LineSwatch color={ACCENT} width={1.8} />{macro.name} <b className="font-semibold">{macro.format(macro.values[n - 1])}</b>
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <Plot figure={figure} config={DRAW_CONFIG} onRelayout={onRelayout} ariaLabel={`${symbol} ${intervalLabel} 차트, 종가 ${fmtNumber(last.close)} ${fmtPct(chg)}`} />
      </div>
    </div>
  );
}

function paddedRange(values) {
  if (!values.length) return undefined;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo || Math.abs(hi) * 0.05 || 1) * 0.12;
  return [lo - pad, hi + pad];
}
