/**
 * study — 이벤트 스터디: 이벤트 발생 봉 기준 앞뒤 w봉 동안 대상 변수가 어떻게 움직였는지.
 *
 *   mode 'pct'  : 변화율(%)   — 가격·지수처럼 수준이 의미 있는 변수
 *   mode 'diff' : 차이(단위) — 금리·스프레드·지표처럼 0 근처를 오가는 변수
 * w > 0 은 이벤트 이후, w < 0 은 이벤트 직전 |w|봉 동안의 변화(이벤트까지 오는 흐름).
 */

export function parseWindows(text) {
  const out = String(text || '')
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
    .filter((w) => Number.isInteger(w) && w !== 0 && Math.abs(w) <= 1000);
  return [...new Set(out)].sort((a, b) => a - b);
}

function change(values, from, to, mode) {
  const a = values[from];
  const b = values[to];
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (mode === 'diff') return b - a;
  return a === 0 ? null : (b / a - 1) * 100;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * @param values  대상 변수 배열(프레임 정렬)
 * @param events  occurrences() 결과 [{index, date, label}]
 * @returns {{ rows: object[], summary: object[] }}
 */
export function eventStudy(values, events, windows, mode = 'pct') {
  const n = values.length;
  const rows = events.map((e) => {
    const row = { date: e.date, label: e.label, base: Number.isFinite(values[e.index]) ? values[e.index] : null };
    for (const w of windows) {
      const j = e.index + w;
      row[`w${w}`] = j < 0 || j >= n ? null : (w > 0 ? change(values, e.index, j, mode) : change(values, j, e.index, mode));
    }
    return row;
  });

  const summary = windows.map((w) => {
    const xs = rows.map((r) => r[`w${w}`]).filter((v) => v !== null && Number.isFinite(v));
    if (!xs.length) return { window: w, count: 0, mean: null, median: null, hit: null, min: null, max: null };
    return {
      window: w,
      count: xs.length,
      mean: xs.reduce((a, b) => a + b, 0) / xs.length,
      median: median(xs),
      hit: (xs.filter((v) => v > 0).length / xs.length) * 100,
      min: Math.min(...xs),
      max: Math.max(...xs),
    };
  });

  return { rows, summary };
}
