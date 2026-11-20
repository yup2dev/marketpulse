/** Plot 은 lib/plotly/Plot 이 단일 구현 — 엔진은 adapter 를 거쳐 가져온다 (뷰들의 import 경로 유지) */
export { Plot as default, readColors, withAlpha, FONT } from './adapter';
