/**
 * MpGrid — 앱의 표는 이것 하나다. DB 위젯(view: 'table')도, 화면에서 직접 그리는 표도 같은 부품.
 *
 *   바로 그리기       <MpGrid rows={rows} options={{ columns, sortable: true }} />
 *   미리 설정해 두기  const HoldingsGrid = MpGrid.init({ columns, sortable: true, pageSize: 20 });
 *                     <HoldingsGrid rows={rows} />                 (options 를 또 주면 그 값이 이긴다)
 *
 * options.columns: [{ type, header, field, … }]
 *   rank                                   1, 2, 3 …
 *   stock    symbol, name                  로고 + 이름 (종목 화면 링크)
 *   price    field, currency               통화 기호 붙은 가격 (currency = 통화 필드, 없으면 $)
 *   change   field, digits                 등락률 — 부호 색
 *   percent  field, digits                 +1.23% (부호만, 색 없음)
 *   pct      field                         12.3% (부호·색 없음 — 비중)
 *   compact  field, digits                 1.2M · 3.4B
 *   number   field, digits                 자릿수 구분 숫자
 *   date     field                         YYYY-MM-DD
 *   trend    symbol, series, toneBy        행마다 받는 추세선 (series = '…/{symbol}?…')
 *   tag      field                         회색 꼬리표
 *   text     field                         그대로 (기본)
 *   muted    field                         흐린 글자 (시각 · 국가)
 *   value    field                         오른쪽 굵은 값 (없으면 —)
 *   value_muted field                      오른쪽 흐린 값 (없으면 —)
 *   money    field                         $ 붙은 큰 수 ($6.72T)
 *   pill     field                         등락률을 같은 색 옅은 바탕의 꼬리표로 (전분기 대비)
 *   bar      field, suffix                 값 + 얇은 막대 (막대 = 열에서 가장 큰 값 대비)
 *   badge    field, toneBy                 글자 꼬리표 — 색은 toneBy 필드('up'·'down'·'accent'·숫자 부호), 없으면 회색
 *   entity   field                         로고 + 이름 (종목이 아닌 것 — 기관)
 *   link     field, href                   글자를 누르면 href 필드의 주소를 새 탭으로
 *   공통: id · header · width(px 또는 '20%') · align('left'|'right') · render(row, ctx, index) · sortable(false 면 그 열만 끔)
 *         · hide(처음엔 숨김) · wrap(true 면 줄바꿈 허용) · className(칸에 붙일 클래스)
 *   field 는 필드 이름 또는 (row, ctx) => 값. 머리글·field 가 없는 열(동작 버튼)은 id 를 준다
 *
 * 모양
 *   minWidth   이보다 좁으면 가로 스크롤 (기본 600)
 *   rowHeight  행 높이 (기본 40). 32 미만이면 글자도 12px 로 줄인다
 *   fixed      true 면 열 폭을 고정하고(width 없는 열이 나머지를 갖는다) 넘치는 글자는 … 으로 자른다
 *   rowHeight: 0 이면 높이를 내용에 맡긴다 (입력칸이 든 편집 표)
 *   valign     'top' 이면 칸 내용을 위에 붙인다
 *   rowKey     행 React key — 필드 이름 또는 (row) => 값 (편집 표는 꼭 준다)
 *   rowClassName (row) => 클래스 (예: 사용 안 함 행 흐리게)
 *   footer     <tr>…</tr> — 표 맨 아래 고정 행 (예: 추가 입력 줄)
 *   scroll     false 면 표 안 스크롤을 끈다 — 칸 안 드롭다운(Select)이 잘리지 않게 (편집 표)
 *
 * 기능 (모두 기본 꺼짐 — 켠 것만 생긴다)
 *   sortable     머리글을 눌러 정렬 (오름 → 내림 → 원래 순서)
 *   searchable   머리줄 검색칸 — 보이는 열의 글자에서 찾는다
 *   exportable   CSV 내려받기 (exportName = 파일 이름, 기본 'export')
 *   columnPicker 열 보이기/숨기기
 *   pageSize     이보다 행이 많으면 쪽 나눔
 *   expand       (row) => JSX — 행을 누르면 아래에 펼친다 (한 번에 한 행)
 *   expanded     (row) => boolean — 주면 펼침을 밖에서 정한다 (행 클릭·꺾쇠 열 없음, 칸 안 버튼으로 연다)
 *   onRowClick   (row) => void
 *   select       '화면 변수:행 필드' — 행을 누르면 그 변수에 행의 값을 넣는다 (DataWidget 이 setParam 을 준다).
 *                지금 값과 같은 행은 강조한다
 *   empty        행이 없을 때 글자 (기본 'No data')
 *
 * DataWidget 뷰로 쓰일 때는 { rows, ctx, options, setParam } 을 받는다.
 */
