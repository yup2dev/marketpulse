/**
 * Plot — Plotly 를 그리는 단 하나의 부품. plotly.js 를 직접 import 하는 곳은 이 파일뿐이다.
 *
 *   <Plot figure={(colors) => ({ data, layout })} />
 *
 * - figure(colors) 가 { data, layout } 을 만든다. colors 는 index.css 의 --mpc-* 변수 값(hex).
 *   Plotly 는 JS 로 색을 칠하므로, 테마가 바뀌면 다시 읽어 다시 그린다.
 *   figure 는 useCallback 으로 고정해 넘긴다 — 바뀔 때마다 다시 그린다.
 * - Plotly 는 처음 쓸 때 한 번만 불러온다 (동적 import, loadPlotly).
 * - 부모 칸 크기를 따라간다 (숨겨지거나 떼어진 칸에서는 크기를 다시 재지 않는다).
 *
 * props
 *   figure      (colors) => { data, layout }
 *   config      Plotly config 덮어쓰기 (예: 그리기 도구를 쓰는 차트의 { editable … })
 *   onClick     점을 눌렀을 때 (point) => …
 *   onRelayout  축을 옮기거나 도형을 그렸을 때 (layout) => … — 그린 도형은 layout.shapes 에 있다
 *   ariaLabel
 */
import { useEffect, useRef } from 'react';
import useThemeStore from '../../store/themeStore';

const CONFIG = { displayModeBar: false, displaylogo: false, responsive: true, scrollZoom: false, doubleClick: false };

let plotlyPromise = null;
/** plotly.js 모듈 (한 번만 불러온다) */
export function loadPlotly() {
  if (!plotlyPromise) plotlyPromise = import('plotly.js-dist-min').then((m) => m.default || m);
  return plotlyPromise;
}

const VARS = {
  up: '--mpc-up', down: '--mpc-down', flat: '--mpc-flat', grid: '--mpc-grid', axis: '--mpc-axis',
  text: '--mpc-text', muted: '--mpc-muted', neutral: '--mpc-neutral', onTile: '--mpc-on-tile',
  surface: '--mpc-surface', line: '--mpc-line', panel: '--mp-panel',
};

/** 지금 테마의 색 (hex 문자열) */
export function readColors() {
  const css = getComputedStyle(document.documentElement);
  return Object.fromEntries(Object.entries(VARS).map(([k, name]) => [k, css.getPropertyValue(name).trim()]));
}

/** '#RRGGBB' + 알파 → 'rgba(…)' */
export function withAlpha(hex, alpha) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
}

export const FONT = "Inter, 'Noto Sans KR', system-ui, sans-serif";

export default function Plot({ figure, onClick, onRelayout, config, ariaLabel }) {
  const ref = useRef(null);
  const theme = useThemeStore((s) => s.theme);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;
  const relayoutRef = useRef(onRelayout);
  relayoutRef.current = onRelayout;

  useEffect(() => {
    const el = ref.current;
    let cancelled = false;
    loadPlotly().then((Plotly) => {
      if (cancelled || !el) return;
      const { data, layout } = figure(readColors());
      const first = !el._mpPlot;
      Plotly.react(el, data, { autosize: true, ...layout }, config ? { ...CONFIG, ...config } : CONFIG).then(() => {
        if (!first || cancelled) return;
        el._mpPlot = Plotly;
        el.on('plotly_click', (ev) => clickRef.current?.(ev.points?.[0]));
        el.on('plotly_relayout', () => relayoutRef.current?.(el.layout));
        // 탭 전환 등으로 숨겨지거나 떼어진 뒤의 콜백은 무시 (Plotly 가 오류를 던진다)
        el._mpResize = new ResizeObserver(() => {
          if (el.isConnected && el.offsetParent !== null) Plotly.Plots.resize(el);
        });
        el._mpResize.observe(el);
      }).catch((err) => console.warn('[Plot] render error:', err));
    });
    return () => { cancelled = true; };
  }, [figure, theme, config]);

  useEffect(() => () => {
    const el = ref.current;
    if (!el) return;
    el._mpResize?.disconnect();
    el._mpPlot?.purge(el);
  }, []);

  return <div ref={ref} role="img" aria-label={ariaLabel} className="w-full h-full" />;
}
