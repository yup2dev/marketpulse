/**
 * homeWidgets — 리디자인 시안의 홈 위젯 스펙 (mp-widgets).
 *
 * 위젯 = API + 뷰. 컴포넌트를 만들지 않고 여기에 스펙만 적는다 (모양은 mp-widgets/README.md).
 * 등록은 widgetEndpoints.js 의 `spec:` 항목, 크기는 widgetSizes.js, 배치는 urlWidgetMap.js.
 * 모든 스펙에는 source 가 있어야 한다 (tests/test_widget_sources.py).
 */
import { defineWidget, normalizeBars } from '../mp-widgets';

const HISTORY = '/stock/history/{symbol}';

// ── 지수 / 환율·원자재 타일 ────────────────────────────────────────────────────
export const indexTiles = defineWidget({
  tabs: [
    {
      id: 'index', label: '지수',
      items: [
        { sym: '^GSPC', name: 'S&P 500' },    { sym: '^NDX',  name: 'Nasdaq 100' },
        { sym: '^DJI',  name: 'Dow 30' },     { sym: '^RUT',  name: 'Russell 2000' },
        { sym: '^KS11', name: 'KOSPI' },      { sym: '^KQ11', name: 'KOSDAQ' },
        { sym: '^N225', name: 'Nikkei 225' }, { sym: '^VIX',  name: 'VIX' },
      ],
    },
    {
      id: 'fxcmd', label: '환율 · 원자재',
      items: [
        { sym: 'KRW=X',    name: 'USD/KRW' }, { sym: 'JPY=X',    name: 'USD/JPY' },
        { sym: 'EURUSD=X', name: 'EUR/USD' }, { sym: 'DX-Y.NYB', name: 'Dollar Index' },
        { sym: 'GC=F',     name: 'Gold' },    { sym: 'CL=F',     name: 'WTI' },
        { sym: 'BTC-USD',  name: 'Bitcoin' }, { sym: '^TNX',     name: 'US 10Y' },
      ],
    },
  ],
  source: 'yahoo',
  quotes: { key: 'sym' },
  view: 'tiles',
  options: { symbol: 'sym', label: 'name', series: `${HISTORY}?period=2d&interval=5m` },
});

// ── 주요 일정 (오늘의 경제 캘린더) ─────────────────────────────────────────────
export const keyEvents = defineWidget({
  title: '주요 일정',
  source: 'nasdaq',
  api: {
    endpoint: '/data/nasdaq/economic_calendar?date={today}',
    // 시각 순 (시각이 없는 종일 일정은 맨 위)
    transform: (rows) => rows
      .map((ev, i) => ({ ev, i }))
      .sort((a, b) => String(a.ev.time || '').localeCompare(String(b.ev.time || '')) || a.i - b.i)
      .map(({ ev }) => ev),
  },
  view: 'list',
  options: {
    time: 'time',
    title: 'event',
    sub: 'country',
    value: (ev) => ev.actual || (ev.consensus ? `예상 ${ev.consensus}` : null),
    valueMuted: (ev) => !ev.actual,
    dot: (ev) => ev.impact === 'high',
    rowHeight: 30,
  },
  empty: '오늘 일정이 없어요',
});

// ── 실시간 랭킹 ────────────────────────────────────────────────────────────────
const RANK_SORT = {
  trade_value: (rows) => [...rows].sort((a, b) => (b.trade_value ?? 0) - (a.trade_value ?? 0)),
  gainers: (rows) => rows.filter((r) => (r.change_rate ?? 0) > 0).sort((a, b) => b.change_rate - a.change_rate),
  losers:  (rows) => rows.filter((r) => (r.change_rate ?? 0) < 0).sort((a, b) => a.change_rate - b.change_rate),
};

export const liveRanking = defineWidget({
  title: '실시간 랭킹',
  source: ['$provider', 'live'],
  api: {
    endpoint: '/stock/ranking/live?market=all&sort_by={sortBy}&limit=30',
    // 실시간 시세가 들어온 뒤의 값으로 거래대금을 다시 계산하고 다시 정렬한다
    transform: (rows, { params }) => RANK_SORT[params.sortBy](rows.map((r) => (
      r.volume != null && r.close_price != null ? { ...r, trade_value: r.volume * r.close_price } : r
    ))),
  },
  controls: [{
    name: 'sortBy', label: '정렬 기준', default: 'trade_value',
    options: [
      { value: 'trade_value', label: '거래대금' },
      { value: 'gainers',     label: '급상승' },
      { value: 'losers',      label: '급하락' },
    ],
  }],
  quotes: { key: 'stk_cd', fields: { close_price: 'price', change_rate: 'change_percent', volume: 'volume' } },
  view: 'table',
  options: {
    columns: [
      { type: 'rank',    header: '순위', width: 56 },
      { type: 'stock',   header: '종목', symbol: 'stk_cd', name: 'stk_nm' },
      { type: 'price',   header: '현재가', field: 'close_price', currency: 'curr' },
      { type: 'change',  header: '등락률', field: 'change_rate' },
      { type: 'compact', header: '거래량', field: 'volume' },
      { type: 'trend',   header: '1일', width: 96, symbol: 'stk_cd', series: `${HISTORY}?period=1d&interval=5m`, toneBy: 'change_rate' },
      { type: 'tag',     header: '산업', width: 112, field: 'sector' },
    ],
  },
  empty: '표시할 종목이 없어요',
});

