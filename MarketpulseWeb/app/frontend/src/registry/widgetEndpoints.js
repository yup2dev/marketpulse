/**
 * widgetEndpoints — single source of truth for every widget type.
 *
 * Entry shape:
 *   {
 *     title:       string,
 *     endpoint:    '/path/{symbol}'        // {placeholder} → from params or outer state
 *     dataPath?:   'result' | 'a.b.c'       // dotted path to unwrap response → rows / object
 *     display?:    'kv'                     // flat object → metric/value 2-col table
 *     category?:   'dividends'              // 전용 라우트의 QueryExecutor model 키.
 *                                           //   이 값이 있으면 UniversalWidget이 헤더에
 *                                           //   provider 셀렉터를 띄우고 ?provider= 를 주입한다.
 *                                           //   (해당 category 지원 provider가 2개 이상일 때만 노출)
 *     provider?:   'yahoo'                  // 초기 provider(전용 라우트 기본값과 동일하게 유지)
 *     params?:     [{                       // inline form; values feed {placeholder} + querystring
 *       name, label?, kind: 'text'|'number'|'date'|'select',
 *       default, options?, step?, hint?, upper?,
 *       pin?, chip?,                         //   헤더 버튼에 현재 값을 칩으로 — chip(v) 로 표기를 바꿀 수 있다 (예: v => `${v}D`)
 *       showIf?,                             //   { metric: 'quantile' } — 조건이 맞을 때만 입력칸·요청에 포함
 *     }]                                     //   name 'symbol' 은 폼이 아니라 헤더 심볼 칩으로 올라간다
 *     titleFrom?:  'institution_key'         // 그 param 의 현재 값 라벨을 제목 뒤에 붙인다
 *     kv?:         { primary, hide, labels } // display:'kv' — primary 는 큰 타일, hide 는 숨김
 *     columns?:    { hide, order, labels }   // 자동 컬럼 손질 (내부 키 숨기기 등)
 *
 * UI 라벨(title·label·hint)은 영어로 쓴다.
 *     expandable?: { keyField, endpoint, dataPath? }
 *     component?:  Component                // escape hatch — only for portfolio widgets that need
 *                                           //   non-API state (e.g. portfolioData)
 *     propsFrom?:  ['symbol'|'portfolioId']  // which extra props to inject into custom component
 *   }
 *
 * Add a new widget: add an entry here, reference id in urlWidgetMap.js.
 */
import PortfolioStatsWidget          from '../components/widgets/PortfolioStatsWidget';
import InstitutionalPortfoliosWidget from '../components/widgets/InstitutionalPortfoliosWidget';
import WatchlistWidget         from '../components/widgets/WatchlistWidget';
import ScreenerWidget          from '../components/widgets/ScreenerWidget';
import MarketRankingWidget     from '../components/widgets/MarketRankingWidget';
import AlertsWidget            from '../components/widgets/AlertsWidget';
import NewsFeedWidget          from '../components/widgets/NewsFeedWidget';
import SparklineWidget         from '../components/widgets/SparklineWidget';
import TradingViewIndexChartsWidget from '../components/widgets/TradingViewIndexChartsWidget';
import TradingViewRankingWidget     from '../components/widgets/TradingViewRankingWidget';
import TradingViewMiniChartWidget   from '../components/widgets/TradingViewMiniChartWidget';
import ComparisonWidget        from '../components/widgets/ComparisonWidget';
import ChartWidget             from '../components/widgets/ChartWidget';
import BacktestLabWidget       from '../components/widgets/BacktestLabWidget';
import BtVariablesWidget        from '../components/widgets/backtest/BtVariablesWidget';
import BtVariableExplorerWidget from '../components/widgets/backtest/BtVariableExplorerWidget';
import BtEventsWidget           from '../components/widgets/backtest/BtEventsWidget';
import BtEventStudyWidget       from '../components/widgets/backtest/BtEventStudyWidget';
import BtStrategyWidget         from '../components/widgets/backtest/BtStrategyWidget';
import BtResultsWidget          from '../components/widgets/backtest/BtResultsWidget';
import HeatmapWidget           from '../components/widgets/HeatmapWidget';
import CorrelationWidget       from '../components/widgets/CorrelationWidget';
import NoteWidget              from '../components/widgets/NoteWidget';
import EconomicCalendarWidget  from '../components/widgets/EconomicCalendarWidget';
import EarningsCalendarWidget  from '../components/widgets/EarningsCalendarWidget';
import ResearchReportsWidget   from '../components/widgets/ResearchReportsWidget';

