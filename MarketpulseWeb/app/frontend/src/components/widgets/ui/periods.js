/**
 * 기간의 단일 기준. 위젯마다 기간 목록을 따로 두지 말고 여기서 골라 쓴다.
 *
 * id 는 백엔드가 받는 값(yfinance/FRED 표기)이고, label 은 화면 표기다.
 * 화면 표기는 전부 `1D 1W 1M 3M 6M 1Y 2Y 3Y 5Y 10Y` — 영문 대문자 약어로 통일한다.
 */
export const PERIODS = [
  { id: '1d',  label: '1D'  },
  { id: '1w',  label: '1W'  },
  { id: '1mo', label: '1M'  },
  { id: '3mo', label: '3M'  },
  { id: '6mo', label: '6M'  },
  { id: '1y',  label: '1Y'  },
  { id: '2y',  label: '2Y'  },
  { id: '3y',  label: '3Y'  },
  { id: '5y',  label: '5Y'  },
  { id: '10y', label: '10Y' },
  { id: 'max', label: 'Max' },
];

// 같은 기간을 다르게 적는 id 들 (위젯·API 마다 표기가 달랐다)
const ALIASES = {
  '1D': '1d', '5d': '1w', '1W': '1w', '7d': '1w',
  '1m': '1mo', '1M': '1mo', '3m': '3mo', '3M': '3mo', '6m': '6mo', '6M': '6mo',
  '1Y': '1y', '12mo': '1y', '2Y': '2y', '3Y': '3y', '5Y': '5y', '10Y': '10y',
  all: 'max', ALL: 'max',
};

const BY_ID = Object.fromEntries(PERIODS.map((p) => [p.id, p]));

/** 표기가 다른 id 를 기준 id 로 맞춘다. 모르는 값은 그대로 돌려준다. */
export function canonicalPeriod(id) {
  if (id == null) return id;
  return BY_ID[id] ? id : (ALIASES[id] ?? id);
}

/** 화면 표기. 모르는 값이면 대문자로만 바꿔 보여 준다. */
export function periodLabel(id) {
  if (id == null || id === '') return '';
  return BY_ID[canonicalPeriod(id)]?.label ?? String(id).toUpperCase();
}

/**
 * 기간 id → 시작일 'YYYY-MM-DD' (로컬 날짜). 'max' 나 모르는 값은 null(제한 없음).
 * 서버 deps.period_start 와 같은 일수 환산 — 끝은 오늘(최근 항목이 빠지지 않게).
 */
export function periodStartDate(id) {
  const m = /^(\d+)(d|w|mo|y)$/.exec(canonicalPeriod(id) || '');
  if (!m) return null;
  const days = Number(m[1]) * { d: 1, w: 7, mo: 30, y: 365 }[m[2]];
  const d = new Date();
  d.setDate(d.getDate() - days);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** 프리셋 이름 → 기간 id 목록. 위젯은 이 이름이나 id 배열을 넘긴다. */
export const PERIOD_PRESETS = {
  intraday: ['1d', '1w', '1mo', '3mo', '6mo', '1y'],
  short:    ['1mo', '3mo', '6mo', '1y'],
  medium:   ['6mo', '1y', '2y', '3y'],
  long:     ['1y', '3y', '5y', '10y'],
  macro:    ['1y', '2y', '3y', '5y'],
  concept:  ['1y', '3y', '5y', '10y'],
  backtest: ['3mo', '6mo', '1y', '2y', '5y', '10y'],
  // 이벤트 목록(배당·분할·공시·내부자 거래) — 최근 몇 달부터 전체 이력까지
  events:   ['6mo', '1y', '3y', '5y', '10y', 'max'],
};

/**
 * 프리셋 이름 또는 id 배열을 [{ id, label }] 로 바꾼다.
 * 배열 원소는 id 문자열이거나 { id, label } (백엔드 고유 id 를 그대로 쓰는 경우).
 */
export function periodOptions(preset = 'macro') {
  const ids = Array.isArray(preset) ? preset : (PERIOD_PRESETS[preset] ?? PERIOD_PRESETS.macro);
  return ids.map((p) => (typeof p === 'object' ? { id: p.id, label: p.label ?? periodLabel(p.id) } : { id: p, label: periodLabel(p) }));
}
