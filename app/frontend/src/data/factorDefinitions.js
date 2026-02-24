/**
 * Factor definitions for the Custom Strategy Builder.
 * Each factor specifies what params it takes and how to render them.
 */

export const FACTORS = {
  // ── Trend ────────────────────────────────────────────────────────────────
  EMA: {
    label: 'EMA', group: 'Trend',
    desc: '지수이동평균 — 최근 가격에 더 높은 가중치',
    formula: 'EMA(n) = P × k + EMA₋₁ × (1−k),  k = 2/(n+1)',
    params: [{ name: 'period', label: 'Period', default: 20, min: 2, max: 500 }],
  },
  SMA: {
    label: 'SMA', group: 'Trend',
    desc: '단순이동평균 — n일 종가 산술평균',
    formula: 'SMA(n) = (P₁ + P₂ + … + Pₙ) / n',
    params: [{ name: 'period', label: 'Period', default: 50, min: 2, max: 500 }],
  },
  VWAP: {
    label: 'VWAP', group: 'Trend',
    desc: '거래량 가중 평균가격 — 누적 기준',
    formula: 'VWAP = Σ(TP × Vol) / Σ(Vol),  TP = (H+L+C)/3',
    params: [],
  },

  // ── Momentum ─────────────────────────────────────────────────────────────
  RSI: {
    label: 'RSI', group: 'Momentum',
    desc: '상대강도지수 — 과매수/과매도 측정 (0~100)',
    formula: 'RSI = 100 − 100/(1+RS),  RS = AvgGain/AvgLoss',
    params: [{ name: 'period', label: 'Period', default: 14, min: 2, max: 100 }],
  },
  MACD_LINE: {
    label: 'MACD Line', group: 'Momentum',
    desc: 'MACD 라인 — 단기/장기 EMA 차이',
    formula: 'MACD = EMA(fast) − EMA(slow)',
    params: [
      { name: 'fast',   label: 'Fast',   default: 12, min: 2, max: 100 },
      { name: 'slow',   label: 'Slow',   default: 26, min: 2, max: 200 },
      { name: 'signal', label: 'Signal', default: 9,  min: 2, max: 50  },
    ],
  },
  MACD_SIGNAL: {
    label: 'MACD Signal', group: 'Momentum',
    desc: 'MACD 시그널 — MACD의 EMA 스무딩',
    formula: 'Signal = EMA(MACD, signal)',
    params: [
      { name: 'fast',   label: 'Fast',   default: 12, min: 2, max: 100 },
      { name: 'slow',   label: 'Slow',   default: 26, min: 2, max: 200 },
      { name: 'signal', label: 'Signal', default: 9,  min: 2, max: 50  },
    ],
  },
  MACD_HIST: {
    label: 'MACD Hist', group: 'Momentum',
    desc: 'MACD 히스토그램 — 모멘텀 강도',
    formula: 'Hist = MACD − Signal',
    params: [
      { name: 'fast',   label: 'Fast',   default: 12, min: 2, max: 100 },
      { name: 'slow',   label: 'Slow',   default: 26, min: 2, max: 200 },
      { name: 'signal', label: 'Signal', default: 9,  min: 2, max: 50  },
    ],
  },
  STOCH_K: {
    label: 'Stoch %K', group: 'Momentum',
    desc: '스토캐스틱 %K — n일 최고/최저 대비 현재 위치 (0~100)',
    formula: '%K = (C − LL) / (HH − LL) × 100',
    params: [
      { name: 'k_period', label: 'K Period', default: 14, min: 2, max: 100 },
      { name: 'd_period', label: 'D Period', default: 3,  min: 1, max: 20  },
    ],
  },
  STOCH_D: {
    label: 'Stoch %D', group: 'Momentum',
    desc: '스토캐스틱 %D — %K의 이동평균 (시그널)',
    formula: '%D = SMA(%K, d_period)',
    params: [
      { name: 'k_period', label: 'K Period', default: 14, min: 2, max: 100 },
      { name: 'd_period', label: 'D Period', default: 3,  min: 1, max: 20  },
    ],
  },

  // ── Volatility ───────────────────────────────────────────────────────────
  BB_UPPER: {
    label: 'BB Upper', group: 'Volatility',
    desc: '볼린저밴드 상단 — 평균 + k×표준편차',
    formula: 'Upper = SMA(n) + k × σ(n)',
    params: [
      { name: 'period',  label: 'Period',  default: 20,  min: 5, max: 200 },
      { name: 'std_dev', label: 'Std Dev', default: 2.0, min: 0.5, max: 5, step: 0.1 },
    ],
  },
  BB_LOWER: {
    label: 'BB Lower', group: 'Volatility',
    desc: '볼린저밴드 하단 — 평균 − k×표준편차',
    formula: 'Lower = SMA(n) − k × σ(n)',
    params: [
      { name: 'period',  label: 'Period',  default: 20,  min: 5, max: 200 },
      { name: 'std_dev', label: 'Std Dev', default: 2.0, min: 0.5, max: 5, step: 0.1 },
    ],
  },
  BB_MID: {
    label: 'BB Mid (SMA)', group: 'Volatility',
    desc: '볼린저밴드 중심선 = SMA(n)',
    formula: 'Mid = SMA(n)',
    params: [
      { name: 'period',  label: 'Period',  default: 20,  min: 5, max: 200 },
      { name: 'std_dev', label: 'Std Dev', default: 2.0, min: 0.5, max: 5, step: 0.1 },
    ],
  },
  ATR: {
    label: 'ATR', group: 'Volatility',
    desc: '평균진폭 — 변동성의 절대적 크기',
    formula: 'TR = max(H−L, |H−C₋₁|, |L−C₋₁|)',
    params: [{ name: 'period', label: 'Period', default: 14, min: 2, max: 100 }],
  },

  // ── Statistical ──────────────────────────────────────────────────────────
  ZSCORE: {
    label: 'Z-Score', group: 'Statistical',
    desc: '롤링 Z-score — 현재 가격의 표준편차 단위 이격도',
    formula: 'Z = (P − SMA(n)) / σ(n)',
    params: [{ name: 'window', label: 'Window', default: 20, min: 5, max: 252 }],
    status: 'available',
  },
  PERCENTILE: {
    label: 'Percentile', group: 'Statistical',
    desc: '롤링 백분위수 — n일 내 현재 가격의 상대 위치 (0~100)',
    formula: 'PCT = rank(P in window) / n × 100',
    params: [{ name: 'window', label: 'Window', default: 60, min: 10, max: 252 }],
    status: 'available',
  },

  // ── Market Sensitivity ───────────────────────────────────────────────────
  BETA: {
    label: 'Beta', group: 'Market Sensitivity',
    desc: '롤링 베타 — 시장 대비 수익률 민감도 (1=시장과 동일, >1=고변동)',
    formula: 'β = Cov(r_asset, r_market) / Var(r_market)',
    params: [
      { name: 'window',    label: 'Window', default: 60,    min: 20, max: 252 },
      { name: 'vs_ticker', label: 'vs.',    default: 'SPY', type: 'text' },
    ],
    status: 'external',
    dataSource: 'price_reference',
    dataNote: '기준 지수(SPY 등) 가격 데이터 필요',
  },
  CORR: {
    label: 'Correlation', group: 'Market Sensitivity',
    desc: '롤링 상관계수 — 시장/섹터와의 가격 방향성 동조화 (−1~+1)',
    formula: 'ρ = Cov(r_a, r_b) / (σ_a × σ_b)',
    params: [
      { name: 'window',    label: 'Window', default: 20,    min: 10, max: 252 },
      { name: 'vs_ticker', label: 'vs.',    default: 'SPY', type: 'text' },
    ],
    status: 'external',
    dataSource: 'price_reference',
    dataNote: '기준 종목 가격 데이터 필요',
  },
  REL_STR: {
    label: 'Relative Strength', group: 'Market Sensitivity',
    desc: '상대강도 — 기준 지수 대비 누적 수익률 비율',
    formula: 'RS = (P / P₀) / (Ref / Ref₀)',
    params: [
      { name: 'period',    label: 'Period', default: 20,    min: 5,  max: 252 },
      { name: 'vs_ticker', label: 'vs.',    default: 'SPY', type: 'text' },
    ],
    status: 'external',
    dataSource: 'price_reference',
    dataNote: '기준 지수 가격 데이터 필요',
  },

  // ── Sentiment ────────────────────────────────────────────────────────────
  NEWS_SENTIMENT: {
    label: 'News Sentiment', group: 'Sentiment',
    desc: '뉴스 감성 점수 — N일 평균 기사 감성 (−1 부정 ~ +1 긍정)',
    formula: 'S = mean(sentiment_score) over lookback days',
    params: [
      { name: 'lookback', label: 'Lookback Days', default: 5,  min: 1, max: 30 },
    ],
    status: 'external',
    dataSource: 'sentiment_db',
    dataNote: 'MarketPulse 뉴스 분석 데이터 필요',
  },
  NEWS_VOLUME: {
    label: 'News Volume', group: 'Sentiment',
    desc: '뉴스 기사 수 — N일 내 관련 기사 개수 (관심도 지표)',
    formula: 'V = count(articles) over lookback days',
    params: [
      { name: 'lookback', label: 'Lookback Days', default: 5,  min: 1, max: 30 },
    ],
    status: 'external',
    dataSource: 'sentiment_db',
    dataNote: 'MarketPulse 뉴스 크롤링 데이터 필요',
  },
  SENTIMENT_DELTA: {
    label: 'Sentiment Delta', group: 'Sentiment',
    desc: '감성 모멘텀 — 단기 vs 장기 감성 점수 차이 (방향성 전환 감지)',
    formula: 'ΔS = SentScore(fast) − SentScore(slow)',
    params: [
      { name: 'fast', label: 'Fast Window', default: 3,  min: 1, max: 14 },
      { name: 'slow', label: 'Slow Window', default: 10, min: 3, max: 30 },
    ],
    status: 'external',
    dataSource: 'sentiment_db',
    dataNote: 'MarketPulse 뉴스 분석 데이터 필요',
  },

  // ── Price ────────────────────────────────────────────────────────────────
  CLOSE:  { label: 'Close',  group: 'Price', desc: '종가', formula: 'C', params: [] },
  OPEN:   { label: 'Open',   group: 'Price', desc: '시가', formula: 'O', params: [] },
  HIGH:   { label: 'High',   group: 'Price', desc: '고가', formula: 'H', params: [] },
  LOW:    { label: 'Low',    group: 'Price', desc: '저가', formula: 'L', params: [] },
  VOLUME: { label: 'Volume', group: 'Volume', desc: '거래량', formula: 'V', params: [] },

  // ── Constant ─────────────────────────────────────────────────────────────
  VALUE: {
    label: 'Value', group: 'Constant',
    desc: '상수값 — 비교 기준선',
    formula: 'k (상수)',
    params: [{ name: 'value', label: 'Number', default: 0, min: -1e9, max: 1e9, step: 0.1 }],
    isValue: true,
  },
};

