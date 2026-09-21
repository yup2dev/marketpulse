/**
 * 스크리너 필터 카탈로그 — 어떤 조건을 제공할지 선언만 한다.
 *
 * ScreenerWidget.jsx 에서 분리했다. 필터를 추가할 때 UI 를 건드릴 필요 없이
 * 여기 한 줄만 더하면 FilterPickerModal 이 타입(range/multiselect)에 맞춰 렌더한다.
 */

export const PERIODS = [
  { id: '1d',  label: '하루 전 보다' },
  { id: '1w',  label: '1주일 전 보다' },
  { id: '1mo', label: '1개월 전 보다' },
];

export const FILTER_CATALOG = [
  {
    id: 'basic', label: '기본',
    items: [
      { key: 'market_cap', label: '시가총액', group: '기본 정보', type: 'range', unit: 'B$', scale: 1e9, sliderRange: [0, 3000] },
      { key: 'price',      label: '주가',     group: '기본 정보', type: 'range', unit: '$',  sliderRange: [0, 2000] },
      { key: 'beta',       label: '베타',     group: '기본 정보', type: 'range', sliderRange: [0, 3] },
      { key: 'sector',     label: '섹터',     group: '기본 정보', type: 'multiselect' },
    ],
  },
  {
    id: 'financial', label: '재무',
    items: [
      { key: 'pe_ratio',       label: 'P/E 비율',    group: '밸류에이션', type: 'range', sliderRange: [0, 100] },
      { key: 'pb_ratio',       label: 'P/B 비율',    group: '밸류에이션', type: 'range', sliderRange: [0, 20] },
      { key: 'roe',            label: 'ROE',          group: '수익성',     type: 'range', unit: '%', sliderRange: [-50, 100] },
      { key: 'roa',            label: 'ROA',          group: '수익성',     type: 'range', unit: '%', sliderRange: [-50, 50] },
      { key: 'profit_margin',  label: '순이익률',     group: '수익성',     type: 'range', unit: '%', sliderRange: [-50, 50] },
      { key: 'debt_to_equity', label: '부채비율 D/E', group: '안전성',     type: 'range', sliderRange: [0, 10] },
      { key: 'current_ratio',  label: '유동비율',     group: '안전성',     type: 'range', sliderRange: [0, 10] },
      { key: 'quick_ratio',    label: '당좌비율',     group: '안전성',     type: 'range', sliderRange: [0, 10] },
    ],
  },
  {
    id: 'price', label: '시세',
    items: [
      {
        key: 'change_pct', label: '주가등락률', group: '가격 조건', type: 'percent_range', sliderRange: [-100, 100],
        quickOptions: [
          { label: '5% 이상 증가',  value: { min: 5 } },
          { label: '10% 이상 증가', value: { min: 10 } },
          { label: '5% 이상 하락',  value: { max: -5 } },
        ],
        periods: PERIODS,
      },
      { key: 'volume', label: '거래량', group: '가격 조건', type: 'range', unit: 'M', scale: 1e6, sliderRange: [0, 50] },
    ],
  },
];

export const ALL_ITEMS = FILTER_CATALOG.flatMap((c) => c.items);

// 커스텀 모드에서 원클릭으로 조건을 추가/제거할 수 있는 빠른 태그
export const QUICK_TAGS = [
  { label: '저PER',  filterKey: 'pe_ratio',     filterValue: { max: 15 } },
  { label: '고ROE',  filterKey: 'roe',           filterValue: { min: 15 } },
  { label: '저PBR',  filterKey: 'pb_ratio',      filterValue: { max: 2 } },
  { label: '고ROA',  filterKey: 'roa',           filterValue: { min: 10 } },
  { label: '고수익', filterKey: 'profit_margin', filterValue: { min: 20 } },
  { label: '기술주', filterKey: 'sector',         filterValue: { values: ['Technology'] } },
  { label: '대형주', filterKey: 'market_cap',    filterValue: { min: 100 } },
];

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────
