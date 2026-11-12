/**
 * candles — 한 종목의 캔들 + 거래량 (Plotly). 행 = 봉 { date, open, high, low, close, volume }.
 *
 * options:
 *   headline  true    차트 위에 종목(누르면 바꾸기) · 현재가 · 등락률을 보여 준다
 *
 * 등락률 기준은 meta.prevClose (스펙의 transform 이 { rows, meta } 로 넘긴다).
 * 현재가·등락률은 실시간 시세가 있으면 그 값으로 덮는다.
 */
import { useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { usePopover, PANEL_CLS, SymbolSearch } from '../adapter';
import { fmtNumber, fmtPct, toneOf } from '../format';
import Plot, { FONT } from '../Plot';

/** 시각이 붙은 봉이고 구간이 며칠 안이면 HH:MM, 아니면 MM/DD */
function tickLabel(date, intraday) {
  const m = /(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(date));
  if (!m) return String(date);
  return intraday && m[4] ? `${m[4]}:${m[5]}` : `${m[2]}/${m[3]}`;
}

function Headline({ symbol, setSymbol, price, chg }) {
  const picker = usePopover();
  return (
    <div className="flex items-baseline gap-2 px-4 pb-1 flex-shrink-0">
      <div ref={picker.ref} className="relative">
        <button
          type="button"
          onClick={picker.toggle}
          aria-haspopup="dialog"
          aria-expanded={picker.open}
          title="종목 바꾸기"
          className="flex items-center gap-1 font-bold hover:text-[var(--mp-accent)] transition-colors"
        >
          {symbol}
          <ChevronDown size={12} className="text-[var(--mp-muted)]" />
        </button>
        {picker.open && (
          <div className={`${PANEL_CLS} left-0 w-64 p-2`}>
            <SymbolSearch
              value=""
              onChange={() => {}}
              onSelect={(s) => { setSymbol(s.symbol.toUpperCase()); picker.close(); }}
              placeholder="종목 검색"
              compact
            />
          </div>
        )}
      </div>
      <span className="text-lg font-bold">{price != null ? fmtNumber(price) : '—'}</span>
      {chg != null && <span className="font-bold" style={{ color: toneOf(chg) }}>{fmtPct(chg)}</span>}
    </div>
  );
}

CandlesView.ownsState = true;   // 로딩·오류·빈 화면도 머리줄 아래에 그린다 (종목은 언제든 바꿀 수 있게)

export default function CandlesView({ rows, meta, quotes, symbol, setSymbol, state, options = {} }) {
  const { headline = true } = options;

  const figure = useCallback((c) => {
    const x = rows.map((r) => String(r.date));
    const n = rows.length;
    const intraday = /[T ]\d{2}:\d{2}/.test(x[0] || '') && (new Date(x[n - 1]) - new Date(x[0])) < 6 * 86400e3;
    const ticks = [0, 1, 2, 3].map((i) => Math.round((i * (n - 1)) / 4)).filter((v, i, a) => a.indexOf(v) === i);
    const hasVolume = rows.some((r) => r.volume);
    const tickfont = { color: c.muted, size: 10.5, family: FONT };
    return {
      data: [
        {
          type: 'candlestick', x, name: '',
          open: rows.map((r) => r.open), high: rows.map((r) => r.high),
          low: rows.map((r) => r.low), close: rows.map((r) => r.close),
          increasing: { line: { color: c.up, width: 1 }, fillcolor: c.up },
          decreasing: { line: { color: c.down, width: 1 }, fillcolor: c.down },
        },
        ...(hasVolume ? [{
          type: 'bar', x, y: rows.map((r) => r.volume), yaxis: 'y2', hoverinfo: 'skip',
          marker: { color: rows.map((r) => (r.close >= r.open ? c.up : c.down)), opacity: 0.4 },
        }] : []),
      ],
      layout: {
        margin: { t: 6, r: 50, b: 22, l: 20 },
        showlegend: false,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: FONT, color: c.muted, size: 10.5 },
        bargap: 0.35,
        dragmode: false,
        hovermode: 'x unified',
        hoverlabel: { bgcolor: c.surface, bordercolor: c.line, font: { color: c.text, size: 11, family: FONT } },
        xaxis: {
          type: 'category', rangeslider: { visible: false }, fixedrange: true,
          tickmode: 'array', tickvals: ticks.map((i) => x[i]), ticktext: ticks.map((i) => tickLabel(x[i], intraday)),
          tickfont, showgrid: false, linecolor: c.axis, tickangle: 0,
          showspikes: true, spikemode: 'across', spikecolor: c.muted, spikethickness: 1, spikedash: 'dot',
        },
        yaxis: {
          domain: hasVolume ? [0.22, 1] : [0, 1], side: 'right', nticks: 4, fixedrange: true,
          gridcolor: c.grid, zeroline: false, tickfont,
        },
        yaxis2: { domain: [0, 0.18], showticklabels: false, showgrid: false, zeroline: false, fixedrange: true },
      },
    };
  }, [rows]);

  const q = quotes[String(symbol).toUpperCase()];
  const price = q?.price ?? rows[rows.length - 1]?.close;
  const prevClose = meta?.prevClose;
  const chg = q?.change_percent ?? (price != null && prevClose ? (price / prevClose - 1) * 100 : null);

  return (
    <div className="h-full flex flex-col min-h-0">
      {headline && <Headline symbol={symbol} setSymbol={setSymbol} price={price} chg={chg} />}
      <div className="flex-1 min-h-0 px-1 pb-1">
        {state || <Plot figure={figure} ariaLabel={`${symbol} 캔들 차트`} />}
      </div>
    </div>
  );
}
