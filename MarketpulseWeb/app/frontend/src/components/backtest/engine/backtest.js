/**
 * backtest — 단일 자산 규칙 기반 백테스트 (롱 또는 숏, 전량 진입/청산).
 *
 * 체결 규칙: 신호가 뜬 봉의 종가로 체결하고, 수익은 다음 봉부터 반영한다. 신호 수식은
 * 그 봉 종가까지의 데이터만 쓰므로 미래 데이터를 보지 않는다(look-ahead 없음).
 * 거래 비용은 진입·청산 때마다 costBps(bp) 만큼 자산을 차감한다.
 */
import { compile, evaluate, asSeries, ExprError } from './expr';
import { truthy } from './indicators';

export const MAX_SAVED_POINTS = 1000;

/** 전략이 참조하는 변수·이벤트 이름. */
export function strategyRefs(config) {
  const variables = new Set([config.asset].filter(Boolean));
  const events = new Set();
  for (const src of [config.entry, config.exit]) {
    if (!src || !String(src).trim()) continue;
    const c = compile(src);
    c.variables.forEach((v) => variables.add(v));
    c.events.forEach((e) => events.add(e));
  }
  return { variables: [...variables], events: [...events] };
}

function yearsBetween(first, last, bars) {
  const days = (Date.parse(last) - Date.parse(first)) / 86400000;
  return days > 0 ? days / 365.25 : bars / 252;
}

function seriesStats(equity, dates) {
  const rets = [];
  for (let i = 1; i < equity.length; i += 1) rets.push(equity[i] / equity[i - 1] - 1);
  const last = equity[equity.length - 1];
  const years = yearsBetween(dates[0], dates[dates.length - 1], equity.length);
  const ppy = years > 0 ? rets.length / years : 252;
  const mean = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
  const sd = rets.length > 1 ? Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1)) : 0;
  const downside = rets.filter((r) => r < 0);
  const dsd = downside.length > 1 ? Math.sqrt(downside.reduce((a, b) => a + b ** 2, 0) / downside.length) : 0;
  let peak = -Infinity;
  let maxDd = 0;
  for (const v of equity) {
    peak = Math.max(peak, v);
    maxDd = Math.min(maxDd, v / peak - 1);
  }
  const cagr = years > 0 && last > 0 ? last ** (1 / years) - 1 : null;
  return {
    totalReturn: (last - 1) * 100,
    cagr: cagr === null ? null : cagr * 100,
    volatility: sd * Math.sqrt(ppy) * 100,
    sharpe: sd > 0 ? (mean / sd) * Math.sqrt(ppy) : null,
    sortino: dsd > 0 ? (mean / dsd) * Math.sqrt(ppy) : null,
    maxDrawdown: maxDd * 100,
    calmar: cagr !== null && maxDd < 0 ? (cagr * 100) / Math.abs(maxDd * 100) : null,
  };
}

function downsample(points, max) {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}

/**
 * @param frame   { dates, columns }  — 전략 참조 변수가 모두 들어 있어야 한다
 * @param config  { asset, entry, exit, holdBars, direction:'long'|'short', costBps }
 * @param eventMasks { [name]: number[] }
 */