// ── 미니 차트 (한 종목 캔들) ───────────────────────────────────────────────────
export const miniChart = defineWidget({
  title: '미니 차트',
  source: 'yahoo',
  sourceNote: ({ params }) => params.note,
  symbol: { default: 'NVDA' },
  api: {
    endpoint: `${HISTORY}?period={period}&interval={interval}`,
    // 보여 줄 봉만 남기고, 등락률 기준(그 앞 봉의 종가)을 meta 로 넘긴다
    transform: (rows, { params }) => {
      const bars = normalizeBars(rows);
      if (!bars.length) return [];
      let start = Math.max(0, bars.length - (params.take || bars.length));
      if (params.session) {   // 마지막 거래일만
        const day = String(bars[bars.length - 1].date).slice(0, 10);
        start = bars.findIndex((b) => String(b.date).slice(0, 10) === day);
      }
      // 일봉은 '전일 대비' — 마지막 봉 바로 앞 종가
      const ref = params.interval === '1d' ? bars[bars.length - 2] : bars[start - 1];
      return { rows: bars.slice(start), meta: { prevClose: ref?.close ?? null } };
    },
  },
  controls: [{
    name: 'bar', label: '봉 간격', default: '5m',
    options: [
      { value: '1m',  label: '1분',  params: { period: '1d',  interval: '1m',  take: 90, note: '1분봉' } },
      { value: '5m',  label: '5분',  params: { period: '5d',  interval: '5m',  session: true, note: '5분봉' } },
      { value: '15m', label: '15분', params: { period: '5d',  interval: '15m', take: 80, note: '15분봉' } },
      { value: '1d',  label: '일',   params: { period: '6mo', interval: '1d',  take: 90, note: '일봉' } },
    ],
  }],
  quotes: { key: '$symbol' },
  view: 'candles',
  empty: ({ symbol }) => `${symbol} 차트 데이터가 없어요`,
});

// ── 섹터 히트맵 ────────────────────────────────────────────────────────────────
const PER_SECTOR = 8;   // 섹터마다 시가총액 상위 N개 — 타일에 글자가 들어갈 만큼만
const topStocks = (sectors) => sectors.flatMap((sec) => (sec.stocks || []).slice(0, PER_SECTOR));

export const sectorHeatmap = defineWidget({
  title: '섹터 히트맵',
  source: ['$provider', 'live'],
  sourceNote: '시가총액 기준',
  api: {
    endpoint: '/stock/sector-performance',
    // 섹터 → 종목 행으로 펴고, 등락률은 실시간 시세에서 가져온다 (아직 안 온 종목은 중립색)
    transform: (sectors, { quotes }) => topStocks(sectors).map((s) => ({
      ...s,
      change_pct: quotes[String(s.symbol).toUpperCase()]?.change_percent ?? s.change_pct ?? null,
    })),
  },
  quotes: { symbols: (sectors) => topStocks(sectors).map((s) => s.symbol) },
  view: 'treemap',
  options: { value: 'market_cap', label: 'symbol', change: 'change_pct', group: 'sector', link: 'symbol' },
  empty: '섹터 데이터가 없어요',
});

// ── 속보 / 관심종목 뉴스 ───────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
/** 오늘 기사면 HH:MM, 아니면 MM/DD */
function newsTime(a) {
  const d = new Date(a.published_utc);
  if (Number.isNaN(d.getTime())) return '';
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

export const breakingNews = defineWidget({
  tabs: [
    { id: 'breaking', label: '속보' },
    {
      id: 'watch', label: '관심종목 뉴스',
      filter: (rows, { extra }) => {
        const mine = new Set((extra.favorites || []).map((s) => String(s).toUpperCase()));
        return rows.filter((a) => (a.tickers || []).some((t) => mine.has(String(t).toUpperCase())));
      },
    },
  ],
  source: 'polygon',
  live: true,
  api: {
    endpoint: '/news?limit=50&period=1w',
    refresh: 2 * 60 * 1000,
    extra: { favorites: '/watchlist/my-tickers' },
  },
  view: 'list',
  options: {
    time: newsTime,
    title: 'title',
    href: 'article_url',
    tag: (a) => a.tickers?.[0],
    tagSymbol: true,
  },
  empty: ({ tab, extra }) => {
    if (tab.id !== 'watch') return '뉴스가 없어요';
    return extra.favorites?.length ? '관심 종목 관련 뉴스가 아직 없어요' : '아직 관심 종목이 없어요';
  },
});
