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
 *       default, options?, step?, hint?, upper?
 *     }]
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
import HeatmapWidget           from '../components/widgets/HeatmapWidget';
import CorrelationWidget       from '../components/widgets/CorrelationWidget';
import NoteWidget              from '../components/widgets/NoteWidget';
import EconomicCalendarWidget  from '../components/widgets/EconomicCalendarWidget';
import EarningsCalendarWidget  from '../components/widgets/EarningsCalendarWidget';
import TerminalWidget          from '../components/widgets/TerminalWidget';
import ResearchReportsWidget   from '../components/widgets/ResearchReportsWidget';

// ── date helpers (used by quant param defaults) ─────────────────────────────
const isoDate = (d) => d.toISOString().slice(0, 10);
const today      = () => isoDate(new Date());
const yearsAgo   = (n) => { const d = new Date(); d.setFullYear(d.getFullYear() - n); return isoDate(d); };
const monthsAhead = (n) => { const d = new Date(); d.setMonth(d.getMonth() + n); return isoDate(d); };

const TARGET_OPTIONS = ['close', 'open', 'high', 'low', 'adj_close', 'return'];

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
  'fund-performance': {
    title:    'Fund Performance (13F 추정)',
    endpoint: '/portfolio/13f/{institution_key}/performance?quarters={quarters}',
    category: 'fund_performance',
    provider: 'sec',
    params: [
      { name: 'institution_key', label: 'Fund', kind: 'select', default: 'situational-awareness',
        options: [
          'situational-awareness', 'berkshire', 'ark', 'pershing', 'tiger',
          'citadel', 'bridgewater', 'appaloosa', 'greenlight', 'thirdpoint',
          'baupost', 'viking', 'millennium', 'soros', 'renaissance',
        ],
        hint: 'situational-awareness = 레오폴드 아셴브레너' },
      { name: 'quarters', label: 'Quarters', kind: 'number', default: 8, step: 1,
        hint: '조회 분기 수(행 수는 1 적음 — 분기쌍 비교)' },
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

  // ── 엔 캐리 언와인드 모니터 ────────────────────────────────────────────────
  // 5개 지표를 빠른 돈 → 느린 돈 순으로 읽는다. 각 위젯의 데이터 한계는 해당
  // standard model 도큐스트링에 적어뒀다 — 특히 vol-regime / carry-funding-stress는
  // 원 지표(내재변동성·크로스커런시 베이시스)의 무료 대체물이라 선행성이 없다.

  // ① 변동성 국면 — 진짜 1M IV/리스크리버설이 아니라 스팟 실현변동성 대체 지표.
  //    term_ratio>1(단기>장기) + skew 음수(엔고 꼬리)가 겹치면 경계 신호.
  'jpy-vol-regime': {
    title:    'JPY 변동성 국면 (실현변동성 대체)',
    endpoint: '/data/quantitative/vol_regime',
    category: 'vol_regime',
    provider: 'quantitative',
    chart: {
      defaultType: 'line',
      // 실현변동성 3종만 그린다. term_ratio/skew/close는 스케일이 달라 같이 그리면
      // 변동성 축이 뭉개진다 — 테이블 뷰에서 함께 확인.
      yKeys: [
        { key: 'rv_short',  name: '실현변동성 단기 (%)' },
        { key: 'rv_long',   name: '실현변동성 장기 (%)' },
        { key: 'parkinson', name: 'Parkinson 고가-저가 (%)' },
      ],
      xKey:  'date',
    },
    params: [
      { name: 'symbol',       label: 'Symbol', kind: 'text',   default: 'JPY=X',
        hint: 'JPY=X = USD/JPY. 임의 티커 가능' },
      { name: 'window_short', label: '단기 윈도우', kind: 'number', default: 21, step: 1, hint: '거래일. 21 ≈ 1개월' },
      { name: 'window_long',  label: '장기 윈도우', kind: 'number', default: 63, step: 1, hint: '거래일. 63 ≈ 3개월' },
      { name: 'start_date',   label: 'Start',  kind: 'date',   default: () => yearsAgo(2) },
      { name: 'end_date',     label: 'End',    kind: 'date',   default: today },
    ],
  },

  // ② 조달 스트레스 — 크로스커런시 베이시스 대체. 스왑라인은 사후 확인 신호다.
  'jpy-funding-stress': {
    title:    'JPY 조달 스트레스 (베이시스 대체)',
    endpoint: '/data/fred/carry_funding_stress',
    category: 'carry_funding_stress',
    provider: 'fred',
    chart: {
      defaultType: 'line',
      // 금리차(%p)와 VIX만. usdjpy(~160)/cb_swap(백만$)은 자릿수가 달라 축을 지배한다.
      yKeys: [
        { key: 'rate_diff', name: '미–일 3M 금리차 (%p)' },
        { key: 'vix',       name: 'VIX' },
      ],
      xKey:  'date',
    },
    params: [
      { name: 'start_date', label: 'Start', kind: 'date', default: () => yearsAgo(2) },
      { name: 'end_date',   label: 'End',   kind: 'date', default: today },
    ],
  },

  // ③ MOF 대외증권투자 주보 — sticky money. 중장기채 순매매가 핵심 시계열이라
  //    이것만 그린다(4주 합계 병기). 음수 = 일본 투자자의 외채 순매도 = 본국 송금.
  'jpy-mof-flows': {
    title:    'MOF 대외증권투자 주보 (중장기채)',
    endpoint: '/data/mof/portfolio_flows',
    category: 'portfolio_flows',
    provider: 'mof',
    chart: {
      defaultType:    'bar',
      yKeys: [
        { key: 'assets_lt_debt_net',    name: '대외 중장기채 순매매 (억엔)' },
        { key: 'assets_lt_debt_net_4w', name: '4주 합계 (억엔)' },
      ],
      xKey:           'period_start',
      referenceLines: [{ y: 0, color: '#475569', label: '0 (순매수/순매도 경계)' }],
    },
    params: [
      { name: 'start_date', label: 'Start', kind: 'date', default: () => yearsAgo(2),
        hint: '원본은 2005년부터. 단위 억엔, + 취득초과 / − 처분초과' },
      { name: 'end_date',   label: 'End',   kind: 'date', default: today },
    ],
  },

  // ④ USDJPY-닛케이 롤링 상관 — 음(엔저=주가↑)에서 양으로 뒤집히면 언와인드 국면.
  'jpy-nikkei-correlation': {
    title:    'USDJPY–닛케이 롤링 상관',
    endpoint: '/data/quantitative/pair_correlation',
    category: 'pair_correlation',
    provider: 'quantitative',
    chart: {
      defaultType:    'area',
      yKeys:          [{ key: 'correlation', name: '롤링 상관계수' }],
      xKey:           'date',
      referenceLines: [{ y: 0, color: '#475569', label: '부호 전환선' }],
    },
    params: [
      { name: 'symbol',        label: 'Symbol',    kind: 'text',   default: 'JPY=X', hint: 'USD/JPY' },
      { name: 'benchmark',     label: 'Benchmark', kind: 'text',   default: '^N225', hint: '닛케이225' },
      { name: 'window',        label: 'Window',    kind: 'number', default: 60, step: 1, hint: '거래일. 60 ≈ 3개월' },
      { name: 'lag_benchmark', label: 'Bench Lag', kind: 'number', default: 0,  step: 1,
        hint: '거래시간 불일치 점검용. 1로 두면 벤치마크를 하루 지연' },
      { name: 'start_date',    label: 'Start',     kind: 'date',   default: () => yearsAgo(2) },
      { name: 'end_date',      label: 'End',       kind: 'date',   default: today },
    ],
  },

  // ⑤ CFTC IMM 순포지션 — 후행 지표이고 대형 헤지펀드는 선물을 안 쓴다. 수준보다
  //    변화 속도(net_change_1w/4w)를 봐야 해서 테이블 컬럼에 함께 노출한다.
  'jpy-imm-positioning': {
    title:    'IMM 순포지션 (CFTC COT)',
    endpoint: '/data/cftc/cot_positioning',
    category: 'cot_positioning',
    provider: 'cftc',
    chart: {
      defaultType:    'line',
      // 계약 수(net_noncomm)와 주간 변화는 스케일이 비슷해 같이 볼 만하다.
      yKeys: [
        { key: 'net_noncomm',   name: '비상업 순포지션 (계약)' },
        { key: 'net_change_4w', name: '4주 변화 (계약)' },
      ],
      xKey:           'report_date',
      referenceLines: [{ y: 0, color: '#475569', label: '순중립' }],
    },
    params: [
      { name: 'contract', label: 'Contract', kind: 'select', default: 'JAPANESE YEN',
        options: ['JAPANESE YEN', 'EURO FX', 'SWISS FRANC', 'BRITISH POUND STERLING',
                  'AUSTRALIAN DOLLAR', 'CANADIAN DOLLAR', 'MEXICAN PESO'],
        hint: 'CFTC 계약명과 정확히 일치해야 한다' },
      { name: 'start_date', label: 'Start', kind: 'date', default: () => yearsAgo(2),
        hint: '4주 변화·z-score는 구간 이전 데이터까지 조회해 계산한다' },
      { name: 'end_date',   label: 'End',   kind: 'date', default: today },
    ],
  },

  // ── QuantLib option pricing (form-driven, common-widget) ──────────────────
  'option-pricing': {
    title:    'Option Pricing',
    endpoint: '/quantlib/pricing/option',
    dataPath: 'result',
    display:  'kv',
    params: [
      { name: 'option_type',     label: 'Type',     kind: 'select', default: 'call',
        options: ['call', 'put'] },
      { name: 'exercise_style',  label: 'Exercise', kind: 'select', default: 'european',
        options: ['european', 'american'] },
      { name: 'engine',          label: 'Engine',   kind: 'select', default: 'analytic',
        options: [
          { value: 'analytic', label: 'Analytic (Black-Scholes)' },
          { value: 'binomial', label: 'Binomial (CRR)' },
          { value: 'mc',       label: 'Monte Carlo' },
        ] },
      { name: 'spot',            label: 'Spot (S)',          kind: 'number', default: 100,    step: 0.01 },
      { name: 'strike',          label: 'Strike (K)',        kind: 'number', default: 100,    step: 0.01 },
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
    params: [
      { name: 'symbol',     label: 'Symbol', kind: 'text',   default: 'AAPL', upper: true },
      { name: 'target',     label: 'Target', kind: 'select', default: 'close', options: TARGET_OPTIONS },
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
      { name: 'target',     label: 'Target', kind: 'select', default: 'return', options: TARGET_OPTIONS },
      { name: 'start_date', label: 'Start',  kind: 'date',   default: () => yearsAgo(2) },
      { name: 'end_date',   label: 'End',    kind: 'date',   default: today },
    ],
  },
  'quant-capm': {
    title:    'Quant — CAPM',
    endpoint: '/quantitative/capm',
    dataPath: 'result',
    display:  'kv',
    params: [
      { name: 'symbol',         label: 'Symbol',    kind: 'text',   default: 'AAPL', upper: true },
      { name: 'benchmark',      label: 'Benchmark', kind: 'text',   default: '^GSPC', upper: true },
      { name: 'risk_free_rate', label: 'Risk-Free', kind: 'number', default: 0.04, step: 0.001, hint: '0.04 = 4%' },
      { name: 'target',         label: 'Target',    kind: 'select', default: 'return', options: TARGET_OPTIONS },
      { name: 'start_date',     label: 'Start',     kind: 'date',   default: () => yearsAgo(2) },
      { name: 'end_date',       label: 'End',       kind: 'date',   default: today },
    ],
  },
  'quant-rolling': {
    title:    'Quant — Rolling',
    endpoint: '/quantitative/rolling',
    dataPath: 'result.points',
    chart: {
      defaultType:    'area',
      referenceLines: [{ y: 0, color: '#475569', label: 'zero' }],
    },
    params: [
      { name: 'symbol',         label: 'Symbol', kind: 'text',   default: 'AAPL', upper: true },
      { name: 'metric',         label: 'Metric', kind: 'select', default: 'sharpe',
        options: ['sharpe', 'sortino', 'stdev', 'mean', 'skew', 'kurtosis', 'quantile'] },
      { name: 'window',         label: 'Window', kind: 'number', default: 21, step: 1 },
      { name: 'target',         label: 'Target', kind: 'select', default: 'return', options: TARGET_OPTIONS },
      { name: 'risk_free_rate', label: 'Risk-Free', kind: 'number', default: 0.04, step: 0.001 },
      { name: 'quantile_pct',   label: 'Quantile (0-1)', kind: 'number', default: 0.5, step: 0.05, min: 0, max: 1 },
      { name: 'start_date',     label: 'Start',  kind: 'date',   default: () => yearsAgo(2) },
      { name: 'end_date',       label: 'End',    kind: 'date',   default: today },
    ],
  },
  'quant-adf': {
    title:    'Quant — ADF (Stationarity)',
    endpoint: '/quantitative/unitroot',
    dataPath: 'result',
    display:  'kv',
    params: [
      { name: 'symbol',     label: 'Symbol', kind: 'text',   default: 'AAPL', upper: true },
      { name: 'target',     label: 'Target', kind: 'select', default: 'close', options: TARGET_OPTIONS },
      { name: 'regression', label: 'Regression', kind: 'select', default: 'c',
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
  'terminal': {
    title:     'Terminal',
    component: TerminalWidget,
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
