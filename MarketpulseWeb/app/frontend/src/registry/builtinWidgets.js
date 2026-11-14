/**
 * builtinWidgets — 기본 제공 위젯의 정의(서버 DB 행)를 mp-widgets 스펙으로 바꾼다.
 *
 * 정의의 주인은 DB 다 (user_widgets 계열, user_id NULL — GET /api/user-widgets/builtin).
 * 엔드포인트·컬럼·탭·심볼 목록·선택지·기본 배치·크기는 전부 행이고, 이 파일에는 위젯이 없다.
 * 여기 있는 것은 행에 담을 수 없는 것뿐이다:
 *
 *   TRANSFORMS   행을 다듬는 함수 — DB 에는 이름만 있다 (코드 TRANSFORM)
 *   TAB_FILTERS  탭에서 행을 거르는 함수 (코드 TAB_FILTER)
 *   toSpec()     정의 → DataWidget 스펙 (mp-widgets/README.md 의 모양)
 *
 * 새 위젯은 행을 넣는다. 함수가 새로 필요할 때만 여기에 이름을 추가하고,
 * 같은 이름을 서버 코드값(services/user_widget_service.CODES)에도 올린다.
 */
import { normalizeBars, fmtPct, fmtPrice, fmtCompact } from '../mp-widgets';

// ── 행을 다듬는 함수 ───────────────────────────────────────────────────────────
//   prepare(rows, options)       응답 직후 — 실시간 시세를 붙이기 전에 행의 모양을 바꾼다
//   apply(rows, ctx, options)    시세를 붙인 뒤 — 정렬·계산. ctx = { params, tab, symbol, extra, quotes }

const pad = (n) => String(n).padStart(2, '0');

