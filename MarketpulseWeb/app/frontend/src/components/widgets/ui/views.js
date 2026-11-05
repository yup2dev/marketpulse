/**
 * 위젯 '보기' 종류의 단일 기준 — 표 + 차트형. BaseWidget 의 View 드롭다운과
 * ChartTypeSelector 가 같은 목록을 쓴다.
 */
import { Table, TrendingUp, Activity, BarChart2, Layers, PieChart, Circle, LineChart } from 'lucide-react';

export const CHART_TYPES = [
  { value: 'line',       label: 'Line',         icon: TrendingUp },
  { value: 'area',       label: 'Area',         icon: Activity   },
  { value: 'bar',        label: 'Bar',          icon: BarChart2  },
  { value: 'stackedBar', label: 'Stacked bar',  icon: Layers     },
  { value: 'pie',        label: 'Pie',          icon: PieChart   },
  { value: 'donut',      label: 'Donut',        icon: Circle     },
];

export const TABLE_VIEW  = { value: 'table',  label: 'Table', icon: Table };
// 서버가 완성된 Plotly 그림을 보낸 경우 — 차트형을 바꿀 수 없다
export const PLOTLY_VIEW = { value: 'plotly', label: 'Chart', icon: LineChart };

/**
 * 보기 옵션 목록을 만든다.
 *   table      표 보기 포함 여부
 *   chart      차트형 목록 — true(전부) | id 배열(allowedTypes) | false
 *   plotly     서버 Plotly 차트 보기 포함 여부
 */
export function buildViewOptions({ table = true, chart = true, plotly = false } = {}) {
  const out = [];
  if (plotly) out.push(PLOTLY_VIEW);
  if (chart) {
    const types = Array.isArray(chart) ? CHART_TYPES.filter((t) => chart.includes(t.value)) : CHART_TYPES;
    out.push(...types);
  }
  if (table) out.push(TABLE_VIEW);
  return out;
}
