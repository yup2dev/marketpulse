/**
 * 차트 지표 계산 — 종가 배열에서. 값이 아직 없는 앞부분은 null.
 * 화면에 보이는 구간보다 봉을 넉넉히 받아 계산하므로 보이는 구간의 값은 처음부터 채워진다.
 */

/** 단순 이동평균 */
export function sma(values, n) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

/** 지수 이동평균 (첫 값에서 시작) */
export function ema(values, n) {
  const k = 2 / (n + 1);
  const out = [];
  values.forEach((v, i) => out.push(i === 0 ? v : v * k + out[i - 1] * (1 - k)));
  return out;
}

/** 볼린저 밴드 — { mid, upper, lower } (n 봉, width σ) */
export function bollinger(values, n = 20, width = 2) {
  const mid = sma(values, n);
  const upper = new Array(values.length).fill(null);
  const lower = new Array(values.length).fill(null);
  for (let i = n - 1; i < values.length; i += 1) {
    let sq = 0;
    for (let j = i - n + 1; j <= i; j += 1) sq += (values[j] - mid[i]) ** 2;
    const sd = Math.sqrt(sq / n);
    upper[i] = mid[i] + width * sd;
    lower[i] = mid[i] - width * sd;
  }
  return { mid, upper, lower };
}

/** RSI (Wilder 평활) */
export function rsi(values, n = 14) {
  const out = new Array(values.length).fill(null);
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < values.length; i += 1) {
    const d = values[i] - values[i - 1];
    const g = Math.max(d, 0);
    const l = Math.max(-d, 0);
    if (i <= n) {
      gain += g / n;
      loss += l / n;
    } else {
      gain = (gain * (n - 1) + g) / n;
      loss = (loss * (n - 1) + l) / n;
    }
    if (i >= n) out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

/** MACD — { macd, signal, hist } */
export function macd(values, fast = 12, slow = 26, signalN = 9) {
  const f = ema(values, fast);
  const s = ema(values, slow);
  const line = f.map((v, i) => v - s[i]);
  const signal = ema(line, signalN);
  return { macd: line, signal, hist: line.map((v, i) => v - signal[i]) };
}

/** 두 배열의 상관계수 (둘 다 값이 있는 자리만). 계산할 수 없으면 null */
export function correlation(a, b) {
  const pairs = a.map((v, i) => [v, b[i]]).filter(([x, y]) => x != null && y != null);
  const n = pairs.length;
  if (n < 3) return null;
  const ma = pairs.reduce((s, p) => s + p[0], 0) / n;
  const mb = pairs.reduce((s, p) => s + p[1], 0) / n;
  let ab = 0;
  let aa = 0;
  let bb = 0;
  for (const [x, y] of pairs) {
    ab += (x - ma) * (y - mb);
    aa += (x - ma) ** 2;
    bb += (y - mb) ** 2;
  }
  return aa < 1e-12 || bb < 1e-12 ? null : ab / Math.sqrt(aa * bb);
}

/**
 * 날짜가 있는 값들(오래된 것부터)을 봉 날짜에 맞춘다 — 그 봉 날짜 이전의 마지막 값 (발표일 사이는 직전 값 유지).
 * points: [{ date, value }], dates: 봉 날짜 문자열 배열
 */
export function alignToBars(points, dates) {
  const sorted = points.filter((p) => p.value != null).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const out = [];
  let k = 0;
  let last = null;
  for (const d of dates) {
    const day = String(d).slice(0, 10);
    while (k < sorted.length && String(sorted[k].date).slice(0, 10) <= day) {
      last = Number(sorted[k].value);
      k += 1;
    }
    out.push(last);
  }
  return out;
}

/** 그 날짜가 속한 봉의 자리 — 날짜가 그 봉 이후 · 다음 봉 이전. 구간 밖이면 -1 */
export function barIndexOf(date, dates) {
  const day = String(date).slice(0, 10);
  if (!dates.length || day < String(dates[0]).slice(0, 10)) return -1;
  let found = -1;
  for (let i = 0; i < dates.length; i += 1) {
    if (String(dates[i]).slice(0, 10) <= day) found = i;
    else break;
  }
  // 마지막 봉보다 한참 뒤(앞으로 올 일정)는 구간 밖이다
  if (found === dates.length - 1 && (new Date(day) - new Date(String(dates[found]).slice(0, 10))) > 7 * 86400e3) return -1;
  return found;
}