/** 오늘 기사면 HH:MM, 아니면 MM/DD */
function newsTime(a) {
  const d = new Date(a.published_utc);
  if (Number.isNaN(d.getTime())) return '';
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

const RANK_SORT = {
  trade_value: (rows) => [...rows].sort((a, b) => (b.trade_value ?? 0) - (a.trade_value ?? 0)),
  gainers: (rows) => rows.filter((r) => (r.change_rate ?? 0) > 0).sort((a, b) => b.change_rate - a.change_rate),
  losers:  (rows) => rows.filter((r) => (r.change_rate ?? 0) < 0).sort((a, b) => a.change_rate - b.change_rate),
};

export const TRANSFORMS = {
  // 시각 순 (시각이 없는 종일 일정은 맨 위) + 값 칸: 실제치, 없으면 '예상 …'(흐리게) + 국가 두 글자(_cc)
  events_by_time: {
    apply: (rows, _ctx, o) => rows
      .map((ev, i) => ({ ev, i }))
      .sort((a, b) => String(a.ev.time || '').localeCompare(String(b.ev.time || '')) || a.i - b.i)
      .map(({ ev }) => ({
        ...ev,
        _value: ev.actual || (ev.consensus ? `${o.consensusLabel || ''} ${ev.consensus}`.trim() : null),
        _muted: !ev.actual,
        _dot: ev.impact === 'high',
        _cc: COUNTRY_CODES[ev.country] || ev.country || '',
      })),
  },

  // 실시간 시세가 들어온 뒤의 값으로 거래대금을 다시 계산하고, 고른 정렬 기준(sortBy)으로 다시 정렬한다
  rank_sort: {
    apply: (rows, { params }) => (RANK_SORT[params.sortBy] || RANK_SORT.trade_value)(rows.map((r) => (
      r.volume != null && r.close_price != null ? { ...r, trade_value: r.volume * r.close_price } : r
    ))),
  },

  // 보여 줄 봉만 남기고(take 개 또는 마지막 거래일), 등락률 기준(그 앞 봉의 종가)을 meta 로 넘긴다
  bars_window: {
    apply: (rows, { params }) => {
      const bars = normalizeBars(rows);
      if (!bars.length) return [];
      let start = Math.max(0, bars.length - (params.take || bars.length));
      if (params.session) {
        const day = String(bars[bars.length - 1].date).slice(0, 10);
        start = bars.findIndex((b) => String(b.date).slice(0, 10) === day);
      }
      // 일봉은 '전일 대비' — 마지막 봉 바로 앞 종가
      const ref = params.interval === '1d' ? bars[bars.length - 2] : bars[start - 1];
      return { rows: bars.slice(start), meta: { prevClose: ref?.close ?? null } };
    },
  },

  // 섹터 → 종목 행으로 편다 (섹터마다 시가총액 상위 perSector 개)
  flatten_sectors: {
    prepare: (sectors, o) => sectors.flatMap((sec) => (sec.stocks || []).slice(0, o.perSector || 8)),
  },

  // 기사 시각 표기(_time)와 첫 티커(_tag)
  news_rows: {
    apply: (rows) => rows.map((a) => ({ ...a, _time: newsTime(a), _tag: a.tickers?.[0] })),
  },

  // 만기 이름을 짧게(_label: '3-Month' → '3M') + 만기 순
  yield_points: {
    apply: (rows) => rows
      .filter((r) => r.value != null)
      .sort((a, b) => (a.years ?? 0) - (b.years ?? 0))
      .map((r) => ({ ...r, _label: shortMaturity(r.maturity) })),
  },

  // CPI 구성: 가중치가 있는 항목만 + 가운데 값(헤드라인 YoY)·기준월을 meta 로
  cpi_breakdown: {
    apply: (rows, { response }) => {
      const headline = response?.metadata?.headline;
      const date = headline?.date || rows.find((r) => r.date)?.date;
      return {
        rows: rows.filter((r) => r.weight != null),
        meta: {
          center: headline?.yoy != null ? `${Number(headline.yoy).toFixed(2)}%` : null,
          asOf: date ? String(date).slice(0, 7) : '',
        },
      };
    },
  },

  // 고용 지표 표(영문 metric·단위) → 이름 · 값 한 줄씩 (시간당 임금은 YoY 를 붙인다)
  labor_summary: {
    apply: (rows) => {
      const by = Object.fromEntries(rows.map((r) => [r.metric, r]));
      return LABOR_ROWS
        .filter(([metric]) => by[metric]?.value != null)
        .map(([metric, label, format]) => ({ id: metric, label, value: format(by[metric].value, by) }));
    },
  },

  // 공포·탐욕 합성 지수 행만 남긴다
  fear_greed: {
    apply: (rows) => rows.filter((r) => r.section === 'Fear & Greed'),
  },

  // 매크로 요약 줄: 물가(주 요청의 metadata) + 금리·고용·심리(보조 요청) → 이름 · 값 · 상태
  macro_kpis: {
    apply: (_rows, { response, extra }) => {
      const md = response?.metadata || {};
      const yieldOf = (years) => (extra.yields || []).find((r) => r.years === years)?.value;
      const metric = (list, name) => (list || []).find((r) => r.metric === name);
      const pct = (v, digits = 2) => (v == null ? null : `${Number(v).toFixed(digits)}%`);
      const vix = metric(extra.sentiment, 'VIX');
      const fg = (extra.sentiment || []).find((r) => r.section === 'Fear & Greed');
      return [
        ['us10y', '미국 10년물', pct(yieldOf(10))],
        ['us2y', '2년물', pct(yieldOf(2))],
        ['cpi', 'CPI', pct(md.headline?.yoy)],
        ['core', '근원 CPI', pct(md.core?.yoy)],
        ['u3', '실업률', pct(metric(extra.labor, 'U3 Rate')?.value, 1)],
        ['vix', 'VIX', vix?.value != null ? Number(vix.value).toFixed(2) : null, VIX_NOTE[vix?.status]],
        ['fg', 'Fear & Greed', fg?.value != null ? Number(fg.value).toFixed(1) : null, FG_NOTE[fg?.status]],
      ].filter(([, , value]) => value != null).map(([id, label, value, note]) => ({ id, label, value, note }));
    },
  },

  // 종목 요약 줄: 현재가 · 등락(시세 → 없으면 quote) + 1년 최고/최저 · 베타(주 요청) · 연 변동성(일봉) · 최근 배당
  stock_kpis: {
    apply: (rows, { symbol, extra, quotes }) => {
      const m = (Array.isArray(rows) ? rows[0] : rows) || {};
      const q = (extra.quote || [])[0] || {};
      const live = quotes?.[String(symbol || '').toUpperCase()] || {};
      const cur = q.currency;
      const price = live.price ?? q.last_price;
      const pct = live.change_percent ?? q.change_percent;
      // 등락폭은 현재가와 등락률에서 다시 구한다 (실시간 시세에는 등락폭이 없다)
      const diff = price != null && pct != null ? price - price / (1 + pct / 100) : null;
      const closes = normalizeBars(extra.history).map((b) => b.close);
      const high = m.week_52_high ?? q.week_52_high ?? (closes.length ? Math.max(...closes) : null);
      const low = m.week_52_low ?? q.week_52_low ?? (closes.length ? Math.min(...closes) : null);
      const vol = annualVolatility(closes);
      const lastDiv = [...(extra.dividends || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
      const cap = m.market_cap ?? q.market_cap;
      const money = (v) => (v == null ? null : fmtPrice(v, cur));
      return [
        {
          id: 'price', label: q.name || symbol, value: money(price), tone: pct,
          change: diff != null ? `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${Math.abs(diff).toFixed(2)} (${fmtPct(pct)})` : null,
        },
        { id: 'high', label: '1년 최고', value: money(high) },
        { id: 'low', label: '1년 최저', value: money(low) },
        { id: 'beta', label: '베타', value: m.beta != null ? Number(m.beta).toFixed(2) : null },
        { id: 'vol', label: '연 변동성', value: vol != null ? `${vol.toFixed(1)}%` : null },
        { id: 'div', label: '최근 배당', value: money(lastDiv?.dividend) },
        { id: 'cap', label: '시가총액', value: cap != null ? fmtCompact(cap, 2) : null },
      ].filter((r) => r.value != null);
    },
  },

  // 기관 보유: 보유 가치 큰 순 + 보고일(asOf)을 meta 로
  holders_top: {
    apply: (rows) => {
      const list = rows.filter((r) => r.name).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
      return { rows: list, meta: { asOf: list.map((r) => r.date_reported).filter(Boolean).sort().pop() || '' } };
    },
  },

  // 배당: 오래된 것부터 + 막대 아래 이름(_label: 'YY.MM') + 통화를 meta 로
  dividend_bars: {
    apply: (rows) => {
      const list = rows.filter((r) => r.dividend != null && r.date)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
      return {
        rows: list.map((r) => ({ ...r, _label: `${String(r.date).slice(2, 4)}.${String(r.date).slice(5, 7)}` })),
        meta: { currency: list[list.length - 1]?.currency || 'USD' },
      };
    },
  },

  // 공시(주 요청) + 뉴스(extra.news) 를 한 목록으로 — 최신 순, 꼬리표(_tag) '뉴스' · '공시'. 뉴스 요청이 실패하면 공시만
  feed_rows: {
    apply: (rows, { extra }) => {
      const news = (extra.news || []).map((a) => ({
        _kind: 'news', _tag: '뉴스', _at: a.published_utc, title: a.title, _href: a.article_url,
      }));
      const filings = rows.map((f) => ({
        _kind: 'filing', _tag: '공시', _at: f.filing_date,
        title: [f.report_type, filingSubject(f)].filter(Boolean).join(' · '), _href: f.report_url,
      }));
      return [...news, ...filings]
        .filter((r) => r.title && r._at)
        .sort((a, b) => new Date(b._at) - new Date(a._at))
        // 날짜만 있는 값(공시일)은 시각 없이 MM/DD
        .map((r) => ({
          ...r,
          _time: String(r._at).length <= 10 ? `${String(r._at).slice(5, 7)}/${String(r._at).slice(8, 10)}` : newsTime({ published_utc: r._at }),
        }));
    },
  },
};

// 공시 제목 — 정기 보고서는 종류, 수시 보고서(8-K)는 항목 번호(Item)를 말로
const FILING_FORMS = { '10-K': '연간 보고서', '10-Q': '분기 보고서' };
const FILING_ITEMS = {
  '1.01': '주요 계약 체결', '1.02': '주요 계약 해지', '2.01': '자산 인수 · 처분 완료', '2.02': '실적 발표',
  '2.03': '채무 발생', '2.05': '구조조정', '3.02': '미등록 증권 발행', '4.01': '감사인 변경',
  '5.02': '임원 · 이사 변경', '5.03': '정관 변경', '5.07': '주주총회 결과', '7.01': '공정공시', '8.01': '기타 주요 사항',
};

function filingSubject(f) {
  const form = String(f.report_type || '').replace('/A', '');
  if (FILING_FORMS[form]) return FILING_FORMS[form];
  // 9.01(재무제표 · 첨부)은 다른 항목에 딸려 오므로 뺀다
  const items = String(f.items || '').split(',').map((s) => s.trim()).filter((s) => s && s !== '9.01');
  const named = items.map((s) => FILING_ITEMS[s] || `Item ${s}`).join(', ');
  if (named) return named;
  const text = f.title || f.primary_doc_description;
  return text && text !== f.report_type ? text : '';
}

/** 일봉 종가 → 연 변동성(%) — 일간 로그수익률의 표준편차 × √252. 봉이 모자라면 null */
function annualVolatility(closes) {
  const rets = [];
  for (let i = 1; i < closes.length; i += 1) {
    if (closes[i] > 0 && closes[i - 1] > 0) rets.push(Math.log(closes[i] / closes[i - 1]));
  }
  if (rets.length < 20) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

// 일정 표의 국가 칸 — 응답의 국가 이름을 두 글자로 (없는 이름은 그대로)
const COUNTRY_CODES = {
  'United States': 'US', 'Euro Zone': 'EU', 'United Kingdom': 'UK', Germany: 'DE', France: 'FR', Italy: 'IT',
  Spain: 'ES', Japan: 'JP', China: 'CN', 'South Korea': 'KR', India: 'IN', Canada: 'CA', Australia: 'AU',
  'New Zealand': 'NZ', Switzerland: 'CH', Brazil: 'BR', Mexico: 'MX', Russia: 'RU', Turkey: 'TR',
  'South Africa': 'ZA', 'Hong Kong': 'HK', Singapore: 'SG', Indonesia: 'ID', Sweden: 'SE', Norway: 'NO',
  Netherlands: 'NL', Belgium: 'BE', Austria: 'AT', Portugal: 'PT', Ireland: 'IE', Greece: 'GR', Poland: 'PL',
};

/** '3-Month' → '3M', '10-Year' → '10Y' */
function shortMaturity(name) {
  const m = /^(\d+)[-\s]*(month|year)/i.exec(String(name || ''));
  return m ? `${m[1]}${m[2][0].toUpperCase()}` : String(name || '');
}

/** 159290000 → 159.29M · 189000 → 189.0K */
function compactCount(n, kDigits = 1) {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(kDigits)}K`;
  return String(Math.round(n));
}
const rate = (v) => `${Number(v).toFixed(1)}%`;
const thousands = (v) => compactCount(v * 1000);   // 단위가 '천'인 값
// [응답의 metric, 화면 이름, (값, 전체 행) => 표기]
const LABOR_ROWS = [
  ['U3 Rate', '실업률 U3', rate],
  ['U6 Rate', '실업률 U6', rate],
  ['Participation Rate', '경제활동참가율', rate],
  ['Nonfarm Payrolls', '비농업 고용', thousands],
  ['Payroll Change MoM', '고용 증감 (MoM)', (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${compactCount(Math.abs(v) * 1000, 0)}`],
  ['JOLTS Openings', 'JOLTS 구인', thousands],
  ['Quits Rate', '자발적 이직률', rate],
  ['Initial Claims', '신규 실업수당', (v) => compactCount(v)],
  ['Continuing Claims', '연속 실업수당', (v) => compactCount(v)],
  ['Hourly Earnings', '시간당 임금', (v, by) => {
    const yoy = by['Earnings YoY']?.value;
    return `$${Number(v).toFixed(2)}${yoy != null ? ` · ${fmtPct(yoy)}` : ''}`;
  }],
];

// 요약 줄에서 주황으로 덧붙이는 상태 — 평소 범위를 벗어났을 때만
const VIX_NOTE = { elevated: '높음', high: '매우 높음' };
const FG_NOTE = { extreme_fear: '극단적 공포', fear: '공포', greed: '탐욕', extreme_greed: '극단적 탐욕' };

// ── 탭에서 행을 거르는 함수 ────────────────────────────────────────────────────

export const TAB_FILTERS = {
  // 내 관심 종목(extra.favorites)의 티커가 들어 있는 행만
  watchlist_tickers: (rows, { extra }) => {
    const mine = new Set((extra.favorites || []).map((s) => String(s).toUpperCase()));
    return rows.filter((a) => (a.tickers || []).some((t) => mine.has(String(t).toUpperCase())));
  },
  // 뉴스 · 공시 목록(feed_rows)에서 한 종류만
  feed_news: (rows) => rows.filter((r) => r._kind === 'news'),
  feed_filings: (rows) => rows.filter((r) => r._kind === 'filing'),
};

// ── 정의 → 스펙 ────────────────────────────────────────────────────────────────

/** DB 의 문자열 값 → 숫자·참거짓 (그 모양일 때만) */
function coerce(v) {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return v;
}
const coerceAll = (obj) => Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [k, coerce(v)]));