export function runBacktest(frame, config, eventMasks = {}) {
  const { dates, columns } = frame;
  const n = dates.length;
  const price = columns[config.asset];
  if (!price) throw new ExprError(`자산 변수 '${config.asset}' 을(를) 찾을 수 없습니다`);
  if (n < 2) throw new ExprError('백테스트할 데이터가 부족합니다(2봉 미만)');

  const env = {
    n,
    variable: (name) => columns[name],
    event: (name) => eventMasks[name],
  };
  const signal = (src) => (src && String(src).trim() ? asSeries(evaluate(compile(src).ast, env), n) : new Array(n).fill(0));
  const entry = signal(config.entry);
  const exit = signal(config.exit);
  const holdBars = Math.max(0, Math.floor(Number(config.holdBars) || 0));
  const dir = config.direction === 'short' ? -1 : 1;
  const cost = Math.max(0, Number(config.costBps) || 0) / 10000;

  const position = new Array(n).fill(0);
  const trades = [];
  let pos = 0;
  let open = null;

  for (let i = 0; i < n; i += 1) {
    const px = price[i];
    if (Number.isFinite(px)) {
      if (pos === 0 && truthy(entry[i])) {
        pos = 1;
        open = { entryIndex: i, entryDate: dates[i], entryPrice: px };
      } else if (pos === 1 && (truthy(exit[i]) || (holdBars > 0 && i - open.entryIndex >= holdBars))) {
        pos = 0;
        const gross = dir * (px / open.entryPrice - 1);
        trades.push({
          entryDate: open.entryDate, entryPrice: open.entryPrice, exitDate: dates[i], exitPrice: px,
          bars: i - open.entryIndex, returnPct: ((1 + gross) * (1 - cost) ** 2 - 1) * 100, open: false,
        });
        open = null;
      }
    }
    position[i] = pos;
  }

  // 자산곡선 — position[i-1] 이 i-1 종가~i 종가 구간 보유 여부
  const equity = new Array(n);
  const bench = new Array(n);
  let firstPx = NaN;
  let lastPx = NaN;
  for (let i = 0; i < n; i += 1) {
    const px = price[i];
    if (i === 0) {
      equity[0] = 1 * (position[0] ? 1 - cost : 1);
    } else {
      let r = 0;
      if (position[i - 1] && Number.isFinite(px) && Number.isFinite(lastPx) && lastPx !== 0) r = dir * (px / lastPx - 1);
      equity[i] = equity[i - 1] * (1 + r);
      if (position[i] !== position[i - 1]) equity[i] *= 1 - cost;
    }
    if (Number.isFinite(px)) {
      if (!Number.isFinite(firstPx)) firstPx = px;
      lastPx = px;
    }
    bench[i] = Number.isFinite(firstPx) && Number.isFinite(lastPx) ? lastPx / firstPx : 1;
  }

  if (open) {
    const gross = dir * (lastPx / open.entryPrice - 1);
    trades.push({
      entryDate: open.entryDate, entryPrice: open.entryPrice, exitDate: dates[n - 1], exitPrice: lastPx,
      bars: n - 1 - open.entryIndex, returnPct: ((1 + gross) * (1 - cost) - 1) * 100, open: true,
    });
  }

  let peak = -Infinity;
  const points = dates.map((date, i) => {
    peak = Math.max(peak, equity[i]);
    return { date, strategy: equity[i], benchmark: bench[i], drawdown: (equity[i] / peak - 1) * 100 };
  });

  const wins = trades.filter((t) => t.returnPct > 0);
  const strat = seriesStats(equity, dates);
  const bm = seriesStats(bench, dates);
  const metrics = {
    ...strat,
    trades: trades.length,
    winRate: trades.length ? (wins.length / trades.length) * 100 : null,
    avgTrade: trades.length ? trades.reduce((a, t) => a + t.returnPct, 0) / trades.length : null,
    bestTrade: trades.length ? Math.max(...trades.map((t) => t.returnPct)) : null,
    worstTrade: trades.length ? Math.min(...trades.map((t) => t.returnPct)) : null,
    exposure: (position.filter(Boolean).length / n) * 100,
    bars: n,
    start: dates[0],
    end: dates[n - 1],
    benchmark: { totalReturn: bm.totalReturn, cagr: bm.cagr, maxDrawdown: bm.maxDrawdown, sharpe: bm.sharpe, volatility: bm.volatility },
  };

  return { equity: points, trades, metrics, position };
}

/** 서버 저장용 축약본 — 자산곡선 다운샘플, 거래내역 상한. */
export function compactResult(result) {
  return {
    equity: downsample(result.equity, MAX_SAVED_POINTS),
    trades: result.trades.slice(-MAX_SAVED_POINTS),
    metrics: result.metrics,
  };
}