import { useMemo, useState } from 'react';
import {
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsLeft, ChevronsRight, ChevronsUpDown,
  Download, Search, SlidersHorizontal,
} from 'lucide-react';
import { Link, hrefFor } from './adapter';
import { useSeries } from './data';
import { fmtCompact, fmtDate, fmtNumber, fmtPct, fmtPrice, toneOf, read } from './format';
import { MiniBar, Pill, StockLogo, TrendLine } from './views/parts';

const RIGHT = new Set(['price', 'change', 'percent', 'compact', 'number', 'trend', 'value', 'value_muted', 'money', 'pct', 'pill', 'bar']);
const UNSORTABLE = new Set(['rank', 'trend']);
const blank = (v) => v == null || String(v).trim() === '';
const plain = (v) => (v != null && typeof v === 'object' ? '—' : (v ?? '—'));
const EMPTY = [];

const colId = (c, i) => c.id || (typeof c.field === 'string' ? c.field : c.symbol || c.header || `col${i}`);
const alignOf = (c) => c.align || (RIGHT.has(c.type) ? 'right' : 'left');

/** 정렬·검색·CSV 가 읽는 값 — 그려진 글자가 아니라 원래 값 */
function rawValue(c, row, ctx) {
  if (c.type === 'stock') return row[c.name] || row[c.symbol];
  return read(row, c.field, ctx);
}

function Cell({ col, row, index, ctx, series, max }) {
  if (col.render) return col.render(row, ctx, index);
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
      return <span className="font-bold" style={{ color: toneOf(v) }}>{fmtPct(v, col.digits ?? 2, { empty: '—' })}</span>;
    case 'percent':
      return <span>{fmtPct(v, col.digits ?? 2, { empty: '—' })}</span>;
    case 'compact':
      return <span className="text-[var(--mp-text-2)]">{v ? fmtCompact(v, col.digits ?? 1, { smallDigits: col.digits }) : '—'}</span>;
    case 'number':
      return <span>{fmtNumber(v, col.digits, { empty: '—' })}</span>;
    case 'date':
      return <span>{fmtDate(v, { empty: '—' })}</span>;
    case 'trend': {
      const bars = series[String(row[col.symbol] || '').toUpperCase()] || [];
      const tone = col.toneBy ? toneOf(row[col.toneBy]) : undefined;
      return <span className="inline-block align-middle"><TrendLine values={bars.map((b) => b.close)} color={tone} width={80} height={18} /></span>;
    }
    case 'tag':
      return v ? (
        <span className="inline-block max-w-[96px] truncate align-middle px-1.5 py-0.5 rounded-md bg-[var(--mp-tag)] text-[var(--mp-tag-text)] text-[11px]" title={v}>{v}</span>
      ) : null;
    case 'muted':
      return <span className="text-[var(--mp-muted)]">{blank(v) ? '—' : v}</span>;
    case 'value':
      return <span className="font-semibold">{blank(v) ? '—' : v}</span>;
    case 'value_muted':
      return <span className="text-[var(--mp-muted)]">{blank(v) ? '—' : v}</span>;
    case 'money':
      return <span className="font-semibold">{v != null ? `$${fmtCompact(v, 2)}` : '—'}</span>;
    case 'pct':
      return <span className="text-[var(--mp-text-2)]">{v != null ? `${Number(v).toFixed(2)}%` : '—'}</span>;
    case 'pill':
      return v != null
        ? <Pill tone={Number(v)} className="min-w-[56px] text-center">{fmtPct(v, 1)}</Pill>
        : <span className="text-[var(--mp-faint)]">—</span>;
    case 'bar':
      return (
        <span className="inline-flex items-center justify-end gap-2">
          <MiniBar ratio={max ? Math.abs(Number(v) || 0) / max : 0} color={col.color || 'var(--mp-muted)'} />
          <span className="w-11 text-right text-[var(--mp-text-2)]">{v != null ? `${Number(v).toFixed(1)}${col.suffix ?? '%'}` : '—'}</span>
        </span>
      );
    case 'badge':
      return blank(v) ? null : <Pill tone={col.toneBy ? row[col.toneBy] : undefined}>{v}</Pill>;
    case 'entity':
      return (
        <span className="flex items-center gap-2.5 min-w-0" title={v}>
          <StockLogo symbol={v} name={v} />
          <span className="font-semibold truncate">{v ?? '—'}</span>
        </span>
      );
    case 'link': {
      const url = row[col.href];
      return url
        ? <a href={url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline" onClick={(e) => e.stopPropagation()}>{v ?? '—'}</a>
        : <span className="truncate">{v ?? '—'}</span>;
    }
    default:
      return <span className="truncate">{plain(v)}</span>;
  }
}

