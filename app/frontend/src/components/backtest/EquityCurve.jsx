import React from 'react';
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { DESIGN_TOKENS } from '../../styles/designTokens';

/**
 * EquityCurve - Portfolio equity curve chart with benchmark comparison
 * Uses BacktestingLab's Area chart style with gradients
 */
const EquityCurve = ({ data = [], showBenchmark = true, className = '' }) => {
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="bg-[#0d0d12] border border-gray-700 rounded-lg p-3 shadow-xl">
        <p className="text-sm text-gray-400 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <span className="text-xs font-medium" style={{ color: entry.color }}>
              {entry.name}:
            </span>
            <span className="text-sm font-bold text-white">
              ${entry.value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center h-[400px] bg-[#161b22] border border-gray-800 rounded-xl ${className}`}>
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            {/* Portfolio gradient */}
            <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={DESIGN_TOKENS.chart.portfolio} stopOpacity={0.3} />
              <stop offset="95%" stopColor={DESIGN_TOKENS.chart.portfolio} stopOpacity={0} />
            </linearGradient>

            {/* Benchmark gradient */}
            <linearGradient id="colorBenchmark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={DESIGN_TOKENS.chart.benchmark} stopOpacity={0.2} />
              <stop offset="95%" stopColor={DESIGN_TOKENS.chart.benchmark} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#333" />

          <XAxis
            dataKey="date"
            stroke="#666"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getFullYear().toString().slice(2)}`;
            }}
          />

          <YAxis
            stroke="#666"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />

          {/* Portfolio area */}
          <Area
            type="monotone"
            dataKey="portfolio"
            stroke={DESIGN_TOKENS.chart.portfolio}
            strokeWidth={2}
            fill="url(#colorPortfolio)"
            name="Portfolio"
          />

          {/* Benchmark area */}
          {showBenchmark && (
            <Area
              type="monotone"
              dataKey="benchmark"
              stroke={DESIGN_TOKENS.chart.benchmark}
              strokeWidth={2}
              strokeDasharray="5 5"
              fill="url(#colorBenchmark)"
              name="Benchmark"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default EquityCurve;
