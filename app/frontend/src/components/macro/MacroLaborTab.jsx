/**
 * Macro Labor Market Tab - Data-Focused Layout
 */
import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { API_BASE } from '../../config/api';

export default function MacroLaborTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/labor/dashboard`);
      if (res.ok) setData(await res.json());
    } catch (error) {
      console.error('Error loading labor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (value) => {
    if (value === null || value === undefined) return '-';
    if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toLocaleString();
  };

  const getTrendColor = (trend) => {
    if (trend === 'improving') return 'text-green-400';
    if (trend === 'deteriorating') return 'text-red-400';
    return 'text-yellow-400';
  };

  const MetricCard = ({ label, value, suffix = '', subtext }) => (
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
      <div className="text-gray-400 text-xs mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{value}{suffix}</div>
      {subtext && <div className="text-gray-500 text-xs mt-1">{subtext}</div>}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Labor Market</h3>
        <button onClick={loadData} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : data ? (
        <div className="grid grid-cols-12 gap-4">
          {/* Heat Index */}
          <div className="col-span-4">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
              <div className="text-gray-400 text-xs mb-1">Labor Heat Index</div>
              <div className={`text-4xl font-bold ${data.heat_index >= 70 ? 'text-red-400' : data.heat_index >= 50 ? 'text-yellow-400' : 'text-green-400'}`}>
                {data.heat_index?.toFixed(0) || '-'}
              </div>
              <div className="text-gray-500 text-xs mt-1">0 = Weak, 100 = Hot</div>
            </div>
          </div>

          {/* Unemployment */}
          <div className="col-span-8">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
              <div className="text-gray-400 text-xs mb-3">Unemployment</div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-gray-500 text-xs">U3 Rate</div>
                  <div className="text-xl font-bold text-white">{data.unemployment?.u3?.toFixed(1) || '-'}%</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">U6 Rate</div>
                  <div className="text-xl font-bold text-white">{data.unemployment?.u6?.toFixed(1) || '-'}%</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Participation</div>
                  <div className="text-xl font-bold text-white">{data.unemployment?.participation_rate?.toFixed(1) || '-'}%</div>
                </div>
              </div>
              {data.unemployment?.trend && (
                <div className={`text-xs mt-2 capitalize ${getTrendColor(data.unemployment.trend)}`}>
                  Trend: {data.unemployment.trend}
                </div>
              )}
            </div>
          </div>

          {/* Job Market Table */}
          <div className="col-span-12">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden">
              <div className="p-3 border-b border-gray-800">
                <span className="text-gray-400 text-xs">Job Market Indicators</span>
              </div>
              <table className="w-full">
                <thead className="bg-[#0a0a0f]">
                  <tr className="text-[10px] text-gray-500">
                    <th className="py-2 px-4 text-left font-medium">Metric</th>
                    <th className="py-2 px-4 text-right font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-800/30 hover:bg-gray-800/20">
                    <td className="py-2 px-4 text-sm text-white">Nonfarm Payrolls</td>
                    <td className="py-2 px-4 text-right text-sm text-white">{formatNumber(data.job_market?.nonfarm_payrolls)}</td>
                  </tr>
                  <tr className="border-b border-gray-800/30 hover:bg-gray-800/20">
                    <td className="py-2 px-4 text-sm text-white">Payroll Change (MoM)</td>
                    <td className="py-2 px-4 text-right">
                      <span className={`text-sm flex items-center justify-end gap-1 ${(data.job_market?.payroll_change_mom || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(data.job_market?.payroll_change_mom || 0) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {formatNumber(data.job_market?.payroll_change_mom)}
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-800/30 hover:bg-gray-800/20">
                    <td className="py-2 px-4 text-sm text-white">JOLTS Job Openings</td>
                    <td className="py-2 px-4 text-right text-sm text-white">{formatNumber(data.job_market?.jolts_openings)}</td>
                  </tr>
                  <tr className="border-b border-gray-800/30 hover:bg-gray-800/20">
                    <td className="py-2 px-4 text-sm text-white">Quits Rate</td>
                    <td className="py-2 px-4 text-right text-sm text-white">{data.job_market?.quits_rate?.toFixed(1) || '-'}%</td>
                  </tr>
                  <tr className="border-b border-gray-800/30 hover:bg-gray-800/20">
                    <td className="py-2 px-4 text-sm text-white">Initial Claims</td>
                    <td className="py-2 px-4 text-right text-sm text-white">{formatNumber(data.job_market?.initial_claims)}</td>
                  </tr>
                  <tr className="border-b border-gray-800/30 hover:bg-gray-800/20">
                    <td className="py-2 px-4 text-sm text-white">Continuing Claims</td>
                    <td className="py-2 px-4 text-right text-sm text-white">{formatNumber(data.job_market?.continuing_claims)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Wages */}
          <div className="col-span-12">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
              <div className="text-gray-400 text-xs mb-3">Wages & Productivity</div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <div className="text-gray-500 text-xs">Hourly Earnings</div>
                  <div className="text-xl font-bold text-white">${data.wages?.hourly_earnings?.toFixed(2) || '-'}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Wage Growth (YoY)</div>
                  <div className={`text-xl font-bold ${(data.wages?.hourly_earnings_yoy || 0) >= 3 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {data.wages?.hourly_earnings_yoy?.toFixed(1) || '-'}%
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Unit Labor Cost</div>
                  <div className="text-xl font-bold text-white">{data.wages?.unit_labor_cost?.toFixed(1) || '-'}%</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Productivity Growth</div>
                  <div className={`text-xl font-bold ${(data.wages?.productivity_growth || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {data.wages?.productivity_growth?.toFixed(1) || '-'}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-500 py-8">No data available</div>
      )}
    </div>
  );
}
