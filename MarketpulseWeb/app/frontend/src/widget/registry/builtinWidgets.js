/**
 * builtinWidgets — 기본 제공 위젯의 정의(서버 DB 행)를 mp-widgets 스펙으로 바꾼다.
 *
 * 정의의 주인은 DB 다 (user_widgets 계열, user_id NULL — GET /api/user-widgets/builtin).
 * 엔드포인트·컬럼·탭·심볼 목록·선택지·기본 배치·크기는 전부 행이고, 이 파일에는 위젯이 없다.
 * 여기 있는 것은 행에 담을 수 없는 것뿐이다:
 *
 *   TRANSFORMS   행을 다듬는 함수 — DB 에는 이름만 있다 (코드 TRANSFORM)
 *   TAB_FILTERS  탭에서 행을 거르는 함수 (코드 TAB_FILTER)
 *   toSpec()     정의 → DataWidget 스펙 (widget/engine/README.md 의 모양)
 *
 * 새 위젯은 행을 넣는다. 함수가 새로 필요할 때만 여기에 이름을 추가하고,
 * 같은 이름을 서버 코드값(services/user_widget_service.CODES)에도 올린다.
 */
import { normalizeBars, fmtPct, fmtPrice, fmtCompact } from '../engine';

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
      const pct = (v, digits = 2) => fmtPct(v, digits, { sign: false, empty: null });
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

  // ── 종목 · 뉴스 탭 ──
  // 기사: 발행처 · '6시간 전' 표기(_time)
  news_articles: {
    apply: (rows) => rows
      .filter((a) => a.title)
      .sort((a, b) => new Date(b.published_utc) - new Date(a.published_utc))
      .map((a) => ({ ...a, _time: timeAgo(a.published_utc) })),
  },

  // 공시 표: 최신 순 + 내용(_subject) + 정기 보고서 강조(_tone)
  filing_rows: {
    apply: (rows) => rows
      .filter((f) => f.filing_date)
      .sort((a, b) => String(b.filing_date).localeCompare(String(a.filing_date)))
      .map((f) => ({
        ...f,
        _date: String(f.filing_date).slice(0, 10),
        _subject: filingSubject(f) || f.report_type || '',
        _periodic: isPeriodic(f),
        _tone: isPeriodic(f) ? 'accent' : undefined,
      })),
  },

  // ── 기관 (13F) ──
  // 고른 기관의 요약 줄: 누구(로고·이름·제출일) + 보유가치 · 종목 수 · 전분기 대비 · 회전율 · 신규/청산
  inst_kpis: {
    apply: (rows) => {
      const h = rows[0];
      if (!h) return [];
      const who = h.name || h.manager || h.institution_key;
      return [
        {
          id: 'who', lead: true, label: who,
          value: [h.manager && h.manager !== who ? h.manager : null, h.filing_date ? `13F 제출 ${h.filing_date}` : null]
            .filter(Boolean).join(' · '),
        },
        { id: 'value', label: '총 보유가치', value: h.total_value != null ? `$${fmtCompact(h.total_value, 2)}` : null },
        { id: 'count', label: '보유 종목', value: h.num_holdings != null ? Number(h.num_holdings).toLocaleString('en-US') : null },
        { id: 'qoq', label: '전분기 대비', value: fmtPct(h.value_change_pct, 1) || null, tone: h.value_change_pct },
        { id: 'turn', label: '회전율', value: h.turnover != null ? `${Number(h.turnover).toFixed(1)}%` : null },
        {
          id: 'moves', label: '신규 · 청산',
          value: h.num_new_positions != null || h.num_sold_out != null ? `${h.num_new_positions ?? 0} · ${h.num_sold_out ?? 0}` : null,
          sub: h.num_increased != null || h.num_decreased != null ? `확대 ${h.num_increased ?? 0} · 축소 ${h.num_decreased ?? 0}` : null,
        },
      ].filter((r) => r.lead || r.value != null);
    },
  },

  // 기관 순위: 고른 기준(sortBy) 큰 순. 기관 이름(_name)
  inst_rank: {
    apply: (rows, { params }) => {
      const by = params.sortBy || 'total_value';
      return rows
        .filter((r) => r.total_value != null)
        .map((r) => ({ ...r, _name: r.name || r.manager || r.institution_key }))
        .sort((a, b) => (b[by] ?? -Infinity) - (a[by] ?? -Infinity));
    },
  },

  // 고른 기관의 보유 종목 / 청산한 종목 (+ 매매 구분 꼬리표)
  inst_stocks: { apply: (rows) => (rows[0]?.stocks || []).map(holdingMove) },
  inst_sold: { apply: (rows) => (rows[0]?.sold_positions || []).map((s) => ({ ...holdingMove(s), _move: '청산', _tone: 'down' })) },

  // 13F 로 추정한 분기 수익률: 오래된 것부터 + 막대 이름('25 Q2') + 누적 수익률을 meta 로
  fund_perf: { apply: (rows) => fundPerf(rows) },
  // 같은 값을 표로 — 최신 분기부터
  fund_perf_table: {
    apply: (rows) => {
      const out = fundPerf(rows);
      return { rows: [...out.rows].reverse(), meta: out.meta };
    },
  },

  // ── 백테스트 실행 결과 (전략 실행 한 건: metrics · equity · trades — /api/strategies/result) ──
  // 성과 요약 줄: 전략 값 + 아래에 보유(buy & hold) 값
  bt_kpis: {
    apply: (rows) => {
      const run = rows[0];
      const m = run?.metrics;
      if (!m) return [];
      const b = m.benchmark || {};
      const num = (v, d = 2) => (v == null ? null : Number(v).toFixed(d));
      // 아래 줄 = 벤치마크 값 (포트폴리오 전략은 고른 지수 이름, 예전 단일 종목 실행은 보유)
      const hold = (v) => (v == null || v === '' ? null : `${b.name || '보유'} ${v}`);
      return [
        { id: 'run', lead: true, label: run.name || 'Backtest', value: [m.start, m.end].filter(Boolean).map((d) => String(d).slice(0, 10)).join(' – ') },
        { id: 'total', label: '누적 수익률', value: fmtPct(m.totalReturn, 1) || null, tone: m.totalReturn, sub: hold(fmtPct(b.totalReturn, 1)) },
        { id: 'cagr', label: 'CAGR', value: fmtPct(m.cagr, 1) || null, tone: m.cagr, sub: hold(fmtPct(b.cagr, 1)) },
        { id: 'sharpe', label: '샤프', value: num(m.sharpe), sub: hold(num(b.sharpe)) },
        { id: 'sortino', label: '소르티노', value: num(m.sortino) },
        { id: 'mdd', label: '최대 낙폭', value: fmtPct(m.maxDrawdown, 1) || null, tone: m.maxDrawdown, sub: hold(fmtPct(b.maxDrawdown, 1)) },
        { id: 'vol', label: '변동성 (연)', value: m.volatility != null ? `${num(m.volatility, 1)}%` : null, sub: hold(b.volatility != null ? `${num(b.volatility, 1)}%` : null) },
        { id: 'win', label: '승률', value: m.winRate != null ? `${Math.round(m.winRate)}%` : null, sub: m.trades != null ? `거래 ${m.trades}회` : null },
        { id: 'avg', label: '평균 거래', value: fmtPct(m.avgTrade, 2) || null, tone: m.avgTrade, sub: m.turnover != null ? `회전율 ${Math.round(m.turnover)}%` : m.exposure != null ? `노출 ${Math.round(m.exposure)}%` : null },
      ].filter((r) => r.lead || r.value != null);
    },
  },

  // 누적 수익(%) · 낙폭(%) — 고른 기간(months)의 시작점을 0 으로 다시 맞춘다
  bt_equity: {
    apply: (rows, { params }) => {
      const pts = windowed(rows[0]?.equity || [], Number(params.months) || 0, 'date');
      if (pts.length < 2) return [];
      const s0 = pts[0].strategy || 1;
      const b0 = pts[0].benchmark || 1;
      let peak = -Infinity;
      return pts.map((p) => {
        const s = p.strategy / s0;
        peak = Math.max(peak, s);
        return { date: String(p.date), strategy: (s - 1) * 100, benchmark: (p.benchmark / b0 - 1) * 100, drawdown: (s / peak - 1) * 100 };
      });
    },
  },

  // 월별 수익률(%) — 월말 자산을 앞 달 월말과 비교 (첫 달은 시작점 대비)
  bt_monthly: {
    apply: (rows) => {
      const pts = rows[0]?.equity || [];
      const ends = [];   // [{ key: 'YYYY-MM', value }] — 달마다 마지막 점
      for (const p of pts) {
        const key = String(p.date).slice(0, 7);
        if (ends.length && ends[ends.length - 1].key === key) ends[ends.length - 1].value = p.strategy;
        else ends.push({ key, value: p.strategy });
      }
      let prev = pts[0]?.strategy;
      return ends.map(({ key, value }) => {
        const ret = prev ? (value / prev - 1) * 100 : null;
        prev = value;
        return { year: key.slice(0, 4), month: Number(key.slice(5, 7)), value: ret };
      });
    },
  },

  // 거래 내역 — 최근 청산부터, 고른 기간 안의 것만. 아직 들고 있는 거래는 '보유 중'
  bt_trades: {
    apply: (rows, { params }) => {
      const trades = rows[0]?.trades || [];
      const sorted = [...trades].sort((a, b) => String(b.exitDate).localeCompare(String(a.exitDate)));
      return windowed(sorted.reverse(), Number(params.months) || 0, 'exitDate', false).reverse().map((t) => ({
        ...t,
        _entry: String(t.entryDate).slice(0, 10),
        _exit: String(t.exitDate).slice(0, 10),
        _state: t.open ? '보유 중' : '청산',
        _tone: t.open ? 'accent' : undefined,
      }));
    },
  },

  // 롤링 샤프 — 창은 1년(자료가 짧으면 전체의 1/3), 연환산. 창 길이를 meta 로
  bt_rolling: {
    apply: (rows) => {
      const pts = rows[0]?.equity || [];
      const n = pts.length;
      if (n < 30) return [];
      const years = (new Date(pts[n - 1].date) - new Date(pts[0].date)) / (365.25 * 86400e3);
      const ppy = years > 0 ? (n - 1) / years : 252;
      const win = Math.max(10, Math.min(Math.round(ppy), Math.floor(n / 3)));
      const rets = pts.map((p, i) => (i ? p.strategy / pts[i - 1].strategy - 1 : 0));
      const out = [];
      for (let i = win; i < n; i += 1) {
        const w = rets.slice(i - win + 1, i + 1);
        const mean = w.reduce((a, b) => a + b, 0) / w.length;
        const sd = Math.sqrt(w.reduce((a, b) => a + (b - mean) ** 2, 0) / (w.length - 1));
        out.push({ date: String(pts[i].date), sharpe: sd > 0 ? (mean / sd) * Math.sqrt(ppy) : null });
      }
      return { rows: out, meta: { window: ppy <= 13 ? `${win}개월` : `${win}봉` } };   // 월별 실행(전략)은 개월
    },
  },

  // ── 전략별 손익 (같은 조건으로 전략마다 실행 — /api/strategies/compare) ──
  // 누적 손익(%) 넓은 행 { date, <전략 id>: %, benchmark: % } + 계열(전략 이름)을 meta 로.
  // 전략마다 자기 첫 달을 0 으로 (ML 전략은 표본 밖 구간부터 시작한다). 처음엔 고른 전략 + 앞의 기본 제공 둘 + 벤치마크
  bt_compare: {
    apply: (rows, { params }) => {
      if (!rows.length) return [];
      const byDate = new Map();
      const put = (date, key, v) => {
        const d = String(date).slice(0, 10);
        if (!byDate.has(d)) byDate.set(d, { date: d });
        byDate.get(d)[key] = v;
      };
      for (const r of rows) {
        const pts = r.equity || [];
        const s0 = pts[0]?.strategy || 1;
        for (const p of pts) put(p.date, r.strategy_id, (p.strategy / s0 - 1) * 100);
      }
      // 벤치마크는 기간이 가장 긴 전략의 것
      const longest = rows.reduce((a, b) => ((b.equity?.length || 0) > (a.equity?.length || 0) ? b : a), rows[0]);
      const bpts = longest.equity || [];
      const b0 = bpts[0]?.benchmark || 1;
      for (const p of bpts) if (p.benchmark != null) put(p.date, 'benchmark', (p.benchmark / b0 - 1) * 100);
      const benchName = longest.metrics?.benchmark?.name || '벤치마크';
      const label = (n) => String(n).replace(/[,:]/g, ' ');   // 'id:이름,…' 목록의 구분자와 겹치지 않게
      const series = [...rows.map((r) => `${r.strategy_id}:${label(r.name)}`), `benchmark:${label(benchName)}`].join(',');
      const builtins = rows.filter((r) => r.builtin).map((r) => r.strategy_id);
      const pick = [...new Set([params.strategy, ...builtins.slice(0, 2), 'benchmark'].filter(Boolean))].join(',');
      const out = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
      return { rows: out, meta: { series, pick } };
    },
  },
  // 같은 결과를 표로 — 전략마다 한 줄 + 맨 아래 벤치마크
  bt_compare_table: {
    apply: (rows) => {
      const line = (name, m, extra = {}) => ({
        name,
        totalReturn: m.totalReturn, cagr: m.cagr, maxDrawdown: m.maxDrawdown,
        _sharpe: m.sharpe != null ? Number(m.sharpe).toFixed(2) : null,
        _vol: m.volatility != null ? `${Number(m.volatility).toFixed(1)}%` : null,
        _turnover: m.turnover != null ? `${Math.round(m.turnover)}%` : null,
        _period: [m.start, m.end].filter(Boolean).map((d) => String(d).slice(0, 7)).join(' – '),
        ...extra,
      });
      const out = rows.map((r) => line(r.name, r.metrics || {}, {
        _kind: r.score_kind === 'ml' ? 'ML' : '팩터', _tone: r.score_kind === 'ml' ? 'accent' : undefined,
      }));
      const longest = rows.reduce((a, b) => ((b.metrics?.months || 0) > (a?.metrics?.months || 0) ? b : a), rows[0]);
      const b = longest?.metrics?.benchmark;
      if (b) out.push(line(b.name || '벤치마크', { ...b, start: longest.metrics.start, end: longest.metrics.end }, { _kind: '지수' }));
      return out;
    },
  },

  // ── 퀀트 (로컬 배치가 계산해 적재한 값 — /api/quant/*) ──
  // 팩터 표: 합성은 맨 아래. 머리줄에서 고른 전략(응답 metadata.weights)이 쓰는 팩터만 스위치가 켜지고 비중이 붙는다.
  // 스위치는 읽기 전용 — 바꾸려면 전략 설정 탭. 전략 정보가 없으면(적재값 그대로) 6개 동일 비중 합성
  quant_factors: {
    apply: (rows, { response }) => {
      const md = response?.metadata || {};
      const weights = md.weights || null;
      const ml = md.score_kind === 'ml';
      const singles = rows.filter((f) => !f.composite);
      const on = (f) => (weights ? Number(weights[f.id]) > 0 : !ml);
      const used = singles.filter(on).length;
      return {
        rows: [...rows].sort((a, b) => Number(!!a.composite) - Number(!!b.composite)).map((f) => {
          const isOn = !f.composite && on(f);
          const w = weights ? Number(weights[f.id]) : (isOn && used ? 100 / used : null);
          return {
            ...f,
            name: f.composite && !md.strategy ? `${f.name} (전체)` : f.name,
            _toggle: f.composite ? null : isOn,
            _w: f.composite ? '100%' : isOn && w ? `${Math.round(w)}%` : '—',
            _off: !f.composite && !isOn,
            _ic: f.ic != null ? Number(f.ic).toFixed(3) : null,
            _icir: f.icir != null ? Number(f.icir).toFixed(2) : null,
            _hit: f.hit != null ? `${Math.round(f.hit)}%` : null,
            _tone: f.composite ? 'accent' : undefined,
            _kind: f.composite ? (ml ? 'ML' : '합성') : '',
          };
        }),
        meta: {
          ...quantMeta(response),
          used: ml
            ? `${md.strategy} — 팩터 대신 ${md.composite_name || 'ML 확률'}`
            : `${md.strategy ? `${md.strategy} · ` : ''}켜진 팩터 ${used}개`,
        },
      };
    },
  },
  // 팩터 성과: 롱숏 곡선의 합성 = 고른 전략 점수. 처음 보이는 계열 = 전략 합성 + 전략이 쓰는 팩터(비중 큰 순)
  quant_returns: {
    apply: (rows, { response }, options = {}) => {
      const md = response?.metadata || {};
      const base = quantMeta(response);
      if (!md.strategy) return { rows, meta: base };
      const name = md.composite_name || '전략 합성';
      const series = String(options.series || '').split(',')
        .map((p) => (p.split(':')[0] === 'composite' ? `composite:${name}` : p)).join(',') || undefined;
      const mine = Object.entries(md.weights || {}).sort((a, b) => b[1] - a[1]).map(([id]) => id);
      return { rows, meta: { ...base, series, pick: ['composite', ...mine].slice(0, Number(options.max) || 4).join(',') } };
    },
  },
  // 그대로 그리되 기준(종목 수 · 기간 · 분위 스프레드)을 meta 로
  quant_meta: {
    apply: (rows, { response }) => ({ rows, meta: quantMeta(response) }),
  },
  // 모델 표: 예측 모델 먼저, 융합(평균 · 스태킹)은 아래 + 표기. 고른 ML 전략이 쓰는 모델(used)엔 '전략 점수'
  quant_models: {
    apply: (rows, { response }) => ({
      rows: [...rows].sort((a, b) => Number(!!a.fusion) - Number(!!b.fusion)).map((m) => ({
        ...m,
        _acc: m.accuracy != null ? `${Number(m.accuracy).toFixed(1)}%` : null,
        _auc: m.auc != null ? Number(m.auc).toFixed(3) : null,
        _sharpe: m.sharpe != null ? Number(m.sharpe).toFixed(2) : null,
        _kind: m.used ? '전략 점수' : m.fusion ? '융합' : '',
        _tone: m.used || m.fusion ? 'accent' : undefined,
      })),
      meta: quantMeta(response),
    }),
  },
  // 종목 시그널: 고른 융합 방식(method)의 확률 큰 순. 상위 10% 매수 · 하위 10% 매도 (그 달 종목 안에서의 순위)
  quant_signals: {
    apply: (rows, { params, response }) => {
      const by = params.method || 'stack';
      const list = rows.filter((r) => r[by] != null).sort((a, b) => b[by] - a[by]);
      const edge = Math.max(1, Math.round(list.length * 0.1));
      return {
        rows: list.map((r, i) => {
          const buy = i < edge;
          const sell = i >= list.length - edge;
          return {
            ...r,
            _score: r[by] * 100,
            _signal: buy ? '매수' : sell ? '매도' : '중립',
            _tone: buy ? 'up' : sell ? 'down' : undefined,
          };
        }),
        meta: quantMeta(response),
      };
    },
  },
  // 이번 달 순위: 서버가 전략 점수 순으로 준다 (상위 top_n 이 buy). 점수 = ML 확률 ×100 또는 팩터 가중 z
  quant_ranking: {
    apply: (rows, { response }) => {
      const md = response?.metadata || {};
      const ml = md.score_kind === 'ml';
      return {
        rows: rows.map((r) => ({
          ...r,
          _score: r.score == null ? null : ml ? r.score * 100 : r.score,
          _signal: r.buy ? '매수' : '—',
          _tone: r.buy ? 'up' : undefined,
        })),
        meta: { ...quantMeta(response), topN: md.top_n ?? '' },
      };
    },
  },
};

