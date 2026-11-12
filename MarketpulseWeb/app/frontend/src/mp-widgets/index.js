/**
 * mp-widgets — API 와 뷰 종류만 적으면 위젯이 그려지는 라이브러리.
 *
 *   defineWidget({ title, source, api: { endpoint }, view: 'table', options: { columns } })
 *
 * 스펙 모양·뷰 종류는 README.md. 앱에 기대는 것은 adapter.js 한 파일에 모여 있다.
 */
export { default as DataWidget, defineWidget, registerView } from './DataWidget';
export { fill, pick, normalizeBars, lastSession, useApi, useSeries } from './data';
export { fmtPct, fmtCompact, fmtNumber, fmtPrice, toneOf } from './format';
export { default as Plot, readColors, withAlpha } from './Plot';
