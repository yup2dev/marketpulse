/**
 * Universal Widget Configs
 *
 * 백엔드 엔드포인트만 추가하면 위젯이 자동으로 생성되는 config-driven 시스템.
 *
 * 새 위젯 추가 방법:
 *   1. UNIVERSAL_WIDGET_CONFIGS에 항목 추가
 *   2. widgetRegistry.js에 등록 (이미 있으면 생략)
 *   3. 끝! React 파일 불필요.
 *
 * Config 항목 필드:
 *   title          - 위젯 헤더 제목
 *   icon           - Lucide 아이콘 컴포넌트
 *   iconColor      - Tailwind 색상 클래스
 *   endpoint       - API 경로 ({symbol}, {period} 치환 지원)
 *   dataPath       - 응답에서 배열을 꺼내는 키 경로 (string[] | string)
 *                    예: 'data', ['history', 'dividends'], 'result.items'
 *   displayType    - 'table' | 'chart' | 'both'
 *   requiresSymbol - true면 symbol 선택기 표시
 *   periodType     - 'short'|'medium'|'long'|'macro'|null (null이면 기간 선택기 숨김)
 *   defaultPeriod  - 초기 기간 (periodType 있을 때)
 *   syncable       - true면 글로벌 심볼/기간 싱크 아이콘 표시
 *   source         - 데이터 출처 표시 (하단 footer)
 *   columns        - CommonTable 컬럼 정의 배열 (displayType='table'|'both')
 *   chartConfig    - CommonChart 설정 (displayType='chart'|'both')
 *   tableOptions   - CommonTable 추가 설정 (searchable, exportable, pageSize, compact)
 */

import { DollarSign, Scissors, FileText, TrendingUp, Activity, Building, Percent, BarChart3 } from 'lucide-react';

