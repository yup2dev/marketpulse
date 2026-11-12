/**
 * table — 열 종류를 골라 만드는 표.
 *
 * options.columns: [{ type, header, field, … }]
 *   rank                                   1, 2, 3 …
 *   stock    symbol, name                  로고 + 이름 (종목 화면 링크)
 *   price    field, currency               통화 기호 붙은 가격 (currency = 통화 필드)
 *   change   field                         등락률 — 부호 색
 *   compact  field                         1.2M · 3.4B
 *   number   field                         자릿수 구분 숫자
 *   trend    symbol, series, toneBy        행마다 받는 추세선 (series = '…/{symbol}?…')
 *   tag      field                         회색 꼬리표
 *   text     field                         그대로
 *   공통: header · width(px) · align('left'|'right') · render(row, ctx) 를 주면 그걸 그린다
 * options.minWidth: 이보다 좁으면 가로 스크롤 (기본 600)
 */
import { Link, hrefFor } from '../adapter';
import { useSeries } from '../data';
import { fmtCompact, fmtNumber, fmtPct, fmtPrice, toneOf, read } from '../format';
import { StockLogo, TrendLine } from './parts';

const RIGHT = new Set(['price', 'change', 'compact', 'number', 'trend']);

function Cell({ col, row, index, ctx, series }) {
  if (col.render) return col.render(row, ctx);
  const v = read(row, col.field, ctx);
  switch (col.type) {
    case 'rank':
      return <span className="font-bold text-[var(--mp-text-2)]">{index + 1}</span>;
    case 'stock': {
      const sym = String(row[col.symbol] || '').toUpperCase();
      const name = row[col.name] || sym;
      return (
        <Link to={hrefFor(sym)} className="flex items-center gap-2.5 min-w-0" title={`${name} (${sym})`}>
          <StockLogo symbol={sym} name={name} />
          <span className="font-semibold truncate">{name}</span>
        </Link>
      );
    }
    case 'price':
      return <span className="font-semibold">{fmtPrice(v, row[col.currency])}</span>;
    case 'change':
      return <span className="font-bold" style={{ color: toneOf(v) }}>{v != null ? fmtPct(v) : '—'}</span>;
    case 'compact':
      return <span className="text-[var(--mp-text-2)]">{v ? fmtCompact(v) : '—'}</span>;
    case 'number':
      return <span>{v != null ? fmtNumber(v) : '—'}</span>;
    case 'trend': {
      const bars = series[String(row[col.symbol] || '').toUpperCase()] || [];
      const tone = col.toneBy ? toneOf(row[col.toneBy]) : undefined;
      return <span className="inline-block align-middle"><TrendLine values={bars.map((b) => b.close)} color={tone} width={80} height={18} /></span>;
    }
    case 'tag':
      return v ? (
        <span className="inline-block max-w-[96px] truncate align-middle px-1.5 py-0.5 rounded-md bg-[var(--mp-tag)] text-[var(--mp-tag-text)] text-[11px]" title={v}>{v}</span>
      ) : null;
    default:
      return <span className="truncate">{v ?? '—'}</span>;
  }
}

export default function TableView({ rows, ctx, options = {} }) {
  const { columns = [], minWidth = 600 } = options;
  const trend = columns.find((c) => c.type === 'trend');
  const symbols = trend ? rows.map((r) => String(r[trend.symbol] || '').toUpperCase()).filter(Boolean) : [];
  const { series } = useSeries(symbols, trend?.series);
  const keyCol = columns.find((c) => c.symbol)?.symbol;

  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse" style={{ minWidth }}>
        <thead className="sticky top-0 z-[1] bg-[var(--mp-panel)]">
          <tr className="h-7 text-xs text-[var(--mp-muted)] whitespace-nowrap">
            {columns.map((c, i) => (
              <th
                key={i}
                scope="col"
                className={`font-medium ${i === 0 ? 'pl-4 pr-2' : i === columns.length - 1 ? 'pl-2 pr-4' : 'px-2'} ${(c.align || (RIGHT.has(c.type) ? 'right' : 'left')) === 'right' ? 'text-right' : 'text-left'}`}
                style={c.width ? { width: c.width } : undefined}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={(keyCol && row[keyCol]) || r} className="h-10 hover:bg-[var(--mp-row-hover)] transition-colors">
              {columns.map((c, i) => (
                <td
                  key={i}
                  className={`whitespace-nowrap ${i === 0 ? 'pl-4 pr-2' : i === columns.length - 1 ? 'pl-2 pr-4' : 'px-2'} ${(c.align || (RIGHT.has(c.type) ? 'right' : 'left')) === 'right' ? 'text-right' : 'text-left'} ${c.type === 'stock' ? 'max-w-0 w-[34%]' : ''}`}
                >
                  <Cell col={c} row={row} index={r} ctx={ctx} series={series} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