/** '{symbol} 차트 데이터가 없어요' 의 {이름} 자리를 채운다 */
const fillText = (text, values) => (text || '').replace(/\{(\w+)\}/g, (_, k) => values[k] ?? '');

const camel = (role) => role.toLowerCase().replace(/_(\w)/g, (_, c) => c.toUpperCase());
// 값이 아니라 '참이면 그린다' 인 자리 — 뷰가 (row) => boolean 을 받는다
const FLAG_ROLES = new Set(['VALUE_MUTED', 'DOT']);

/**
 * 컨트롤이 머리줄에서 그려지는 모양 — 이름과 선택지로 정한다:
 *   date    이름이 date · *_date            → 기준일 칩 (비우면 최신)
 *   seg     선택지 4개 이하                  → 한 줄 버튼
 *   select  선택지가 더 많거나 요청으로 채움  → 드롭다운
 *   text    선택지 없음                      → '옵션' 버튼 안의 입력칸
 */
function controlKind(name, options, from) {
  if (name === 'date' || name.endsWith('_date')) return 'date';
  if (from || options.length > 4) return 'select';
  return options.length ? 'seg' : 'text';
}

/** 표 컬럼 한 개 — 셀 종류(format)마다 필드가 맡는 자리가 다르다 */
function toColumn(f, series) {
  const col = { type: f.format, header: f.label, width: f.width ?? undefined };
  switch (f.format) {
    case 'rank':  return col;
    case 'stock': return { ...col, symbol: f.field_name, name: f.sub_field };
    case 'price': return { ...col, field: f.field_name, currency: f.sub_field };
    case 'trend': return { ...col, symbol: f.field_name, toneBy: f.sub_field, series };
    default:      return { ...col, field: f.field_name };
  }
}