// ── 유틸 렌더 헬퍼 ───────────────────────────────────────────────────────────
const posNeg = (v, fmt = (x) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`) =>
  v == null
    ? <span className="text-gray-500">-</span>
    : <span className={v >= 0 ? 'text-green-500' : 'text-red-500'}>{fmt(v)}</span>;

const gray = (v) =>
  v == null ? <span className="text-gray-500">-</span> : <span className="text-gray-300">{v}</span>;

// ── UNIVERSAL_WIDGET_CONFIGS ─────────────────────────────────────────────────
export const UNIVERSAL_WIDGET_CONFIGS = {

  // ── Dividend ----------------------------------------------------------------
  'dividend': {
    title: 'Dividends',
    icon: DollarSign,
    iconColor: 'text-green-400',
    endpoint: '/stock/dividends/{symbol}',
    dataPath: ['history', 'dividends'],
    displayType: 'table',
    requiresSymbol: true,
    syncable: true,
    source: 'Yahoo Finance',
    tableOptions: { searchable: false, exportable: true, compact: true, pageSize: 20 },
    columns: [
      { key: 'date',   header: 'Date', formatter: 'date' },
      {
        key: 'dividend', header: 'Amount ($)', align: 'right',
        renderFn: (v) => v != null
          ? <span className="text-white">${Number(v).toFixed(4)}</span>
          : <span className="text-gray-500">-</span>,
      },
      {
        key: 'dividend_yield', header: 'Yield (%)', align: 'right',
        renderFn: (v) => v != null
          ? <span className="text-green-500">{(Number(v) * 100).toFixed(2)}%</span>
          : <span className="text-gray-500">-</span>,
      },
      {
        key: 'yoy_growth', header: 'YoY (%)', align: 'right',
        renderFn: (v) => posNeg(v),
      },
    ],
  },

  // ── Stock Splits ------------------------------------------------------------
  'stock-splits': {
    title: 'Splits',
    icon: Scissors,
    iconColor: 'text-purple-400',
    endpoint: '/stock/splits/{symbol}',
    dataPath: ['splits'],
    displayType: 'table',
    requiresSymbol: true,
    source: 'Yahoo Finance',
    tableOptions: { searchable: false, exportable: false, compact: true, pageSize: 20 },
    columns: [
      { key: 'date',        header: 'Date',  formatter: 'date' },
      {
        key: 'description', header: 'Split',
        renderFn: (v) => <span className="text-cyan-400">{v}</span>,
      },
      {
        key: 'ratio', header: 'Ratio', align: 'right',
        renderFn: (v) => <span className="text-white font-medium">{v}:1</span>,
      },
    ],
  },

  // ── Company Filings ---------------------------------------------------------
  'company-filings': {
    title: 'SEC Filings',
    icon: FileText,
    iconColor: 'text-blue-400',
    endpoint: '/stock/filings/{symbol}',
    dataPath: ['filings'],
    displayType: 'table',
    requiresSymbol: true,
    tableOptions: { searchable: true, exportable: false, compact: true, pageSize: 20 },
    columns: [
      { key: 'date',  header: 'Date', formatter: 'date' },
      {
        key: 'type',  header: 'Type',
        renderFn: (v) => <span className="text-cyan-400 font-medium">{v}</span>,
      },
      {
        key: 'title', header: 'Description',
        renderFn: (v) => <span className="text-gray-400 truncate block max-w-[200px] text-[10px]">{v}</span>,
      },
      {
        key: 'url', header: '', align: 'right', sortable: false,
        renderFn: (v) => v
          ? <a href={v} target="_blank" rel="noopener noreferrer"
               className="text-cyan-500 hover:text-cyan-400"
               onClick={(e) => e.stopPropagation()}>View</a>
          : <span className="text-gray-500">-</span>,
      },
    ],
  },

  // ── GDP Forecast (chart 예시) ------------------------------------------------
  'gdp-forecast-chart': {
    title: 'GDP Forecast',
    icon: BarChart3,
    iconColor: 'text-blue-400',
    endpoint: '/macro/overview/gdp-forecast',
    dataPath: ['data', 'forecasts'],
    displayType: 'chart',
    requiresSymbol: false,
    periodType: 'macro',
    defaultPeriod: '2y',
    source: 'Atlanta Fed / BEA',
    chartConfig: {
      type: 'bar',
      xKey: 'date',
      series: [
        { key: 'actual',   name: 'Actual',   color: '#3b82f6' },
        { key: 'estimate', name: 'Estimate', color: '#f59e0b' },
      ],
      yFormatter: (v) => `${v}%`,
      xFormatter: (v) => {
        const d = new Date(v);
        return isNaN(d) ? v : d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      },
    },
  },

  // ── Fed Balance Sheet (chart 예시) ------------------------------------------
  'fed-balance-sheet-mini': {
    title: 'Fed Balance Sheet',
    icon: Building,
    iconColor: 'text-orange-400',
    endpoint: '/macro/fed/balance-sheet',
    dataPath: ['data', 'history'],
    displayType: 'chart',
    requiresSymbol: false,
    periodType: 'macro',
    defaultPeriod: '3y',
    source: 'Federal Reserve',
    chartConfig: {
      type: 'area',
      xKey: 'date',
      series: [{ key: 'total_assets', name: 'Total Assets', color: '#f97316' }],
      yFormatter: (v) => `$${(v / 1e12).toFixed(1)}T`,
    },
  },

  // ── Real Rates (chart+table 예시) -------------------------------------------
  'real-rates-simple': {
    title: 'Real Rates',
    icon: Percent,
    iconColor: 'text-cyan-400',
    endpoint: '/macro/rates/real-rates',
    dataPath: ['data', 'history'],
    displayType: 'both',
    requiresSymbol: false,
    periodType: 'macro',
    defaultPeriod: '2y',
    source: 'FRED',
    chartConfig: {
      type: 'line',
      xKey: 'date',
      series: [
        { key: '5y_real',  name: '5Y Real',  color: '#3b82f6' },
        { key: '10y_real', name: '10Y Real', color: '#8b5cf6' },
      ],
      yFormatter: (v) => `${v}%`,
    },
    tableOptions: { searchable: false, exportable: true, compact: true, pageSize: 20 },
    columns: [
      { key: 'date',     header: 'Date', formatter: 'date' },
      { key: '5y_real',  header: '5Y Real (%)',  align: 'right', renderFn: (v) => gray(v != null ? `${Number(v).toFixed(2)}%` : null) },
      { key: '10y_real', header: '10Y Real (%)', align: 'right', renderFn: (v) => gray(v != null ? `${Number(v).toFixed(2)}%` : null) },
    ],
  },
};

export default UNIVERSAL_WIDGET_CONFIGS;
