/**
 * 도메인별 백엔드 API — 화면은 URL 을 직접 조립하지 말고 여기 함수를 쓴다.
 * 새 엔드포인트도 이 파일에 도메인 묶음으로 추가한다.
 */
import { API_BASE } from './base';
import { apiClient } from './client';

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const authAPI = {
  login:       (data)  => apiClient.post(`${API_BASE}/auth/login`, data),
  register:    (data)  => apiClient.post(`${API_BASE}/auth/register`, data),
  logout:      ()      => apiClient.post(`${API_BASE}/auth/logout`),
  verifyToken: ()      => apiClient.get(`${API_BASE}/auth/verify-token`),  // was /auth/verify (bug)
  refreshTokens: (refreshToken) =>
    apiClient.post(`${API_BASE}/auth/refresh`, { refresh_token: refreshToken }),
};

// ─── Portfolio API ────────────────────────────────────────────────────────────
const UP = `${API_BASE}/user-portfolio`;
export const portfolioAPI = {
  getAll:          ()            => apiClient.get(`${UP}/portfolios`),
  getById:         (id)          => apiClient.get(`${UP}/portfolios/${id}`),
  create:          (data)        => apiClient.post(`${UP}/portfolios`, data),
  update:          (id, data)    => apiClient.put(`${UP}/portfolios/${id}`, data),
  delete:          (id)          => apiClient.del(`${UP}/portfolios/${id}`),
  getHoldings:     (id)          => apiClient.get(`${UP}/portfolios/${id}/holdings`),
  getTransactions: (id)          => apiClient.get(`${UP}/portfolios/${id}/transactions`),
  addTransaction:  (id, data)    => apiClient.post(`${UP}/portfolios/${id}/transactions`, data),
  updateTransaction: (pId, tId, data) =>
    apiClient.put(`${UP}/portfolios/${pId}/transactions/${tId}`, data),
  deleteTransaction: (pId, tId)  =>
    apiClient.del(`${UP}/portfolios/${pId}/transactions/${tId}`),
  getSummary:      (id)          => apiClient.get(`${UP}/portfolios/${id}/summary`),
  getPerformance:  (id, p = '1M')=> apiClient.get(`${UP}/portfolios/${id}/performance?period=${p}`),
  getAllocation:   (id)          => apiClient.get(`${UP}/portfolios/${id}/allocation`),
  refreshPrices:   (id)          => apiClient.post(`${UP}/portfolios/${id}/refresh-prices`),
  getPriceAtDate:  (ticker, date)=>
    apiClient.get(`${UP}/price-at-date?ticker=${encodeURIComponent(ticker)}&date=${date}`),
  // 일일 배치 환율 (db provider fx_rate) — 응답 OBBject: results[0] = {date, base_currency, counter_currency, rate, ...}
  getFxRate:       (base = 'USD', quote = 'KRW') =>
    apiClient.get(`${API_BASE}/data/db/fx_rate?base=${base}&quote=${quote}`),
};

// ─── API Keys API ─────────────────────────────────────────────────────────────
// 키는 백엔드에 저장되지 않고 '내 Fetcher 워커(WS)'로 위임되어 내 PC keystore에 적용된다.
export const keysAPI = {
  list:   ()              => apiClient.get(`${API_BASE}/keys`),
  set:    (data)          => apiClient.post(`${API_BASE}/keys`, data),
  delete: (provider)      => apiClient.del(`${API_BASE}/keys/${provider}`),
  // body 생략 → 저장된 키로 검증. 결과 { ok: true|false|null(미지원), message }
  test:   (provider, body) => apiClient.post(`${API_BASE}/keys/${provider}/test`, body || {}),
};

// ─── Concepts API (provider 무관 지표) ────────────────────────────────────────
export const conceptsAPI = {
  list: () => apiClient.get(`${API_BASE}/concepts`),
};

