import { TrendingUp } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import CommonChart from '../../common/CommonChart';

export default function PortfolioPnLChartWidget({ pnlHistory, chartTab, setChartTab, onRemove }) {
  return (
    <BaseWidget
      title="Portfolio Performance"
      icon={TrendingUp}
      iconColor="text-green-400"
      showViewToggle={false}
      showPeriodSelector={false}
      onRemove={onRemove}
      headerExtra={
        <div className="flex items-center bg-gray-800 rounded p-0.5">
          <button
            onClick={() => setChartTab('value')}
            className={`px-2 py-0.5 rounded text-xs transition-colors ${
              chartTab === 'value' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Value
          </button>
          <button
            onClick={() => setChartTab('pnl')}
            className={`px-2 py-0.5 rounded text-xs transition-colors ${
              chartTab === 'pnl' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            PNL
          </button>
        </div>
      }
    >
      <div className="p-3 h-full">
        <CommonChart
          data={pnlHistory || []}
          series={[{ key: chartTab === 'value' ? 'value' : 'pnl', name: chartTab === 'value' ? 'Value' : 'P&L', color: '#22c55e' }]}
          xKey="date"
          type="area"
          fillContainer={true}
          showTypeSelector={false}
          xFormatter={(date) => date ? date.slice(5) : date}
          yFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
        />
      </div>
    </BaseWidget>
  );
}
