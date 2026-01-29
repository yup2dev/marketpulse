/**
 * Analysis 개요 탭 - Static Grid Layout
 */
import { useStockContext } from './AnalysisDashboard';
import TickerInfoWidget from '../widgets/TickerInfoWidget';
import KeyMetricsWidget from '../widgets/KeyMetricsWidget';
import EarningsWidget from '../widgets/EarningsWidget';
import ChartWidget from '../widgets/ChartWidget';

export default function AnalysisOverviewTab() {
  const { symbol } = useStockContext();

  return (
    <div className="h-full">
      <div className="grid grid-cols-12 gap-1 h-[calc(100vh-180px)]">
        {/* Top Row - Info, Metrics, Earnings */}
        <div className="col-span-4 min-h-[280px]">
          <TickerInfoWidget symbol={symbol} />
        </div>
        <div className="col-span-4 min-h-[280px]">
          <KeyMetricsWidget symbol={symbol} />
        </div>
        <div className="col-span-4 min-h-[280px]">
          <EarningsWidget symbol={symbol} />
        </div>

        {/* Bottom Row - Chart */}
        <div className="col-span-12 min-h-[320px]">
          <ChartWidget widgetId="analysis-overview-chart" initialSymbols={[symbol]} />
        </div>
      </div>
    </div>
  );
}