// ── date helpers (used by quant param defaults) ─────────────────────────────
const isoDate = (d) => d.toISOString().slice(0, 10);
const today      = () => isoDate(new Date());
const yearsAgo   = (n) => { const d = new Date(); d.setFullYear(d.getFullYear() - n); return isoDate(d); };
const monthsAhead = (n) => { const d = new Date(); d.setMonth(d.getMonth() + n); return isoDate(d); };

const TARGET_OPTIONS = ['close', 'open', 'high', 'low', 'adj_close', 'return'];

// 지표 개념 위젯 — 국가 셀렉터는 그 개념이 지원하는 국가로 채운다(실패 시 정적 목록).
const conceptWidget = (concept, title, country = 'USA') => ({
  title,
  concept,
  params: [
    { name: 'country', label: 'Country', kind: 'select', default: country, pin: true,
      optionsFrom: { endpoint: `/concepts/${concept}/countries`, value: 'code', label: 'label' },
      options: [{ value: 'USA', label: 'United States' }, { value: 'KOR', label: 'Korea' }] },
  ],
});

export const WIDGET_ENDPOINTS = {

  // ── Institutional 13F ─────────────────────────────────────────────────────
  'institutional-portfolios': {
    title:     'Institutional Portfolios',
    component: InstitutionalPortfoliosWidget,
    propsFrom: ['symbol'],
  },

  // 13F 보유종목 기반 '추정' 분기 수익률. 실제 NAV 수익률이 아니다(헤지펀드 실수익률은
  // 비공시). coverage_pct/derivative_weight_pct 컬럼이 신뢰도 지표라 차트가 아닌
  // 테이블로 노출한다 — 수익률만 그리면 커버리지 경고가 사라져 오독된다.
  // 13F 파싱은 로컬 배치가 하고 서버는 적재 DB만 읽으므로 provider 셀렉터를 두지 않는다.
  'fund-performance': {
    title:    'Fund Performance (13F est.)',
    endpoint: '/portfolio/13f/{institution_key}/performance?quarters={quarters}',
    titleFrom: 'institution_key',
    // 모든 행이 같은 펀드라 키·이름 열은 제목으로 대신한다
    columns:  { hide: ['institution_key', 'name'] },
    params: [
      { name: 'institution_key', label: 'Fund', kind: 'select', default: 'situational-awareness', pin: true,
        // 수익률이 적재된 기관으로 채우고, 실패 시 아래 정적 목록 사용
        optionsFrom: { endpoint: '/portfolio/13f/institutions?with_performance=true', value: 'key', label: 'name' },
        options: [
          'situational-awareness', 'berkshire', 'ark', 'pershing', 'tiger',
          'citadel', 'bridgewater', 'appaloosa', 'greenlight', 'thirdpoint',
          'baupost', 'viking', 'millennium', 'soros', 'renaissance',
        ],
        hint: 'situational-awareness = Leopold Aschenbrenner' },
      { name: 'quarters', label: 'Quarters', kind: 'number', default: 8, step: 1, pin: true, chip: (v) => `${v}Q`,
        hint: 'Rows = quarters − 1 (each row compares two quarters)' },
    ],
  },

  // ── Research Reports (PDF 임포트: analyst/estimates/annual) ───────────────
  'research-reports': {
    title:     'Research Reports',
    component: ResearchReportsWidget,
    propsFrom: ['symbol'],
  },

  // ── Stock ──────────────────────────────────────────────────────────────────
  // category/provider: 헤더 provider 셀렉터 노출 + ?provider= 주입 (전용 라우트 기본값 유지).
  'dividend':              { title: 'Dividends',              endpoint: '/stock/dividends/{symbol}', category: 'dividends', provider: 'yahoo' },
  'stock-splits':          { title: 'Stock Splits',           endpoint: '/stock/splits/{symbol}',    category: 'splits',    provider: 'yahoo' },
  'company-filings':       { title: 'SEC Filings',            endpoint: '/stock/filings/{symbol}',   category: 'filings' },
  'earnings':              { title: 'Earnings',               endpoint: '/stock/earnings/{symbol}',  category: 'earnings',  provider: 'polygon' },
  'earnings-history':      { title: 'Earnings History',       endpoint: '/stock/earnings/{symbol}',  category: 'earnings',  provider: 'polygon' },
  'insider':               { title: 'Insider Trading',        endpoint: '/stock/insider-trading/{symbol}', category: 'insider_trading' },
  'ownership-overview':    { title: 'Ownership Overview',     endpoint: '/stock/holders/{symbol}',   category: 'holders',   provider: 'yahoo' },
  'ownership-institutional': { title: 'Institutional Holders', endpoint: '/stock/holders/{symbol}',  category: 'holders',   provider: 'yahoo' },
  'holder-breakdown':      { title: 'Holder Breakdown',        endpoint: '/stock/holders/{symbol}',  category: 'holders',   provider: 'yahoo' },
  'ownership-insider':     { title: 'Insider Activity',       endpoint: '/stock/insider-trading/{symbol}', category: 'insider_trading' },
  'management':            { title: 'Management',             endpoint: '/stock/management/{symbol}', category: 'management', provider: 'yahoo' },
  'swot':                  { title: 'SWOT Analysis',          endpoint: '/stock/swot/{symbol}',      category: 'swot',      provider: 'yahoo' },
  'economic-moat':         { title: 'Economic Moat',          endpoint: '/stock/moat/{symbol}',      category: 'moat',      provider: 'yahoo' },
  'investment-scorecard':  { title: 'Investment Scorecard',   endpoint: '/stock/scorecard/{symbol}', category: 'scorecard', provider: 'yahoo' },
  'stock-sentiment':       { title: 'News Sentiment',         endpoint: '/stock/sentiment/{symbol}' },
  'social-sentiment':      { title: 'Social Sentiment',       endpoint: '/stock/reddit/{symbol}' },
  'financials':            { title: 'Financial Statements',   endpoint: '/stock/financials/{symbol}', category: 'financials' },

  // ── Macro 지표 개념 (provider 무관 — 국가 + '내 키'로 FRED/ECOS/OECD 중 자동 선택) ──
  'concept-cpi':          conceptWidget('cpi_yoy',           'CPI Inflation (%)'),
  'concept-unemployment': conceptWidget('unemployment_rate', 'Unemployment Rate (%)'),
  'concept-policy-rate':  conceptWidget('policy_rate',       'Policy Rate (%)', 'KOR'),
  'concept-long-rate':    conceptWidget('long_rate_10y',     '10Y Government Bond Yield (%)'),
  'concept-gdp-growth':   conceptWidget('real_gdp_growth',   'Real GDP Growth (%)'),

  // ── Macro (Universal Data Gateway 경유) ───────────────────────────────────
  'gdp-forecast':           { title: 'GDP Forecast',           endpoint: '/data/fred/gdp?period={period}' },
  'inflation-momentum':     { title: 'Inflation Momentum',     endpoint: '/data/fred/inflation_momentum?period={period}' },
  'initial-claims':         { title: 'Initial Claims',         endpoint: '/data/fred/initial_claims?period={period}' },
  'jobs-breakdown':         { title: 'Jobs Breakdown',         endpoint: '/data/fred/jobs_breakdown?period={period}' },
  'yield-curve-snapshot':   { title: 'Yield Curve',            endpoint: '/data/fred/yield_curve' },
  'yield-trends':           { title: 'Yield Trends',           endpoint: '/data/fred/yield_curve_history?period={period}' },
  'real-rates':             { title: 'Real Rates (TIPS)',       endpoint: '/data/fred/real_rates?period={period}' },
  'fed-balance-sheet':      { title: 'Fed Balance Sheet',      endpoint: '/data/fred/fed_balance_sheet?period={period}' },
  'inflation-decomp':       { title: 'Inflation Decomposition', endpoint: '/macro/inflation/decomposition' },
  'inflation-trends':       { title: 'Inflation Trends',       endpoint: '/data/fred/inflation_sector?period={period}' },
  'labor-market-dashboard': { title: 'Labor Market',           endpoint: '/data/fred/labor_dashboard' },
  'pmi':                    { title: 'ISM PMI / LEI',           endpoint: '/data/fred/pmi?period={period}' },
  'fin-conditions-tab':     { title: 'Financial Conditions',   endpoint: '/data/fred/financial_conditions' },
  'sentiment-tab':          { title: 'Market Sentiment',       endpoint: '/data/fred/sentiment_composite' },
  'commodities-tab':        { title: 'Commodities',            endpoint: '/macro/fred/series' },

  // ── QuantLib option pricing (form-driven, common-widget) ──────────────────
  'option-pricing': {
    title:    'Option Pricing',
    endpoint: '/quantlib/pricing/option',
    dataPath: 'results.0',
    display:  'kv',
    // 결과에 입력값이 그대로 되돌아온다 — 입력 echo 는 숨기고 그릭스를 타일로
    kv: {
      primary: ['npv', 'delta', 'gamma', 'theta', 'vega', 'rho'],
      hide:    ['option_type', 'exercise_style', 'engine', 'spot', 'strike', 'evaluation_date', 'expiry',
                'volatility', 'risk_free_rate', 'dividend_yield'],
      labels:  { npv: 'NPV', intrinsic_value: 'Intrinsic value', time_value: 'Time value' },
    },
    params: [
      { name: 'option_type',     label: 'Type',     kind: 'select', default: 'call', pin: true,
        options: [{ value: 'call', label: 'Call' }, { value: 'put', label: 'Put' }] },
      { name: 'exercise_style',  label: 'Exercise', kind: 'select', default: 'european',
        options: [{ value: 'european', label: 'European' }, { value: 'american', label: 'American' }] },
      { name: 'engine',          label: 'Engine',   kind: 'select', default: 'analytic', pin: true,
        options: [
          { value: 'analytic', label: 'Black-Scholes' },
          { value: 'binomial', label: 'Binomial (CRR)' },
          { value: 'mc',       label: 'Monte Carlo' },
        ] },
      { name: 'spot',            label: 'Spot (S)',          kind: 'number', default: 100,    step: 0.01 },
      { name: 'strike',          label: 'Strike (K)',        kind: 'number', default: 100,    step: 0.01, pin: true, chip: (v) => `K ${v}` },
      { name: 'evaluation_date', label: 'Eval Date',         kind: 'date',   default: today },
      { name: 'expiry',          label: 'Expiry',            kind: 'date',   default: () => monthsAhead(3) },
      { name: 'volatility',      label: 'Volatility (σ)',    kind: 'number', default: 0.20,   step: 0.01,  hint: '0.20 = 20%' },
      { name: 'risk_free_rate',  label: 'Risk-Free (r)',     kind: 'number', default: 0.04,   step: 0.001, hint: '0.04 = 4%' },
      { name: 'dividend_yield',  label: 'Dividend Yield (q)', kind: 'number', default: 0.0,   step: 0.001 },
    ],
  },

  // ── Quantitative analytics (yfinance + scipy + statsmodels) ───────────────
  'quant-summary': {
    title:    'Quant — Summary',
    endpoint: '/quantitative/summary',
    dataPath: 'results.0',
    display:  'kv',
    kv: {
      primary: ['mean', 'std', 'skew', 'kurtosis'],
      hide:    ['symbol', 'target'],
      labels:  { std: 'Std dev', kurtosis: 'Excess kurtosis', p_50: 'Median' },
    },
    params: [
      { name: 'symbol',     label: 'Symbol', kind: 'text',   default: 'AAPL', upper: true },
      { name: 'target',     label: 'Target', kind: 'select', default: 'close', options: TARGET_OPTIONS, pin: true },
      { name: 'start_date', label: 'Start',  kind: 'date',   default: () => yearsAgo(2) },
      { name: 'end_date',   label: 'End',    kind: 'date',   default: today },
    ],
  },
  'quant-normality': {
    title:    'Quant — Normality',
    endpoint: '/quantitative/normality',
    dataPath: 'results.0.tests',
    params: [
      { name: 'symbol',     label: 'Symbol', kind: 'text',   default: 'AAPL', upper: true },
      { name: 'target',     label: 'Target', kind: 'select', default: 'return', options: TARGET_OPTIONS, pin: true },
      { name: 'start_date', label: 'Start',  kind: 'date',   default: () => yearsAgo(2) },
      { name: 'end_date',   label: 'End',    kind: 'date',   default: today },
    ],
  },
  'quant-capm': {
    title:    'Quant — CAPM',
    endpoint: '/quantitative/capm',
    dataPath: 'results.0',
    display:  'kv',
    kv: {
      primary: ['beta', 'alpha', 'r_squared', 'sharpe_ratio'],
      hide:    ['symbol', 'benchmark'],
      labels:  { r_squared: 'R²', alpha: 'Alpha (ann.)', n: 'Observations' },
    },
    params: [
      { name: 'symbol',         label: 'Symbol',    kind: 'text',   default: 'AAPL', upper: true },
      { name: 'benchmark',      label: 'Benchmark', kind: 'text',   default: '^GSPC', upper: true, pin: true },
      { name: 'risk_free_rate', label: 'Risk-Free', kind: 'number', default: 0.04, step: 0.001, hint: '0.04 = 4%' },
      { name: 'target',         label: 'Target',    kind: 'select', default: 'return', options: TARGET_OPTIONS },
      { name: 'start_date',     label: 'Start',     kind: 'date',   default: () => yearsAgo(2) },
      { name: 'end_date',       label: 'End',       kind: 'date',   default: today },
    ],
  },
  'quant-rolling': {
    title:    'Quant — Rolling',
    endpoint: '/quantitative/rolling',
    dataPath: 'results.0.points',
    chart: {
      defaultType:    'area',
      referenceLines: [{ y: 0, color: '#475569', label: 'zero' }],
    },
    params: [
      { name: 'symbol',         label: 'Symbol', kind: 'text',   default: 'AAPL', upper: true },
      { name: 'metric',         label: 'Metric', kind: 'select', default: 'sharpe', pin: true,
        options: [
          { value: 'sharpe', label: 'Sharpe' }, { value: 'sortino', label: 'Sortino' },
          { value: 'stdev', label: 'Std dev' }, { value: 'mean', label: 'Mean' },
          { value: 'skew', label: 'Skew' }, { value: 'kurtosis', label: 'Kurtosis' },
          { value: 'quantile', label: 'Quantile' },
        ] },
      { name: 'window',         label: 'Window (days)', kind: 'number', default: 21, step: 1, pin: true, chip: (v) => `${v}D` },
      { name: 'target',         label: 'Target', kind: 'select', default: 'return', options: TARGET_OPTIONS },
      { name: 'risk_free_rate', label: 'Risk-Free', kind: 'number', default: 0.04, step: 0.001,
        showIf: { metric: ['sharpe', 'sortino'] } },
      { name: 'quantile_pct',   label: 'Quantile (0-1)', kind: 'number', default: 0.5, step: 0.05, min: 0, max: 1,
        showIf: { metric: 'quantile' } },
      { name: 'start_date',     label: 'Start',  kind: 'date',   default: () => yearsAgo(2) },
      { name: 'end_date',       label: 'End',    kind: 'date',   default: today },
    ],
  },
  'quant-adf': {
    title:    'Quant — ADF (Stationarity)',
    endpoint: '/quantitative/unitroot',
    dataPath: 'results.0',
    display:  'kv',
    kv: {
      primary: ['stationary', 'statistic', 'p_value', 'critical_5pct'],
      hide:    ['symbol', 'target', 'test'],
      labels:  { p_value: 'p-value', critical_1pct: 'Critical 1%', critical_5pct: 'Critical 5%', critical_10pct: 'Critical 10%', n_obs: 'Observations' },
    },
    params: [
      { name: 'symbol',     label: 'Symbol', kind: 'text',   default: 'AAPL', upper: true },
      { name: 'target',     label: 'Target', kind: 'select', default: 'close', options: TARGET_OPTIONS },
      { name: 'regression', label: 'Regression', kind: 'select', default: 'c', pin: true,
        options: [
          { value: 'c',   label: 'c (constant)' },
          { value: 'ct',  label: 'ct (const + trend)' },
          { value: 'ctt', label: 'ctt (quadratic trend)' },
          { value: 'n',   label: 'n (none)' },
        ],
        hint: 'ADF regression form' },
      { name: 'start_date', label: 'Start',  kind: 'date',   default: () => yearsAgo(2) },
      { name: 'end_date',   label: 'End',    kind: 'date',   default: today },
    ],
  },

  // ── Market Ranking ──────────────────────────────────────────────────────────
  'market-ranking': {
    title:     'Market Ranking',
    component: MarketRankingWidget,
  },

  // ── TradingView 임베드 (서버/Yahoo/Fetcher 불필요) ───────────────────────────
  'tv-index-charts': {
    title:     'Index Charts (TV)',
    component: TradingViewIndexChartsWidget,
  },
  'tv-market-ranking': {
    title:     'Market Ranking (TV)',
    component: TradingViewRankingWidget,
  },
  'tv-mini-chart': {
    title:     'Mini Chart (TV)',
    component: TradingViewMiniChartWidget,   // 종목 선택형 단일 심볼 미니 차트
    propsFrom: ['symbol'],
  },

  // ── Watchlist / Screener / Alerts / News (custom CRUD widgets) ─────────────
  'watchlist': {
    title:     'Watchlist',
    component: WatchlistWidget,
  },
  'screener': {
    title:     'Screener',
    component: ScreenerWidget,
  },
  'alerts': {
    title:     'Alerts',
    component: AlertsWidget,
  },
  'news-feed': {
    title:     'News Feed',
    component: NewsFeedWidget,
    propsFrom: ['symbol'],
  },

  // ── Visualization widgets ──────────────────────────────────────────────────
  'advanced-chart': {
    title:     'Advanced Chart',
    component: ChartWidget,        // 멀티심볼·캔들·보조지표·페어분석 (symbol prop으로 시드)
    propsFrom: ['symbol'],
  },
  'backtest-lab': {
    title:     'Backtest Lab',
    component: BacktestLabWidget,  // 시리즈 카탈로그 + 차트 스튜디오 (헤더 symbol을 seed로)
    propsFrom: ['symbol'],
  },
  // Backtest Lab — 사용자 변수·이벤트·전략(서버 저장) + 브라우저 계산 엔진(components/backtest/engine)
  'bt-variables':         { title: 'Variables',         component: BtVariablesWidget },
  'bt-variable-explorer': { title: 'Variable Explorer', component: BtVariableExplorerWidget },
  'bt-events':            { title: 'Events',            component: BtEventsWidget },
  'bt-event-study':       { title: 'Event Study',       component: BtEventStudyWidget },
  'bt-strategy':          { title: 'Strategy',          component: BtStrategyWidget },
  'bt-results':           { title: 'Backtest Results',  component: BtResultsWidget },
  'sparkline': {
    title:     'Mini Charts',
    component: SparklineWidget,
  },
  'comparison': {
    title:     'Stock Comparison',
    component: ComparisonWidget,
  },
  'heatmap': {
    title:     'Sector Heatmap',
    component: HeatmapWidget,
  },
  'correlation': {
    title:     'Correlation Matrix',
    component: CorrelationWidget,
  },

  // ── Interactive widgets ───────────────────────────────────────────────────
  'economic-calendar': {
    title:     'Economic Calendar',
    component: EconomicCalendarWidget,
  },
  'earnings-calendar': {
    title:     'Earnings Calendar',
    component: EarningsCalendarWidget,
  },
  'notes': {
    title:     'Notes',
    component: NoteWidget,
  },

  // ── Portfolio (custom + data-driven) ───────────────────────────────────────
  'portfolio-stats': {
    title:     'Portfolio Stats',
    component: PortfolioStatsWidget,
    propsFrom: ['portfolioId'],
  },
  'portfolio-chart':         { title: 'Portfolio Chart',    endpoint: '/user-portfolio/portfolios/{portfolioId}/chart' },
  'portfolio-holdings':      { title: 'Holdings',           endpoint: '/user-portfolio/portfolios/{portfolioId}/holdings' },
  'portfolio-balances':      { title: 'Balances',           endpoint: '/user-portfolio/portfolios/{portfolioId}/holdings' },
  'portfolio-positions':     { title: 'Positions',          endpoint: '/user-portfolio/portfolios/{portfolioId}/holdings' },
  'portfolio-trade-history': { title: 'Trade History',      endpoint: '/user-portfolio/portfolios/{portfolioId}/transactions' },
};
