/**
 * Labor Market Widget - Employment metrics dashboard
 * Uses BaseWidget for common functionality
 */
import { useState, useEffect, useCallback, Fragment } from 'react';
import { Users, TrendingUp, TrendingDown } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import BaseWidget from '../common/BaseWidget';
import { API_BASE } from '../../../config/api';

const getHeatColor = (value) => {
  if (value >= 70) return '#ef4444';
  if (value >= 50) return '#eab308';
  return '#22c55e';
};

const getHeatTextColor = (value) => {
  if (value >= 70) return 'text-red-400';
  if (value >= 50) return 'text-yellow-400';
  return 'text-green-400';
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a1f] border border-gray-700 rounded px-3 py-2 shadow-lg">
        <p className="text-gray-400 text-xs mb-1">{label}</p>
        <p className="text-sm text-white">
          {typeof payload[0].value === 'number' ? payload[0].value.toFixed(1) : payload[0].value}%
        </p>
      </div>
    );
  }
  return null;
};

const formatNumber = (value) => {
  if (value === null || value === undefined) return '-';
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString();
};

export default function LaborMarketWidget({ onRemove }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('chart');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/labor/dashboard`);
      if (res.ok) setData(await res.json());
    } catch (error) {
      console.error('Error loading labor data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const renderChart = () => {
    if (!data) return null;

    const barData = [];
    if (data.unemployment?.u3 != null) barData.push({ name: 'U3', value: data.unemployment.u3, color: '#3b82f6' });
    if (data.unemployment?.u6 != null) barData.push({ name: 'U6', value: data.unemployment.u6, color: '#8b5cf6' });
    if (data.unemployment?.participation_rate != null) barData.push({ name: 'Participation', value: data.unemployment.participation_rate, color: '#06b6d4' });
    if (data.wages?.hourly_earnings_yoy != null) barData.push({ name: 'Wage Growth', value: data.wages.hourly_earnings_yoy, color: '#22c55e' });

    return (
      <div className="h-full flex flex-col">
        {/* Heat index header */}
        <div className="flex items-center gap-3 px-1 pb-2 flex-shrink-0">
          <span className="text-xs text-gray-400">Heat Index:</span>
          <div className="flex items-center gap-2">
            <span className={`text-lg font-bold ${getHeatTextColor(data.heat_index)}`}>
              {data.heat_index?.toFixed(0) || '-'}
            </span>
            {/* Mini gauge */}
            <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, data.heat_index || 0)}%`,
                  backgroundColor: getHeatColor(data.heat_index || 0),
                }}
              />
            </div>
          </div>
          {data.unemployment?.trend && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
              data.unemployment.trend === 'improving' ? 'bg-green-500/20 text-green-400 border-green-500/30'
              : data.unemployment.trend === 'deteriorating' ? 'bg-red-500/20 text-red-400 border-red-500/30'
              : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
            }`}>
              {data.unemployment.trend.toUpperCase()}
            </span>
          )}
        </div>
        {/* Chart */}
        <div className="flex-1 min-h-0">
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} tickFormatter={(v) => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32}>
                  {barData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">No chart data</div>
          )}
        </div>
      </div>
    );
  };

  const renderTable = () => {
    if (!data) return null;

    const rows = [];
    // Heat Index
    rows.push({
      section: 'Overview',
      metric: 'Labor Heat Index',
      value: data.heat_index?.toFixed(0) || '-',
      suffix: '/100',
      trend: data.heat_index >= 70 ? 'hot' : data.heat_index >= 50 ? 'warm' : 'cool',
    });
    // Unemployment
    if (data.unemployment) {
      rows.push({ section: 'Unemployment', metric: 'U3 Rate', value: `${data.unemployment.u3?.toFixed(1) || '-'}%` });
      rows.push({ metric: 'U6 Rate', value: `${data.unemployment.u6?.toFixed(1) || '-'}%` });
      rows.push({ metric: 'Participation Rate', value: `${data.unemployment.participation_rate?.toFixed(1) || '-'}%` });
    }
    // Job Market
    if (data.job_market) {
      rows.push({ section: 'Job Market', metric: 'Nonfarm Payrolls', value: formatNumber(data.job_market.nonfarm_payrolls) });
      rows.push({ metric: 'Payroll Change (MoM)', value: formatNumber(data.job_market.payroll_change_mom), isPositive: (data.job_market.payroll_change_mom || 0) >= 0 });
      rows.push({ metric: 'JOLTS Openings', value: formatNumber(data.job_market.jolts_openings) });
      rows.push({ metric: 'Quits Rate', value: `${data.job_market.quits_rate?.toFixed(1) || '-'}%` });
      rows.push({ metric: 'Initial Claims', value: formatNumber(data.job_market.initial_claims) });
      rows.push({ metric: 'Continuing Claims', value: formatNumber(data.job_market.continuing_claims) });
    }
    // Wages
    if (data.wages) {
      rows.push({ section: 'Wages', metric: 'Hourly Earnings', value: `$${data.wages.hourly_earnings?.toFixed(2) || '-'}` });
      rows.push({ metric: 'Wage Growth (YoY)', value: `${data.wages.hourly_earnings_yoy?.toFixed(1) || '-'}%`, isPositive: true });
      rows.push({ metric: 'Unit Labor Cost', value: `${data.wages.unit_labor_cost?.toFixed(1) || '-'}%` });
      rows.push({ metric: 'Productivity Growth', value: `${data.wages.productivity_growth?.toFixed(1) || '-'}%`, isPositive: (data.wages.productivity_growth || 0) >= 0 });
    }

    return (
      <div className="overflow-auto h-full">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0d0d12]">
            <tr className="border-b border-gray-800">
              <th className="text-left py-2 px-3 text-gray-400 font-medium">Metric</th>
              <th className="text-right py-2 px-3 text-gray-400 font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <Fragment key={idx}>
                {row.section && (
                  <tr className="border-t border-gray-800">
                    <td colSpan={2} className="py-2 px-3 text-gray-400 text-[10px] font-medium">{row.section}</td>
                  </tr>
                )}
                <tr className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 px-3 text-white">{row.metric}</td>
                  <td className="py-2 px-3 text-right">
                    {row.isPositive !== undefined ? (
                      <span className={`flex items-center justify-end gap-1 ${row.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {row.isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {row.value}{row.suffix || ''}
                      </span>
                    ) : row.trend ? (
                      <span className={getHeatTextColor(data.heat_index)}>
                        {row.value}{row.suffix || ''}
                      </span>
                    ) : (
                      <span className="text-white tabular-nums">{row.value}{row.suffix || ''}</span>
                    )}
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const getExportData = () => {
    if (!data) return { columns: [], rows: [] };
    const rows = [
      { metric: 'U3 Unemployment Rate', value: data.unemployment?.u3 ?? '', unit: '%' },
      { metric: 'U6 Unemployment Rate', value: data.unemployment?.u6 ?? '', unit: '%' },
      { metric: 'Participation Rate',   value: data.unemployment?.participation_rate ?? '', unit: '%' },
      { metric: 'Non-Farm Payrolls',    value: data.payrolls?.nfp ?? '', unit: 'K' },
      { metric: 'Private Payrolls',     value: data.payrolls?.private ?? '', unit: 'K' },
      { metric: 'Hourly Earnings YoY',  value: data.wages?.hourly_earnings_yoy ?? '', unit: '%' },
      { metric: 'Average Workweek',     value: data.wages?.avg_workweek ?? '', unit: 'hrs' },
      { metric: 'Heat Index',           value: data.heat_index ?? '', unit: '' },
    ];
    return {
      columns: [
        { key: 'metric', header: 'Metric' },
        { key: 'value',  header: 'Value'  },
        { key: 'unit',   header: 'Unit'   },
      ],
      rows,
    };
  };

  return (
    <BaseWidget
      title="Labor Market"
      icon={Users}
      iconColor="text-cyan-400"
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      showPeriodSelector={false}
      source="BLS / FRED"
      exportData={data ? getExportData : undefined}
    >
      <div className="h-full p-3">
        {viewMode === 'chart' ? renderChart() : renderTable()}
      </div>
    </BaseWidget>
  );
}