// ─── Providers API ────────────────────────────────────────────────────────────
// 등록된 fetcher provider 목록 + 카테고리(=model) 지원 현황 + 키 설정 상태.
// UniversalWidget의 provider 셀렉터가 "이 위젯의 model을 지원하는 provider"만
// 추리는 데 사용한다. 응답은 세션 동안 한 번만 받아 캐시한다.
let _providersPromise = null;
export const providersAPI = {
  list: () => {
    if (!_providersPromise) {
      _providersPromise = apiClient.get(`${API_BASE}/providers`).catch((e) => {
        _providersPromise = null;  // 실패 시 다음 호출에서 재시도 허용
        throw e;
      });
    }
    return _providersPromise;
  },
  // configured 는 '내 키' 기준이라 키를 저장·삭제하면 캐시를 버려야 위젯 기본 provider 가 갱신된다
  invalidate: () => { _providersPromise = null; },
};

// ─── Export API ───────────────────────────────────────────────────────────────
// 사용자 정의 위젯 (API → 매핑 → 위젯 → 화면 등록). 정의 목록은 store/userWidgetStore 가 들고 있다.
export const userWidgetsAPI = {
  codes:  ()         => apiClient.get(`${API_BASE}/user-widgets/codes`),
  builtin: ()        => apiClient.get(`${API_BASE}/user-widgets/builtin`),
  screenGroups: ()   => apiClient.get(`${API_BASE}/user-widgets/screen-groups`),   // OBBject — 화면 단위 파라미터 그룹
  list:   ()         => apiClient.get(`${API_BASE}/user-widgets`),
  create: (data)     => apiClient.post(`${API_BASE}/user-widgets`, data),
  update: (id, data) => apiClient.put(`${API_BASE}/user-widgets/${id}`, data),
  delete: (id)       => apiClient.del(`${API_BASE}/user-widgets/${id}`),
  // 기본 제공 위젯의 내 설정 (사용 여부·내놓을 화면) — 기본값과 다른 것만 온다
  prefs:   ()           => apiClient.get(`${API_BASE}/user-widgets/prefs`),
  setPref: (type, data) => apiClient.put(`${API_BASE}/user-widgets/prefs/${encodeURIComponent(type)}`, data),
};

// 위젯 종류 목록 관리 (관리자 전용). 목록 읽기는 userWidgetsAPI.codes() 의 VIEW_TYPE.
export const widgetTypesAPI = {
  create: (data)       => apiClient.post(`${API_BASE}/admin/widget-types`, data),
  update: (code, data) => apiClient.put(`${API_BASE}/admin/widget-types/${encodeURIComponent(code)}`, data),
  delete: (code)       => apiClient.del(`${API_BASE}/admin/widget-types/${encodeURIComponent(code)}`),
};

// (provider, model) 의 파라미터 폼 스펙 + 응답 필드. 스키마는 코드에 박혀 있어 세션 동안 안 바뀐다.
const _schemaPromises = new Map();
export const schemaAPI = {
  get: (provider, model) => {
    const key = `${provider}/${model}`;
    if (!_schemaPromises.has(key)) {
      _schemaPromises.set(key, apiClient.get(`${API_BASE}/data/${provider}/${model}/schema`).catch((e) => {
        _schemaPromises.delete(key);
        throw e;
      }));
    }
    return _schemaPromises.get(key);
  },
};

export const exportAPI = {
  portfolioCSV:   (id) => apiClient.get(`${API_BASE}/export/portfolio/${id}/csv`),
  portfolioExcel: (id) => apiClient.get(`${API_BASE}/export/portfolio/${id}/excel`),
  portfolioPDF:   (id) => apiClient.get(`${API_BASE}/export/portfolio/${id}/pdf`),
};

// ─── Workspace API ────────────────────────────────────────────────────────────
export const workspaceAPI = {
  list:       (screen)       => apiClient.get(`${API_BASE}/workspace?screen=${encodeURIComponent(screen)}`),
  create:     (data)         => apiClient.post(`${API_BASE}/workspace`, data),
  update:     (id, data)     => apiClient.put(`${API_BASE}/workspace/${id}`, data),
  delete:     (id)           => apiClient.del(`${API_BASE}/workspace/${id}`),
  setDefault: (id)           => apiClient.post(`${API_BASE}/workspace/${id}/default`),
};

