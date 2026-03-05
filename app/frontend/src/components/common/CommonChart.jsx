/**
 * CommonChart — thin wrapper over PlotlyChart.
 * Maintains the same external interface as the previous recharts version
 * so all existing callers (FinancialTableWidget, RevenueSegmentsWidget,
 * MacroChartWidget, etc.) work without changes.
 *
 * Supported types: 'line' | 'area' | 'bar' | 'stackedBar' | 'pie' | 'donut'
 */
import PlotlyChart from '../core/PlotlyChart';
import ChartTypeSelector from './ChartTypeSelector';

export default function CommonChart({
  data = [],
  series = [],
  xKey = 'x',
  type = 'line',
  onTypeChange,
  height = 280,
  fillContainer = false,
  showTypeSelector = true,
  allowedTypes,
  compact = false,
  xFormatter,
  yFormatter,
  tooltipFormatter,
  referenceLines = [],
}) {
  return (
    <PlotlyChart
      data={data}
      series={series}
      xKey={xKey}
      type={type}
      onTypeChange={onTypeChange}
      height={height}
      fillContainer={fillContainer}
      showTypeSelector={showTypeSelector}
      allowedTypes={allowedTypes}
      compact={compact}
      xFormatter={xFormatter}
      yFormatter={yFormatter}
      tooltipFormatter={tooltipFormatter}
      referenceLines={referenceLines}
    />
  );
}