function buildSpec(def) {
  const all = coerceAll(def.options);
  const options = {};
  const extra = {};
  const byTab = {};   // 'tab.<탭 코드>.<이름>' — 그 탭만의 뷰·요청·옵션
  const optionsFrom = {};
  let provider = null;
  for (const [k, v] of Object.entries(all)) {
    if (k.startsWith('extra.')) extra[k.slice('extra.'.length)] = v;
    else if (k.startsWith('tab.')) {
      const [, code, ...name] = k.split('.');
      (byTab[code] ||= {})[name.join('.')] = v;
    } else if (k.startsWith('optionsFrom.')) {
      // 'optionsFrom.<컨트롤>' = '경로|값 필드|이름 필드' — 선택지를 요청으로 채운다
      const [endpoint, value = 'value', label = 'label'] = String(v).split('|');
      optionsFrom[k.slice('optionsFrom.'.length)] = { endpoint, value, label };
    } else if (k === 'provider') provider = String(v);
    else options[k] = v;
  }

  const fields = def.fields || [];
  if (def.view_type === 'table') {
    options.columns = fields.filter((f) => f.field_role === 'COLUMN').map((f) => toColumn(f, options.series));
  } else {
    for (const f of fields) {
      if (f.field_role === 'COLUMN') continue;
      options[camel(f.field_role)] = FLAG_ROLES.has(f.field_role) ? (row) => !!row[f.field_name] : f.field_name;
    }
  }

  // 실시간 시세로 덮어쓸 필드 { 행의 필드: 시세의 필드 }
  const quoteFields = Object.fromEntries(fields.filter((f) => f.quote_field).map((f) => [f.field_name, f.quote_field]));
  const quotes = def.quote_key
    ? { key: def.quote_key, fields: Object.keys(quoteFields).length ? quoteFields : undefined }
    : undefined;

  const transformOf = (name) => {
    if (!name) return null;
    if (!TRANSFORMS[name]) console.error('[builtinWidgets] unknown transform:', name, def.widget_id);
    return TRANSFORMS[name] || null;
  };
  const fn = transformOf(def.transform);

  const tabs = (def.tabs || []).map((t) => {
    if (t.filter && !TAB_FILTERS[t.filter]) console.error('[builtinWidgets] unknown tab filter:', t.filter, def.widget_id);
    // 탭 옵션 중 view·endpoint·transform·controls 는 탭의 그리는 법, 나머지는 그 탭의 뷰 옵션
    const { view, endpoint, transform, controls, ...own } = byTab[t.tab_code] || {};
    const tabOptions = Object.keys(own).length ? { ...options, ...own } : undefined;
    const tabFn = transformOf(transform);
    const o = tabOptions || options;
    return {
      id: t.tab_code,
      label: t.label,
      items: t.items?.length ? t.items : undefined,
      filter: t.filter ? TAB_FILTERS[t.filter] : undefined,
      emptyText: t.empty_text,
      view,
      options: tabOptions,
      // 머리줄에 보일 컨트롤 이름 ('none' = 숨김). 안 적으면 전부
      controls: controls == null
        ? undefined
        : String(controls).split(',').map((s) => s.trim()).filter((s) => s && s !== 'none'),
      // 요청이나 transform 을 따로 적은 탭은 스펙의 prepare·transform 을 물려받지 않는다
      api: endpoint || transform ? {
        ...(endpoint ? { endpoint } : {}),
        prepare: tabFn?.prepare ? (rows) => tabFn.prepare(rows, o) : undefined,
        transform: tabFn?.apply ? (rows, ctx) => tabFn.apply(rows, ctx, o) : undefined,
      } : undefined,
    };
  });

  const text = (template) => (ctx, meta) => fillText(template, { ...ctx.params, symbol: ctx.symbol, ...meta });

  return {
    title: def.title || undefined,
    tabs: tabs.length ? tabs : undefined,
    source: def.source,
    sourceNote: def.source_note?.includes('{') ? text(def.source_note) : def.source_note || undefined,
    live: def.live_yn === 'Y',
    symbol: def.default_symbol ? { default: def.default_symbol } : undefined,
    api: {
      endpoint: def.endpoint || undefined,
      dataPath: def.data_path || undefined,
      refresh: def.refresh_sec ? def.refresh_sec * 1000 : undefined,
      extra: Object.keys(extra).length ? extra : undefined,
      prepare: fn?.prepare ? (rows) => fn.prepare(rows, options) : undefined,
      transform: fn?.apply ? (rows, ctx) => fn.apply(rows, ctx, options) : undefined,
    },
    // 데이터 소스의 처음 값 (endpoint 에 {provider} 가 있을 때). 비우면 서버가 고른다
    provider: provider || undefined,
    controls: (def.params || []).map((p) => {
      const opts = (p.options || []).map((o) => ({ value: o.value, label: o.label, params: coerceAll(o.params) }));
      const from = optionsFrom[p.param_name];
      return {
        name: p.param_name,
        label: p.label,
        default: p.param_value ?? '',
        options: opts,
        optionsFrom: from,
        kind: controlKind(p.param_name, opts, from),
      };
    }),
    quotes,
    view: def.view_type,
    options,
    empty: (ctx) => fillText(ctx.tab?.emptyText || def.empty_text, { ...ctx.params, symbol: ctx.symbol }),
  };
}