// ─── Watchlist API ───────────────────────────────────────────────────────────
const WL = `${API_BASE}/watchlist`;
export const watchlistAPI = {
  // 그룹 관리
  getAll:       ()              => apiClient.get(WL),
  create:       (data)          => apiClient.post(WL, data),
  getById:      (id)            => apiClient.get(`${WL}/${id}`),
  update:       (id, data)      => apiClient.put(`${WL}/${id}`, data),
  delete:       (id)            => apiClient.del(`${WL}/${id}`),
  getItems:     (id)            => apiClient.get(`${WL}/${id}/items`),
  addTicker:    (id, data)      => apiClient.post(`${WL}/${id}/items`, data),
  removeTicker: (id, ticker)    => apiClient.del(`${WL}/${id}/items/${encodeURIComponent(ticker)}`),
  reorder:      (id, orders)    => apiClient.put(`${WL}/${id}/items/reorder`, { ticker_orders: orders }),
  // 빠른 추가/제거 (그룹 선택 없이)
  getMyTickers: ()              => apiClient.get(`${WL}/my-tickers`),
  quickAdd:     (ticker_cd)     => apiClient.post(`${WL}/quick-add`, { ticker_cd }),
  quickRemove:  (ticker_cd)     => apiClient.del(`${WL}/quick-remove/${encodeURIComponent(ticker_cd)}`),
};

// ─── Screener API ────────────────────────────────────────────────────────────
// ─── Ranking API ─────────────────────────────────────────────────────────────
export const rankingAPI = {
  get: ({ market = 'all', sortBy = 'gainers', period = '1d', limit = 50 } = {}) =>
    apiClient.get(`${API_BASE}/stock/ranking?market=${market}&sort_by=${sortBy}&period=${period}&limit=${limit}`),
  getLive: ({ market = 'all', sortBy = 'gainers', limit = 50 } = {}) =>
    apiClient.get(`${API_BASE}/stock/ranking/live?market=${market}&sort_by=${sortBy}&limit=${limit}`),
};

const SC = `${API_BASE}/screener`;
export const screenerAPI = {
  screen:       (filters, limit = 100) => apiClient.post(`${SC}/screen`, { filters, limit }),
  getPresets:   ()                     => apiClient.get(`${SC}/presets`),
  runPreset:    (id, limit = 100)      => apiClient.post(`${SC}/presets/${id}/run?limit=${limit}`),
  getSectors:   ()                     => apiClient.get(`${SC}/sectors`),
  save:         (data)                 => apiClient.post(`${SC}/save`, data),
  update:       (id, data)             => apiClient.put(`${SC}/saved/${id}`, data),
  getSaved:     ()                     => apiClient.get(`${SC}/saved`),
  runSaved:     (id, limit = 100)      => apiClient.post(`${SC}/saved/${id}/run?limit=${limit}`),
  deleteSaved:  (id)                   => apiClient.del(`${SC}/saved/${id}`),
};

// ─── Alert API ───────────────────────────────────────────────────────────────
const AL = `${API_BASE}/alerts`;
export const alertAPI = {
  getAll:       (isActive)     => apiClient.get(`${AL}${isActive != null ? `?is_active=${isActive}` : ''}`),
  create:       (data)         => apiClient.post(`${AL}/`, data),
  update:       (id, data)     => apiClient.put(`${AL}/${id}`, data),
  toggle:       (id)           => apiClient.post(`${AL}/${id}/toggle`),
  delete:       (id)           => apiClient.del(`${AL}/${id}`),
  getHistory:   (alertId, limit = 50) => apiClient.get(`${AL}/history${alertId ? `?alert_id=${alertId}&` : '?'}limit=${limit}`),
  test:         (id)           => apiClient.post(`${AL}/${id}/test`),
};

// ─── Notes API ──────────────────────────────────────────────────────────────
const NT = `${API_BASE}/notes`;
export const notesAPI = {
  getAll:   (ticker)       => apiClient.get(`${NT}${ticker ? `?ticker_cd=${encodeURIComponent(ticker)}` : ''}`),
  create:   (data)         => apiClient.post(NT, data),
  update:   (id, data)     => apiClient.put(`${NT}/${id}`, data),
  delete:   (id)           => apiClient.del(`${NT}/${id}`),
};

