/**
 * 데이터 출처 표기의 단일 기준. 모든 위젯 하단에 `Source: …` 로 붙는다.
 *
 * id 는 서버 응답(OBBject)의 provider 값 = data_fetcher/providers/ 디렉터리 이름(+ 라우트 고유 값).
 * 가능하면 응답의 provider 를 그대로 넘긴다 — 실제로 답한 소스라 폴백(KIS→Yahoo 등)도 정확히 보인다.
 * 새 provider 를 추가하면 여기 라벨도 추가한다 (tests/test_widget_sources.py 가 확인).
 */
export const SOURCE_LABELS = {
  // 외부 데이터 provider
  fred:          'FRED (St. Louis Fed)',
  yahoo:         'Yahoo Finance',
  polygon:       'Polygon.io',
  fmp:           'Financial Modeling Prep',
  sec:           'SEC EDGAR',
  nasdaq:        'Nasdaq',
  nasdaqtrader:  'Nasdaq Trader',
  kis:           'Korea Investment & Securities (KIS)',
  krx:           'KRX',
  ecos:          'Bank of Korea (ECOS)',
  oecd:          'OECD',
  imf:           'IMF',
  bls:           'U.S. BLS',
  eia:           'U.S. EIA',
  wsj:           'WSJ',
  whalewisdom:   'WhaleWisdom',
  tiingo:        'Tiingo',
  alphavantage:  'Alpha Vantage',
  social:        'Reddit · StockTwits',
  bond:          'Bond market data',
  tradingview:   'TradingView',
  // 계산·적재·사용자 데이터
  quantitative:  'Yahoo Finance prices (computed)',
  quantlib:      'QuantLib (computed)',
  db:            'MarketPulse DB',
  database:      'MarketPulse DB',
  screener:      'MarketPulse DB (screener)',
  backtest:      'Computed in browser',
  user:          'Your data',
  live:          'Live quotes (Polygon · KIS stream)',
};

/** id 또는 이미 사람이 읽는 라벨 → 표기. 모르는 id 는 그대로 보여 준다. */
export function sourceLabel(id) {
  if (id == null || id === '') return '';
  return SOURCE_LABELS[String(id).toLowerCase()] ?? String(id);
}

/** string | string[] → 중복 없는 라벨 목록 */
export function sourceLabels(source) {
  const ids = Array.isArray(source) ? source : [source];
  return [...new Set(ids.map(sourceLabel).filter(Boolean))];
}

/**
 * 엔드포인트만 보고 알 수 있는 provider — 응답이 오기 전에도 출처를 띄우기 위해.
 * `/data/{provider}/…` 게이트웨이와 `?provider=` 쿼리를 읽는다.
 */
export function providerFromEndpoint(endpoint) {
  if (!endpoint) return null;
  const gw = /^\/data\/([a-z_]+)\//.exec(endpoint);
  if (gw && gw[1] !== '{provider}') return gw[1];
  const qp = /[?&]provider=([a-z_]+)/.exec(endpoint);
  return qp ? qp[1] : null;
}