// 정의 객체마다 한 번만 만든다 — 스펙이 렌더마다 새 객체면 DataWidget 이 매번 다시 계산한다
const specs = new WeakMap();

/** 기본 제공 위젯 정의 → DataWidget 스펙 */
export function toSpec(def) {
  if (!specs.has(def)) specs.set(def, buildSpec(def));
  return specs.get(def);
}

// ── 메뉴 · 기본 배치 · 크기 ────────────────────────────────────────────────────

const ALL_SCREENS = '*';
const onScreen = (def, pathname) => (def.screens || []).some((s) => s.screen === ALL_SCREENS || s.screen === pathname);

/** 이 화면의 위젯 메뉴에 내놓을 기본 제공 위젯 — 분류(group_name)마다 카테고리 하나 (excludeIds 는 뺀다) */
export function builtinWidgetCategories(defs, pathname, excludeIds = []) {
  const byGroup = new Map();
  for (const def of defs || []) {
    if (!onScreen(def, pathname) || excludeIds.includes(def.widget_id)) continue;
    const group = def.group_name || 'Widgets';
    if (!byGroup.has(group)) byGroup.set(group, { id: `__builtin_${group}`, label: group, widgets: [] });
    byGroup.get(group).widgets.push({ id: def.widget_id, name: def.name, description: def.description });
  }
  return [...byGroup.values()];
}

/** 이 화면·탭의 기본 배치 (저장된 배치가 없을 때의 그리드). DB 에 배치가 없으면 빈 배열 */
export function builtinDefaultWidgets(defs, pathname, tab) {
  return (defs || [])
    .map((def) => ({ def, at: (def.screens || []).find((s) => s.screen === pathname && s.tab === tab && s.x != null) }))
    .filter(({ at }) => at)
    .sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x)
    .map(({ def, at }, i) => ({ id: `w${i}`, type: def.widget_id, x: at.x, y: at.y, w: at.w, h: at.h }));
}

/** { 위젯 id: { w, h, minW, minH } } — registry/widgetSizes 에 등록할 크기 */
export function builtinWidgetSizes(defs) {
  return Object.fromEntries((defs || []).filter((d) => d.size?.w).map((d) => [d.widget_id, d.size]));
}
