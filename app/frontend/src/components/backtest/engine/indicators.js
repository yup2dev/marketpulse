/**
 * indicators — 수식 엔진이 쓰는 시계열 함수 (순수 함수, 브라우저·node 공용).
 *
 * 값은 길이 n 의 number[] (결측은 NaN). 창(window) 계산은 창 안 값이 모두 유한할 때만 결과를 낸다.
 * 불리언은 1/0, 판단 불가(워밍업 구간 등)는 NaN — 신호 판정은 truthy() 로 NaN 을 false 로 본다.
 */

export const truthy = (v) => Number.isFinite(v) && v !== 0;

const nanArray = (n) => new Array(n).fill(NaN);

function rolling(x, w, reducer) {
  const n = x.length;
  const out = nanArray(n);
  for (let i = w - 1; i < n; i += 1) {
    let ok = true;
    for (let j = i - w + 1; j <= i; j += 1) {
      if (!Number.isFinite(x[j])) { ok = false; break; }
    }
    if (ok) out[i] = reducer(x, i - w + 1, i);
  }
  return out;
}

export function sma(x, w) {
  return rolling(x, w, (a, s, e) => {
    let sum = 0;
    for (let j = s; j <= e; j += 1) sum += a[j];
    return sum / w;
  });
}

export function std(x, w) {
  if (w < 2) return nanArray(x.length);
  return rolling(x, w, (a, s, e) => {
    let sum = 0;
    for (let j = s; j <= e; j += 1) sum += a[j];
    const mean = sum / w;
    let sq = 0;
    for (let j = s; j <= e; j += 1) sq += (a[j] - mean) ** 2;
    return Math.sqrt(sq / (w - 1));
  });
}

export function zscore(x, w) {
  const m = sma(x, w);
  const s = std(x, w);
  return x.map((v, i) => (s[i] > 0 ? (v - m[i]) / s[i] : NaN));
}

export function highest(x, w) {
  return rolling(x, w, (a, s, e) => {
    let m = -Infinity;
    for (let j = s; j <= e; j += 1) m = Math.max(m, a[j]);
    return m;
  });
}

export function lowest(x, w) {
  return rolling(x, w, (a, s, e) => {
    let m = Infinity;
    for (let j = s; j <= e; j += 1) m = Math.min(m, a[j]);
    return m;
  });
}

export function ema(x, w) {
  const n = x.length;
  const out = nanArray(n);
  const alpha = 2 / (w + 1);
  let value = NaN;
  let seed = [];
  for (let i = 0; i < n; i += 1) {
    const v = x[i];
    if (!Number.isFinite(v)) continue;
    if (!Number.isFinite(value)) {
      seed.push(v);
      if (seed.length === w) {
        value = seed.reduce((a, b) => a + b, 0) / w;
        out[i] = value;
        seed = [];
      }
      continue;
    }
    value = alpha * v + (1 - alpha) * value;
    out[i] = value;
  }
  return out;
}

/** Wilder RSI — 첫 w개 변화의 단순평균으로 시작해 지수 평활. */
export function rsi(x, w = 14) {
  const n = x.length;
  const out = nanArray(n);
  let avgGain = 0;
  let avgLoss = 0;
  let count = 0;
  for (let i = 1; i < n; i += 1) {
    if (!Number.isFinite(x[i]) || !Number.isFinite(x[i - 1])) continue;
    const d = x[i] - x[i - 1];
    const gain = Math.max(d, 0);
    const loss = Math.max(-d, 0);
    if (count < w) {
      avgGain += gain;
      avgLoss += loss;
      count += 1;
      if (count < w) continue;
      avgGain /= w;
      avgLoss /= w;
    } else {
      avgGain = (avgGain * (w - 1) + gain) / w;
      avgLoss = (avgLoss * (w - 1) + loss) / w;
    }
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

const shifted = (x, w) => x.map((_, i) => (i - w >= 0 && i - w < x.length ? x[i - w] : NaN));

export const lag = (x, w = 1) => shifted(x, w);
export const diff = (x, w = 1) => { const p = shifted(x, w); return x.map((v, i) => v - p[i]); };
export const pct = (x, w = 1) => {
  const p = shifted(x, w);
  return x.map((v, i) => (p[i] !== 0 && Number.isFinite(p[i]) ? (v / p[i] - 1) * 100 : NaN));
};

/** 누적 최고점 대비 하락률(%) — 0 이하. */
export function drawdown(x) {
  let peak = -Infinity;
  return x.map((v) => {
    if (!Number.isFinite(v)) return NaN;
    peak = Math.max(peak, v);
    return peak > 0 ? (v / peak - 1) * 100 : NaN;
  });
}

export function crossAbove(a, b) {
  return a.map((v, i) => {
    if (i === 0) return 0;
    const ok = [v, b[i], a[i - 1], b[i - 1]].every(Number.isFinite);
    return ok && v > b[i] && a[i - 1] <= b[i - 1] ? 1 : 0;
  });
}

export function crossBelow(a, b) {
  return a.map((v, i) => {
    if (i === 0) return 0;
    const ok = [v, b[i], a[i - 1], b[i - 1]].every(Number.isFinite);
    return ok && v < b[i] && a[i - 1] >= b[i - 1] ? 1 : 0;
  });
}
