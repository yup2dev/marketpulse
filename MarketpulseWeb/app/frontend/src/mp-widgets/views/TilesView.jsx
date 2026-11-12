/**
 * tiles — 시세 타일 격자 (추세선 · 이름 · 현재가 · 등락률).
 *
 * options:
 *   symbol   'sym'     행에서 심볼 필드
 *   label    'name'    행에서 이름 필드
 *   series   '/stock/history/{symbol}?period=2d&interval=5m'   타일마다 받는 분봉 — 마지막 거래일만 그린다
 *   columns  4         넓을 때 열 수 (좁아지면 2 → 1)
 *
 * 현재가·등락률은 실시간 시세가 있으면 그 값, 없으면 분봉의 마지막 값과 전일 종가로 계산한다.
 */
import { Link, StateView, toState, hrefFor } from '../adapter';
import { useSeries, lastSession } from '../data';
import { fmtNumber, fmtPct, toneOf } from '../format';
import { TrendLine, useWidth } from './parts';

export default function TilesView({ rows, quotes, options = {} }) {
  const { symbol = 'symbol', label = 'name', series: template, columns = 4 } = options;
  const symbols = rows.map((r) => r[symbol]);
  const { series, error, loading } = useSeries(symbols, template);
  const [ref, width] = useWidth();
  const cols = width >= 640 ? columns : width >= 300 ? 2 : 1;

  const hasAny = symbols.some((s) => series[s]?.length || quotes[String(s).toUpperCase()]);
  if (!hasAny && loading) return <StateView kind="loading" />;
  if (!hasAny && error) return <StateView {...toState(error)} compact />;

  return (
    <div
      ref={ref}
      className="h-full overflow-auto grid gap-1.5 px-2 pb-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: 'minmax(40px, 1fr)' }}
    >
      {rows.map((row) => {
        const sym = row[symbol];
        const { closes, prevClose, last } = lastSession(series[sym]);
        const q = quotes[String(sym).toUpperCase()];
        const price = q?.price ?? last;
        const chg = q?.change_percent ?? (price != null && prevClose ? (price / prevClose - 1) * 100 : null);
        return (
          <Link
            key={sym}
            to={hrefFor(sym)}
            className="flex items-center gap-2.5 px-2.5 rounded-md border border-[var(--mp-tile-line)] bg-[var(--mp-tile)] hover:border-[var(--mp-grip)] transition-colors min-w-0"
          >
            <TrendLine values={closes} baseline={prevClose ?? undefined} width={44} height={22} />
            <span className="flex-1 min-w-0 truncate text-xs text-[var(--mp-muted)]">{row[label]}</span>
            <span className="text-right flex-shrink-0 leading-tight">
              <span className="block font-semibold">{price != null ? fmtNumber(price) : '—'}</span>
              <span className="block text-[11px] font-semibold" style={{ color: toneOf(chg) }}>
                {chg != null ? fmtPct(chg) : ' '}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