export const FACTOR_GROUPS = [
  'Trend', 'Momentum', 'Volatility', 'Statistical',
  'Market Sensitivity', 'Sentiment',
  'Price', 'Volume', 'Constant',
];

// Status label helpers
export const FACTOR_STATUS = {
  available: { label: '사용 가능', color: 'text-green-400 bg-green-900/20 border-green-800' },
  external:  { label: '외부 데이터', color: 'text-yellow-400 bg-yellow-900/20 border-yellow-800' },
};

export const GROUP_META = {
  'Trend':              { icon: '📈', color: 'text-cyan-400',   desc: '추세 추종 지표' },
  'Momentum':           { icon: '⚡', color: 'text-yellow-400', desc: '모멘텀/속도 지표' },
  'Volatility':         { icon: '🌊', color: 'text-purple-400', desc: '변동성/밴드 지표' },
  'Statistical':        { icon: '📐', color: 'text-blue-400',   desc: '통계적 이격도 지표' },
  'Market Sensitivity': { icon: '🏦', color: 'text-orange-400', desc: '시장 민감도 팩터' },
  'Sentiment':          { icon: '📰', color: 'text-rose-400',   desc: '뉴스/감성 분석 팩터' },
  'Price':              { icon: '💰', color: 'text-gray-400',   desc: '가격 원데이터' },
  'Volume':             { icon: '📦', color: 'text-gray-400',   desc: '거래량 원데이터' },
  'Constant':           { icon: '🔢', color: 'text-gray-500',   desc: '비교 상수값' },
};

export const OPERATORS = [
  { id: '>',            label: '>' },
  { id: '<',            label: '<' },
  { id: '>=',           label: '>=' },
  { id: '<=',           label: '<=' },
  { id: '==',           label: '==' },
  { id: 'crosses_above', label: 'crosses above ↑' },
  { id: 'crosses_below', label: 'crosses below ↓' },
];

/** Build default factor state for a given factor ID */
export function defaultFactorState(factorId = 'EMA') {
  const def = FACTORS[factorId];
  if (!def) return { factor: factorId, params: {} };
  const params = {};
  def.params.forEach(p => { params[p.name] = p.default; });
  return { factor: factorId, params, ...(def.isValue ? { value: 0 } : {}) };
}

/** Render factor label with current params */
export function factorLabel({ factor, params = {}, value }) {
  const def = FACTORS[factor];
  if (!def) return factor;
  if (def.isValue) return `${value ?? params.value ?? 0}`;
  if (!def.params.length) return def.label;
  const vals = def.params.map(p => params[p.name] ?? p.default).join(',');
  return `${def.label}(${vals})`;
}