function compare(a, b) {
  const na = a == null || a === '', nb = b == null || b === '';
  if (na || nb) return na === nb ? 0 : na ? 1 : -1;     // 빈 값은 늘 맨 뒤
  const x = Number(a), y = Number(b);
  if (!Number.isNaN(x) && !Number.isNaN(y)) return x - y;
  return String(a).localeCompare(String(b));
}

function downloadCsv(name, columns, items, ctx) {
  const esc = (v) => JSON.stringify(v == null || typeof v === 'object' ? '' : v);
  const lines = [
    columns.map((c, i) => esc(c.header ?? colId(c, i))).join(','),
    ...items.map(({ row }) => columns.map((c) => esc(rawValue(c, row, ctx))).join(',')),
  ];
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url; a.download = `${name}.csv`; a.click();
  URL.revokeObjectURL(url);
}

const iconBtn = 'p-1 rounded text-[var(--mp-muted)] hover:text-[var(--mp-text)] hover:bg-[var(--mp-raised)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors';

function Toolbar({ search, setSearch, searchable, picker, columns, hidden, toggle, onExport }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--mpc-grid)] flex-shrink-0">
      {searchable && (
        <div className="relative flex-1 max-w-[220px]">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--mp-muted)] pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            aria-label="Search rows"
            className="w-full pl-6 pr-2 py-1 text-xs rounded-md bg-[var(--mp-raised)] border border-transparent focus:border-[var(--mp-accent)] outline-none text-[var(--mp-text)] placeholder:text-[var(--mp-faint)]"
          />
        </div>
      )}
      <div className="flex items-center gap-1 ml-auto">
        {picker && (
          <div className="relative">
            <button type="button" onClick={() => setOpen((v) => !v)} className={iconBtn} title="Show/hide columns" aria-expanded={open}>
              <SlidersHorizontal size={13} />
            </button>
            {open && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] py-1 rounded-lg border border-[var(--mpc-grid)] bg-[var(--mp-panel)] shadow-xl">
                  {columns.map((c, i) => {
                    const id = colId(c, i);
                    return (
                      <label key={id} className="flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--mp-text-2)] hover:bg-[var(--mp-row-hover)] cursor-pointer">
                        <input type="checkbox" checked={!hidden.has(id)} onChange={() => toggle(id)} />
                        {c.header || id}
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
        {onExport && (
          <button type="button" onClick={onExport} className={iconBtn} title="Export CSV">
            <Download size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

function Pager({ page, pages, size, setPage, setSize, total, filtered }) {
  return (
    <div className="flex items-center justify-between px-3 py-1 border-t border-[var(--mpc-grid)] flex-shrink-0 text-xs text-[var(--mp-muted)]">
      <span>{filtered} rows{filtered !== total ? ` (of ${total})` : ''}</span>
      <div className="flex items-center gap-1">
        <select
          value={size}
          onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}
          aria-label="Rows per page"
          className="bg-[var(--mp-raised)] rounded px-1 py-0.5 text-[var(--mp-text-2)] outline-none"
        >
          {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}/page</option>)}
        </select>
        <button type="button" className={iconBtn} onClick={() => setPage(0)} disabled={page === 0} aria-label="First page"><ChevronsLeft size={13} /></button>
        <button type="button" className={iconBtn} onClick={() => setPage(page - 1)} disabled={page === 0} aria-label="Previous page"><ChevronLeft size={13} /></button>
        <span className="px-1 text-[var(--mp-text-2)]">{page + 1} / {pages}</span>
        <button type="button" className={iconBtn} onClick={() => setPage(page + 1)} disabled={page >= pages - 1} aria-label="Next page"><ChevronRight size={13} /></button>
        <button type="button" className={iconBtn} onClick={() => setPage(pages - 1)} disabled={page >= pages - 1} aria-label="Last page"><ChevronsRight size={13} /></button>
      </div>
    </div>
  );
}

export default function MpGrid({ rows = EMPTY, ctx, options = {}, setParam }) {
  const {
    columns: allColumns = EMPTY, minWidth = 600, rowHeight = 40, fixed = false, select,
    sortable = false, searchable = false, exportable = false, exportName = 'export', columnPicker = false,
    pageSize, expand, expanded: isOpen, onRowClick, empty = 'No data',
    rowKey, rowClassName, footer, valign, scroll = true,
  } = options;

  const [hidden, setHidden] = useState(() => new Set(allColumns.filter((c) => c.hide).map(colId)));
  const [sort, setSort] = useState(null);          // { id, dir: 1 | -1 }
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(pageSize || 0);
  const [expanded, setExpanded] = useState(null);

  const columns = useMemo(
    () => allColumns.filter((c, i) => !hidden.has(colId(c, i))),
    [allColumns, hidden],
  );
  const toggle = (id) => setHidden((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // 검색 → 정렬. 원래 순번(i)을 들고 다녀 행 key · 펼침이 정렬 뒤에도 같은 행을 가리킨다
  const items = useMemo(() => {
    let out = rows.map((row, i) => ({ row, i }));
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter(({ row }) => columns.some((c) => {
        const v = rawValue(c, row, ctx);
        return v != null && typeof v !== 'object' && String(v).toLowerCase().includes(q);
      }));
    }
    if (sort) {
      const c = allColumns.find((col, i) => colId(col, i) === sort.id);
      if (c) out = [...out].sort((a, b) => sort.dir * compare(rawValue(c, a.row, ctx), rawValue(c, b.row, ctx)));
    }
    return out;
  }, [rows, columns, allColumns, search, sort, ctx]);

  const paged = size > 0 && rows.length > size;
  const pages = paged ? Math.max(1, Math.ceil(items.length / size)) : 1;
  const current = Math.min(page, pages - 1);
  const visible = paged ? items.slice(current * size, current * size + size) : items;

  const [selectName, selectField] = String(select || '').split(':');
  const selected = selectField ? ctx?.params?.[selectName] : undefined;
  // 막대 셀의 기준 — 그 열에서 가장 큰 값
  const maxes = columns.map((c) => (c.type === 'bar'
    ? Math.max(...rows.map((r) => Math.abs(Number(read(r, c.field, ctx)) || 0)), 0)
    : 0));
  const dense = rowHeight < 32;
  const trend = columns.find((c) => c.type === 'trend');
  const symbols = trend ? visible.map(({ row }) => String(row[trend.symbol] || '').toUpperCase()).filter(Boolean) : EMPTY;
  const { series } = useSeries(symbols, trend?.series);
  const keyCol = allColumns.find((c) => c.symbol)?.symbol;
  const keyOf = (row, i) => (rowKey ? read(row, rowKey) : keyCol && row[keyCol]) || i;
  const toggles = expand && !isOpen;   // 행 클릭으로 펼치는가 (꺾쇠 열이 생긴다)

  const clickable = !!(selectField || toggles || onRowClick);
  const onRow = (row, i) => {
    if (selectField) setParam?.(selectName, row[selectField]);
    if (toggles) setExpanded((prev) => (prev === i ? null : i));
    onRowClick?.(row);
  };
  const cycleSort = (id) => setSort((prev) => {
    if (prev?.id !== id) return { id, dir: 1 };
    return prev.dir === 1 ? { id, dir: -1 } : null;
  });
  const pad = (i) => (i === 0 && !toggles ? 'pl-4 pr-2' : i === columns.length - 1 ? 'pl-2 pr-4' : 'px-2');
  const span = columns.length + (toggles ? 1 : 0);
  const toolbar = searchable || exportable || columnPicker;

  return (
    <div className="flex flex-col h-full min-h-0">
      {toolbar && (
        <Toolbar
          search={search}
          setSearch={(v) => { setSearch(v); setPage(0); }}
          searchable={searchable}
          picker={columnPicker}
          columns={allColumns}
          hidden={hidden}
          toggle={toggle}
          onExport={exportable ? () => downloadCsv(exportName, columns, items, ctx) : null}
        />
      )}
      <div className={scroll ? 'flex-1 min-h-0 overflow-auto' : ''}>
        <table className={`w-full border-collapse ${fixed ? 'table-fixed' : ''} ${dense ? 'text-xs' : ''}`} style={{ minWidth }}>
          <thead className="sticky top-0 z-[1] bg-[var(--mp-panel)]">
            <tr className={`${dense ? 'h-6 text-[11px]' : 'h-7 text-xs'} text-[var(--mp-muted)] whitespace-nowrap`}>
              {toggles && <th scope="col" className="w-8 pl-3" aria-label="Expand" />}
              {columns.map((c, i) => {
                const id = colId(c, i);
                const canSort = sortable && c.sortable !== false && !UNSORTABLE.has(c.type) && (c.field != null || c.type === 'stock');
                const dir = sort?.id === id ? sort.dir : 0;
                const right = alignOf(c) === 'right';
                return (
                  <th
                    key={id}
                    scope="col"
                    className={`font-medium ${pad(i)} ${right ? 'text-right' : 'text-left'} ${canSort ? 'cursor-pointer select-none hover:text-[var(--mp-text)]' : ''}`}
                    style={c.width ? { width: c.width } : undefined}
                    aria-sort={dir ? (dir === 1 ? 'ascending' : 'descending') : undefined}
                    onClick={canSort ? () => cycleSort(id) : undefined}
                  >
                    {canSort ? (
                      <span className={`inline-flex items-center gap-1 ${right ? 'flex-row-reverse' : ''}`}>
                        {c.header}
                        {dir === 1 ? <ChevronUp size={10} className="text-[var(--mp-accent)]" />
                          : dir === -1 ? <ChevronDown size={10} className="text-[var(--mp-accent)]" />
                            : <ChevronsUpDown size={10} className="opacity-40" />}
                      </span>
                    ) : c.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={span} className="py-10 text-center text-xs text-[var(--mp-muted)]">{search ? 'No matches' : empty}</td></tr>
            )}
            {visible.flatMap(({ row, i }, r) => {
              const open = expand && (isOpen ? isOpen(row) : expanded === i);
              const key = keyOf(row, i);
              const isSelected = selectField && row[selectField] === selected;
              const tr = (
                <tr
                  key={key}
                  className={`hover:bg-[var(--mp-row-hover)] transition-colors ${dense || !rowHeight ? 'border-t border-[var(--mpc-grid)] first:border-t-0' : ''} ${valign === 'top' ? 'align-top' : ''} ${clickable ? 'cursor-pointer' : ''} ${isSelected || (open && toggles) ? 'bg-[var(--mp-raised)]' : ''} ${rowClassName ? rowClassName(row) || '' : ''}`}
                  style={rowHeight ? { height: rowHeight } : undefined}
                  aria-selected={selectField ? isSelected : undefined}
                  aria-expanded={toggles ? !!open : undefined}
                  onClick={clickable ? () => onRow(row, i) : undefined}
                >
                  {toggles && (
                    <td className="w-8 pl-3 text-[var(--mp-muted)]">
                      <ChevronRight size={13} className={`transition-transform ${open ? 'rotate-90 text-[var(--mp-accent)]' : ''}`} />
                    </td>
                  )}
                  {columns.map((c, ci) => (
                    <td
                      key={colId(c, ci)}
                      className={`${c.wrap ? '' : 'whitespace-nowrap'} ${rowHeight ? '' : 'py-1.5'} ${pad(ci)} ${alignOf(c) === 'right' ? 'text-right tabular-nums' : 'text-left'} ${c.className || ''} ${c.type === 'stock' || c.type === 'entity' ? 'max-w-0 w-[34%]' : ''} ${fixed ? 'overflow-hidden text-ellipsis' : ''}`}
                      title={fixed && !c.width ? String(read(row, c.field, ctx) ?? '') : undefined}
                    >
                      <Cell col={c} row={row} index={(paged ? current * size : 0) + r} ctx={ctx} series={series} max={maxes[ci]} />
                    </td>
                  ))}
                </tr>
              );
              if (!open) return [tr];
              return [tr, (
                <tr key={`${key}-detail`}>
                  <td colSpan={span} className="p-0 border-b border-[var(--mpc-grid)]">
                    <div className={toggles ? 'ml-8 border-l-2 border-[var(--mp-raised)]' : ''}>{expand(row)}</div>
                  </td>
                </tr>
              )];
            })}
          </tbody>
          {footer && <tfoot className="border-t border-[var(--mpc-grid)]">{footer}</tfoot>}
        </table>
      </div>
      {paged && (
        <Pager
          page={current} pages={pages} size={size} setPage={setPage} setSize={setSize}
          total={rows.length} filtered={items.length}
        />
      )}
    </div>
  );
}

/** 옵션을 미리 정해 둔 표를 만든다 — 화면마다 같은 표를 같은 설정으로 쓴다 */
MpGrid.init = function init(defaults = {}) {
  function PresetGrid({ options, ...props }) {
    return <MpGrid {...props} options={options ? { ...defaults, ...options } : defaults} />;
  }
  PresetGrid.displayName = 'MpGrid.init';
  return PresetGrid;
};
