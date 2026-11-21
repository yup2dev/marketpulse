/**
 * mp-widgets — API 와 뷰 종류만 정하면 위젯이 그려지는 라이브러리.
 *
 *   <DataWidget spec={{ title, source, api: { endpoint }, view: 'table', options: { columns } }} />
 *
 * 앱의 위젯 정의는 DB 행이다 — widget/registry/builtinWidgets.toSpec 이 행을 스펙으로 바꾼다.
 * 스펙 모양·뷰 종류는 README.md. 앱에 기대는 것은 adapter.js 한 파일에 모여 있다.
 */
export { default as DataWidget, defineWidget, registerView } from './DataWidget';
// 공개 부품 — DataWidget 밖(화면·다른 위젯)에서도 같은 모양으로 그린다
export { default as MpGrid } from './MpGrid';
export { fill, pick, normalizeBars, lastSession, useApi, useSeries } from './data';
export { fmtPct, fmtCompact, fmtNumber, fmtPrice, toneOf } from './format';
export { default as Plot, readColors, withAlpha } from './Plot';
