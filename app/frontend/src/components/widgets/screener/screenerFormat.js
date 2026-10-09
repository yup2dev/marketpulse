/**
 * 스크리너 표시용 순수 포맷터 — 통화·시총·심볼 색상.
 * React 에 의존하지 않아 단독으로 테스트할 수 있다.
 */

const LOGO_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#14b8a6','#f97316','#6366f1'];

export function logoColor(sym) {
  const n = (sym || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return LOGO_COLORS[n % LOGO_COLORS.length];
}

export function fmtPrice(p, curr) {
  if (p == null) return '—';
  if (curr === 'KRW') return `${Math.round(p).toLocaleString()}원`;
  return `$${Number(p).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtMcap(v, curr) {
  if (!v) return '—';
  if (curr === 'KRW') {
    if (v >= 1e12) return `${(v / 1e12).toFixed(1)}조원`;
    if (v >= 1e8)  return `${(v / 1e8).toFixed(0)}억원`;
    return `${v.toLocaleString()}원`;
  }
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
  return `$${(v / 1e6).toFixed(0)}M`;
}


export function numFmt(n) {
  if (n == null) return '';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
