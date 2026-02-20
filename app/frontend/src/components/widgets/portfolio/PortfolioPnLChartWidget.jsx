import { TrendingUp } from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart
} from 'recharts';
import BaseWidget from '../common/BaseWidget';

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
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={pnlHistory}>
            <defs>
              <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#555', fontSize: 10 }}
              tickFormatter={(date) => date.slice(5)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#555', fontSize: 10 }}
              tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a1a2e',
                border: '1px solid #2a2a3e',
                borderRadius: '6px',
                fontSize: '11px',
              }}
              labelStyle={{ color: '#888' }}
            />
            <Area
              type="monotone"
              dataKey={chartTab === 'value' ? 'value' : 'pnl'}
              stroke="#22c55e"
              fill="url(#colorPortfolio)"
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </BaseWidget>
  );
}