// ─── Backtest Lab API ─────────────────────────────────────────────────────────
// 사용자별 변수·이벤트·전략 정의와 실행 결과 저장 (계산은 브라우저 엔진에서).
const BT = `${API_BASE}/backtest`;
export const backtestAPI = {
  listItems:  (kind)       => apiClient.get(`${BT}/items${kind ? `?kind=${kind}` : ''}`),
  createItem: (data)       => apiClient.post(`${BT}/items`, data),
  updateItem: (id, data)   => apiClient.put(`${BT}/items/${id}`, data),
  deleteItem: (id)         => apiClient.del(`${BT}/items/${id}`),
  listRuns:   ()           => apiClient.get(`${BT}/runs`),
  getRun:     (id)         => apiClient.get(`${BT}/runs/${id}`),
  saveRun:    (data)       => apiClient.post(`${BT}/runs`, data),
  deleteRun:  (id)         => apiClient.del(`${BT}/runs/${id}`),
};

// ─── News API ────────────────────────────────────────────────────────────────
export const newsAPI = {
  get: (symbol, limit = 20, period) => {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (symbol) qs.set('symbol', symbol);
    if (period && period !== 'max') qs.set('period', period);
    return apiClient.get(`${API_BASE}/news?${qs}`);
  },
};

// ─── Universal Data Gateway ──────────────────────────────────────────────────
// 새 Fetcher 추가 시 이 파일 수정 불필요.
// 사용: dataAPI.fetch('fred', 'yield_curve')
//       dataAPI.fetch('yahoo', 'quote', { symbol: 'AAPL' })
//       dataAPI.fetch('fmp', 'income_statement', { symbol: 'AAPL' })
export const dataAPI = {
  fetch: (provider, model, params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    ).toString();
    const url = `${API_BASE}/data/${provider}/${model}${qs ? `?${qs}` : ''}`;
    return apiClient.get(url);
  },

  // 자주 쓰는 단축키 — provider:model 쌍을 기억하지 않아도 됨
  stock: {
    quote:        (symbol, provider = 'yahoo')         => dataAPI.fetch(provider, 'quote', { symbol }),
    history:      (symbol, params = {}, prov = 'yahoo')=> dataAPI.fetch(prov, 'stock_price', { symbol, ...params }),
    profile:      (symbol)                             => dataAPI.fetch('fmp', 'company_profile', { symbol }),
    income:       (symbol)                             => dataAPI.fetch('fmp', 'income_statement', { symbol }),
    estimates:    (symbol)                             => dataAPI.fetch('fmp', 'analyst_estimates', { symbol }),
    gainers:      ()                                   => dataAPI.fetch('fmp', 'gainers', {}),
    losers:       ()                                   => dataAPI.fetch('fmp', 'losers', {}),
    mostActives:  ()                                   => dataAPI.fetch('fmp', 'most_actives', {}),
  },

  macro: {
    yieldCurve:          ()                  => dataAPI.fetch('fred', 'yield_curve', {}),
    yieldHistory:        (period = '5y')     => dataAPI.fetch('fred', 'yield_curve_history', { period }),
    gdp:                 (period = '5y')     => dataAPI.fetch('fred', 'gdp', { period }),
    cpi:                 (period = '5y')     => dataAPI.fetch('fred', 'cpi', { period }),
    unemployment:        (period = '5y')     => dataAPI.fetch('fred', 'unemployment', { period }),
    interestRate:        (period = '5y')     => dataAPI.fetch('fred', 'interest_rate', { period }),
    laborDashboard:      ()                  => dataAPI.fetch('fred', 'labor_dashboard', {}),
    financialConditions: ()                  => dataAPI.fetch('fred', 'financial_conditions', {}),
    sentimentComposite:  ()                  => dataAPI.fetch('fred', 'sentiment_composite', {}),
    inflationMomentum:   (period = '3y')     => dataAPI.fetch('fred', 'inflation_momentum', { period }),
    pmi:                 (period = '5y')     => dataAPI.fetch('fred', 'pmi', { period }),
    fedBalanceSheet:     (period = '10y')    => dataAPI.fetch('fred', 'fed_balance_sheet', { period }),
    realRates:           (period = '5y')     => dataAPI.fetch('fred', 'real_rates', { period }),
    jobsBreakdown:       (period = '5y')     => dataAPI.fetch('fred', 'jobs_breakdown', { period }),
    initialClaims:       (period = '2y')     => dataAPI.fetch('fred', 'initial_claims', { period }),
    inflationSector:     (period = '5y')     => dataAPI.fetch('fred', 'inflation_sector', { period }),
  },
};