/** 퀀트 응답의 metadata → 출처 옆 설명에 쓸 값 */
function quantMeta(response) {
  const md = response?.metadata || {};
  return {
    asOf: md.as_of || '',
    members: md.members ?? '',
    signalDate: md.signal_date || md.as_of || '',
    oos: md.oos_months ?? '',
    spread: md.spread != null ? `${fmtPct(md.spread, 1)}p` : '',
    regime: { bull: '강세', side: '횡보', bear: '약세' }[md.current || md.regime_current] || '',
    strategy: md.strategy || '전체 팩터 동일 비중',
  };
}

/** '6시간 전' · '3일 전' · 일주일이 넘으면 MM/DD */
function timeAgo(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const min = (Date.now() - t) / 60000;
  if (min < 60) return `${Math.max(1, Math.round(min))}분 전`;
  if (min < 1440) return `${Math.round(min / 60)}시간 전`;
  if (min < 1440 * 7) return `${Math.round(min / 1440)}일 전`;
  const d = new Date(t);
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

const isPeriodic = (f) => ['10-K', '10-Q'].includes(String(f.report_type || '').replace('/A', ''));

/** 13F 보유 종목 한 줄 + 매매 구분(_move · _tone) — 상태 값이 없으면 주식 수 변화의 부호로 */
function holdingMove(s) {
  const status = String(s.status || '').toLowerCase();
  const chg = s.share_change_pct ?? s.share_change;
  let move = '';
  let tone;
  if (status.includes('new')) { move = '신규'; tone = 'accent'; }
  else if (status.includes('sold') || status.includes('exit')) { move = '청산'; tone = 'down'; }
  else if (status.includes('incr') || status.includes('add') || chg > 0) { move = '확대'; tone = 'up'; }
  else if (status.includes('decr') || status.includes('reduc') || chg < 0) { move = '축소'; tone = 'down'; }
  return { ...s, _move: move, _tone: tone };
}

function fundPerf(rows) {
  const list = rows.filter((r) => r.period && r.return_pct != null)
    .sort((a, b) => String(a.period).localeCompare(String(b.period)));
  const last = list[list.length - 1];
  return {
    rows: list.map((r) => {
      const month = Number(String(r.period).slice(5, 7));
      return { ...r, _label: `${String(r.period).slice(2, 4)} Q${Math.ceil(month / 3)}` };
    }),
    meta: { cumulative: fmtPct(last?.cumulative_return_pct, 1) || '—', quarters: list.length },
  };
}

/**
 * 마지막 점에서 months 개월 안의 점만 (0 = 전부). 날짜는 key 필드.
 * 남는 점이 2개 미만이면 전부 돌려준다 (keepAll = false 면 그대로 거른다 — 목록용).
 */
function windowed(points, months, key, keepAll = true) {
  if (!months || !points.length) return points;
  const from = new Date(points[points.length - 1][key]);
  if (Number.isNaN(from.getTime())) return points;
  from.setMonth(from.getMonth() - months);
  const out = points.filter((p) => new Date(p[key]) >= from);
  return keepAll && out.length < 2 ? points : out;
}

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
  // 공시 표(filing_rows)에서 정기 보고서(10-K · 10-Q)만 / 그 밖(8-K 등)만
  filings_periodic: (rows) => rows.filter((r) => r._periodic),
  filings_current: (rows) => rows.filter((r) => !r._periodic),
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
    case 'bar':   return { ...col, field: f.field_name, suffix: f.sub_field ?? undefined };
    case 'badge': return { ...col, field: f.field_name, toneBy: f.sub_field };
    case 'link':  return { ...col, field: f.field_name, href: f.sub_field };
    case 'switch': return { ...col, field: f.field_name, variable: f.sub_field, labelField: 'name' };
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
  let keepProvider = false;   // 컨트롤(정렬 등)을 바꿔도 고른 데이터 소스를 유지 — 후보가 조건과 무관할 때
  let shared;   // 화면 변수 이름들 — 같은 이름을 쓰는 위젯이 값을 같이 따른다 (widget/engine/shared.js)
  let highlight;   // '화면 변수:값' — 그 변수가 이 값이면 패널 테두리를 강조 (퀀트 워크플로 단계)
  for (const [k, v] of Object.entries(all)) {
    if (k.startsWith('extra.')) extra[k.slice('extra.'.length)] = v;
    else if (k.startsWith('tab.')) {
      const [, code, ...name] = k.split('.');
      (byTab[code] ||= {})[name.join('.')] = v;
    } else if (k.startsWith('optionsFrom.')) {
      // 'optionsFrom.<컨트롤>' = '경로|값 필드|이름 필드[|keep]' — 선택지를 요청으로 채운다 (keep = 정의의 선택지도 남긴다)
      const [endpoint, value = 'value', label = 'label', keep] = String(v).split('|');
      optionsFrom[k.slice('optionsFrom.'.length)] = { endpoint, value, label, keep: keep === 'keep' };
    } else if (k === 'provider') provider = String(v);
    else if (k === 'shared') shared = String(v).split(',').map((s) => s.trim()).filter(Boolean);
    else if (k === 'keepProvider') keepProvider = v === true || v === 'true';
    else if (k === 'highlight') {
      const [name, value] = String(v).split(':');
      highlight = { name, value };
    }
    else options[k] = v;
  }

  const fields = def.fields || [];
  // 표 컬럼 — 뷰가 표가 아니어도 표로 그리는 탭(tab.<탭>.view = table)이 쓴다
  const columns = fields.filter((f) => f.field_role === 'COLUMN').map((f) => toColumn(f, options.series));
  if (columns.length || def.view_type === 'table') options.columns = columns;
  if (def.view_type !== 'table') {
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
    keepProvider,
    shared,
    highlight,
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

/** { 위젯 id: { w, h, minW, minH } } — widget/registry/widgetSizes 에 등록할 크기 */
export function builtinWidgetSizes(defs) {
  return Object.fromEntries((defs || []).filter((d) => d.size?.w).map((d) => [d.widget_id, d.size]));
}
