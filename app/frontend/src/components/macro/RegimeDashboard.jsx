/**
 * RegimeDashboard — pure content component (no BaseWidget).
 * UniversalWidget handles BaseWidget wrapper + history fetch.
 * This component only fetches /macro/regime/current internally.
 */
import { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import CommonChart from '../common/CommonChart';
import { API_BASE } from '../../config/api';

const REGIME_CONFIG = {
  goldilocks: {
    name: 'Goldilocks',
    color: '#10b981',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500',
    textColor: 'text-green-400',
    description: 'Positive growth + moderate inflation',
  },
  reflation: {
    name: 'Reflation',
    color: '#f59e0b',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500',
    textColor: 'text-amber-400',
    description: 'Growth recovering + inflation rising',
  },
  stagflation: {
    name: 'Stagflation',
    color: '#ef4444',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500',
    textColor: 'text-red-400',
    description: 'Weak growth + high inflation',
  },
  deflation: {
    name: 'Deflation',
    color: '#3b82f6',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500',
    textColor: 'text-blue-400',
    description: 'Weak growth + low inflation',
  },
};

export default function RegimeDashboard({ history = [] }) {
  const [currentRegime, setCurrentRegime] = useState(null);
  const [chartType, setChartType] = useState('line');

  useEffect(() => {
    fetch(`${API_BASE}/macro/regime/current`)
      .then(r => r.json())
      .then(setCurrentRegime)
      .catch(() => {});
  }, []);

  const mostRecentData = history.length > 0 ? history[history.length - 1] : null;
  const config = mostRecentData ? REGIME_CONFIG[mostRecentData.regime] : null;

  const chartData = history.map(h => ({
    date: h.date
      ? new Date(h.date).toLocaleDateString('en-US', { year: '2-digit', month: 'short' })
      : h.date,
    growth_score: h.growth_score,
    inflation_score: h.inflation_score,
  }));

  return (
    <div className="flex flex-col divide-y divide-gray-800">

      {/* ── Current Regime ──────────────────────────────────────────── */}
      {config && mostRecentData && (
        <div className="p-4">
          <div className="text-[10px] text-gray-600 uppercase tracking-wide mb-3">Current Regime</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className={`p-3 rounded-lg ${config.bgColor} border ${config.borderColor} col-span-2 md:col-span-1`}>
              <div className={`text-xl font-bold ${config.textColor}`}>{config.name}</div>
              <p className="text-gray-400 text-xs mt-1">{config.description}</p>
              <p className="text-[10px] text-gray-600 mt-2">
                {new Date(mostRecentData.date).toLocaleDateString()}
              </p>
            </div>

            <div className="bg-gray-800/40 rounded-lg p-3">
              <div className="text-[10px] text-gray-500 mb-1">Growth Score</div>
              <div className="text-xl font-bold text-white flex items-center gap-1">
                {mostRecentData.growth_score > 0
                  ? <ArrowUp size={16} className="text-green-400" />
                  : <ArrowDown size={16} className="text-red-400" />}
                {mostRecentData.growth_score?.toFixed(1)}
              </div>
            </div>

            <div className="bg-gray-800/40 rounded-lg p-3">
              <div className="text-[10px] text-gray-500 mb-1">Inflation Score</div>
              <div className="text-xl font-bold text-white flex items-center gap-1">
                {mostRecentData.inflation_score > 0
                  ? <ArrowUp size={16} className="text-amber-400" />
                  : <ArrowDown size={16} className="text-blue-400" />}
                {mostRecentData.inflation_score?.toFixed(1)}
              </div>
            </div>

            <div className="bg-gray-800/40 rounded-lg p-3">
              <div className="text-[10px] text-gray-500 mb-1">GDP / CPI</div>
              <div className="text-lg font-bold text-white">
                {mostRecentData.gdp_growth?.toFixed(1)}%
                <span className="text-gray-500 mx-1">/</span>
                {mostRecentData.cpi_yoy?.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── History Chart ───────────────────────────────────────────── */}
      <div className="p-4">
        <div className="text-[10px] text-gray-600 uppercase tracking-wide mb-3">
          Growth vs Inflation
        </div>
        {chartData.length > 0 ? (
          <>
            <CommonChart
              data={chartData}
              series={[
                { key: 'growth_score',    name: 'Growth Score',    color: '#10b981' },
                { key: 'inflation_score', name: 'Inflation Score', color: '#f59e0b' },
              ]}
              xKey="date"
              type={chartType}
              height={240}
              fillContainer={false}
              showTypeSelector
              allowedTypes={['line', 'area', 'bar']}
              onTypeChange={setChartType}
              referenceLines={[{ value: 0, color: '#6b7280', label: '0' }]}
              tooltipFormatter={(v) => Number(v).toFixed(1)}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
              {Object.entries(REGIME_CONFIG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                  <span className={`text-xs ${cfg.textColor}`}>{cfg.name}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="h-[240px] flex items-center justify-center text-gray-500 text-sm">
            No historical data
          </div>
        )}
      </div>

      {/* ── Component Breakdown ─────────────────────────────────────── */}
      {currentRegime?.components && (
        <div className="p-4">
          <div className="text-[10px] text-gray-600 uppercase tracking-wide mb-3">Component Breakdown</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] text-gray-500 uppercase tracking-wide border-b border-gray-800">
                <th className="pb-2 font-medium">Component</th>
                <th className="pb-2 font-medium text-right">Value</th>
                <th className="pb-2 font-medium text-right">Weight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              <tr>
                <td className="py-2.5 text-gray-300">GDP Growth Rate</td>
                <td className="py-2.5 text-right text-white font-medium">
                  {currentRegime.components.gdp_growth?.toFixed(2)}%
                </td>
                <td className="py-2.5 text-right text-gray-500">50%</td>
              </tr>
              <tr>
                <td className="py-2.5 text-gray-300">Industrial Production YoY</td>
                <td className="py-2.5 text-right text-white font-medium">
                  {currentRegime.components.industrial_production_yoy?.toFixed(2)}%
                </td>
                <td className="py-2.5 text-right text-gray-500">25%</td>
              </tr>
              <tr>
                <td className="py-2.5 text-gray-300">Employment YoY</td>
                <td className="py-2.5 text-right text-white font-medium">
                  {currentRegime.components.employment_yoy?.toFixed(2)}%
                </td>
                <td className="py-2.5 text-right text-gray-500">25%</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
