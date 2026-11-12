/** 뷰들이 같이 쓰는 작은 조각 — 추세선, 종목 로고, 폭 재기 */
import { useLayoutEffect, useState } from 'react';
import { toneOf } from '../format';

/**
 * TrendLine — 표 셀·타일 안의 작은 추세선 (축·툴팁 없음).
 * 행마다 하나씩 수십 개가 뜨는 자리라 Plotly 대신 선 하나만 긋는다.
 * 색: color 를 주면 그 색, 아니면 '마지막 값 − 기준값(baseline, 없으면 첫 값)'의 부호.
 */
export function TrendLine({ values = [], baseline, color, width = 80, height = 20 }) {
  const vals = values.filter((v) => v != null && Number.isFinite(Number(v))).map(Number);
  const style = { display: 'block', flexShrink: 0 };
  if (vals.length < 2) return <svg width={width} height={height} style={style} aria-hidden="true" />;
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || 1;
  const pad = 2;
  const pts = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - lo) / span) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const stroke = color || toneOf(vals[vals.length - 1] - (baseline ?? vals[0]));
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={style} aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const LOGO_COLORS = ['#3A3B43', '#3F7D20', '#1F6FB2', '#2B2F3A', '#2E7D6B', '#6B4FA8', '#A8562B', '#8A3B5E', '#2F5D8A', '#5B6B2E'];

/** 종목 로고 자리 — 이름 첫 글자 + 심볼로 정한 색 */
export function StockLogo({ symbol, name }) {
  const n = String(symbol || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const initial = (String(name || symbol || '?').replace(/[^0-9A-Za-z가-힣]/g, '')[0] || '?').toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0"
      style={{ background: LOGO_COLORS[n % LOGO_COLORS.length], color: '#FFFFFF' }}
    >
      {initial}
    </span>
  );
}

/** 요소 폭 — const [ref, width] = useWidth(). 요소가 나중에 붙어도 잰다 (콜백 ref) */
export function useWidth() {
  const [node, setNode] = useState(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!node) return undefined;
    setWidth(Math.floor(node.getBoundingClientRect().width));
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);
  return [setNode, width];
}
