/**
 * Macro Inflation Tab - Data-Focused Layout
 */
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
  LineChart, Line, Legend
} from 'recharts';
import { API_BASE } from '../../config/api';

const PERIODS = [
  { label: '1Y', value: '1y' },
  { label: '3Y', value: '3y' },
  { label: '5Y', value: '5y' },
  { label: '10Y', value: '10y' },
];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0a0a0f] border border-gray-700 rounded px-3 py-2 text-xs">
      <div className="text-gray-400 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-4" style={{ color: p.color }}>
          <span>{p.name}</span>
          <span className="font-medium">{p.value?.toFixed(2)}%</span>
        </div>
      ))}
    </div>
  );
};

export default function MacroInflationTab() {
  const [snapData, setSnapData] = useState(null);
  const [snapLoading, setSnapLoading] = useState(true);

  const [period, setPeriod] = useState('5y');
  const [sectorData, setSectorData] = useState(null);
  const [sectorLoading, setSectorLoading] = useState(true);
  const [activeSectors, setActiveSectors] = useState(new Set(['headline', 'core', 'food', 'energy', 'shelter']));

  // Snapshot (decomposition) load
  const loadSnap = async () => {
    setSnapLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/inflation/decomposition`);
      if (res.ok) setSnapData(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setSnapLoading(false);
    }
  };

  // Sector history load
  const loadSector = useCallback(async (p) => {
    setSectorLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/inflation/sector-history?period=${p}`);
      if (res.ok) setSectorData(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setSectorLoading(false);
    }
  }, []);

  useEffect(() => { loadSnap(); }, []);
  useEffect(() => { loadSector(period); }, [period, loadSector]);

  const getInflationColor = (v) => {
    if (v >= 3) return 'text-red-400';
    if (v >= 2) return 'text-yellow-400';
    return 'text-green-400';
  };

  const toggleSector = (key) => {
    setActiveSectors((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      return next;
    });
  };

  // Build chart history with tick-thinning for readability
  const chartHistory = (() => {
    if (!sectorData?.history) return [];
    const raw = sectorData.history;
    // Show roughly 24 ticks max for label readability
    const step = Math.max(1, Math.floor(raw.length / 24));
    return raw.map((pt, i) => ({
      ...pt,
      _label: i % step === 0 ? formatDate(pt.date) : '',
    }));
  })();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Inflation Analysis</h3>
        <button
          onClick={() => { loadSnap(); loadSector(period); }}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300"
        >
          <RefreshCw size={14} className={snapLoading || sectorLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Headline CPI */}
        <div className="col-span-6">
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
            <div className="text-gray-400 text-xs mb-1">Headline CPI (YoY)</div>
            <div className={`text-3xl font-bold ${getInflationColor(snapData?.headline_cpi?.yoy)}`}>
              {snapData?.headline_cpi?.yoy?.toFixed(2) ?? '-'}%
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-800">
              <div>
                <div className="text-gray-500 text-xs">MoM</div>
                <div className="text-white font-medium">{snapData?.headline_cpi?.mom?.toFixed(2) ?? '-'}%</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">Index</div>
                <div className="text-white font-medium">{snapData?.headline_cpi?.current?.toFixed(1) ?? '-'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Core CPI */}
        <div className="col-span-6">
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
            <div className="text-gray-400 text-xs mb-1">Core CPI (Ex Food & Energy)</div>
            <div className={`text-3xl font-bold ${getInflationColor(snapData?.core_cpi?.yoy)}`}>
              {snapData?.core_cpi?.yoy?.toFixed(2) ?? '-'}%
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-800">
              <div>
                <div className="text-gray-500 text-xs">MoM</div>
                <div className="text-white font-medium">{snapData?.core_cpi?.mom?.toFixed(2) ?? '-'}%</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">Index</div>
                <div className="text-white font-medium">{snapData?.core_cpi?.current?.toFixed(1) ?? '-'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Sector History Chart ── */}
        <div className="col-span-12">
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
            {/* Sub-header: title + period chips */}
            <div className="flex items-center justify-between mb-3">
              <div className="text-gray-400 text-xs">CPI by Sector — YoY % Change</div>
              <div className="flex gap-1">
                {PERIODS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPeriod(p.value)}
                    className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${
                      period === p.value
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                        : 'bg-gray-800 text-gray-400 hover:text-gray-200 border border-transparent'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sector toggle chips */}
            {sectorData?.sectors && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {sectorData.sectors.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => toggleSector(s.key)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                      activeSectors.has(s.key)
                        ? 'border-transparent opacity-100'
                        : 'border-gray-700 opacity-40'
                    }`}
                    style={activeSectors.has(s.key) ? { backgroundColor: s.color + '22', color: s.color, borderColor: s.color + '66' } : {}}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full inline-block"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.name}
                  </button>
                ))}
              </div>
            )}

            {/* Chart */}
            {sectorLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
              </div>
            ) : chartHistory.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartHistory} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis
                      dataKey="_label"
                      stroke="#4b5563"
                      fontSize={9}
                      tick={{ fill: '#6b7280' }}
                      interval={0}
                    />
                    <YAxis
                      stroke="#4b5563"
                      fontSize={10}
                      tick={{ fill: '#6b7280' }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={2} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} label={{ value: '2% target', fill: '#f59e0b', fontSize: 9, position: 'right' }} />
                    <ReferenceLine y={0} stroke="#374151" strokeWidth={1} />
                    {sectorData?.sectors?.map((s) =>
                      activeSectors.has(s.key) ? (
                        <Line
                          key={s.key}
                          type="monotone"
                          dataKey={s.key}
                          name={s.name}
                          stroke={s.color}
                          strokeWidth={1.5}
                          dot={false}
                          connectNulls
                        />
                      ) : null
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-500 text-sm">No data</div>
            )}
          </div>
        </div>

        {/* Components bar chart (snapshot) */}
        <div className="col-span-12">
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
            <div className="text-gray-400 text-xs mb-3">CPI Components — Current Snapshot (YoY)</div>
            {snapLoading ? (
              <div className="h-[220px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
            ) : snapData?.components ? (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={snapData.components}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="category" stroke="#4b5563" fontSize={10} angle={-12} textAnchor="end" height={55} tick={{ fill: '#6b7280' }} />
                    <YAxis stroke="#4b5563" fontSize={11} tick={{ fill: '#6b7280' }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={{ backgroundColor: '#0a0a0f', border: '1px solid #374151' }} formatter={(v) => [`${v?.toFixed(2)}%`]} />
                    <ReferenceLine y={2} stroke="#f59e0b" strokeDasharray="3 3" />
                    <Bar dataKey="yoy_change" radius={[4, 4, 0, 0]}>
                      {snapData.components.map((entry, idx) => (
                        <Cell key={idx} fill={entry.yoy_change >= 3 ? '#ef4444' : entry.yoy_change >= 1.5 ? '#f59e0b' : '#10b981'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-gray-500">No data</div>
            )}
          </div>
        </div>

        {/* Components Table */}
        <div className="col-span-12">
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#0a0a0f]">
                <tr className="text-[10px] text-gray-500">
                  <th className="py-2 px-4 text-left font-medium">Category</th>
                  <th className="py-2 px-4 text-right font-medium">Weight</th>
                  <th className="py-2 px-4 text-right font-medium">YoY Change</th>
                  <th className="py-2 px-4 text-right font-medium">Contribution</th>
                </tr>
              </thead>
              <tbody>
                {snapData?.components?.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                    <td className="py-2 px-4 text-sm font-medium text-white">{item.category}</td>
                    <td className="py-2 px-4 text-right text-sm text-gray-400">{item.weight?.toFixed(1)}%</td>
                    <td className="py-2 px-4 text-right">
                      <span className={`text-sm font-medium flex items-center justify-end gap-1 ${item.yoy_change >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {item.yoy_change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {item.yoy_change?.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right text-sm text-blue-400">{item.contribution?.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expectations */}
        {snapData?.expectations && (
          <div className="col-span-12">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-4">
              <div className="text-gray-400 text-xs mb-3">Inflation Expectations (Breakeven Rates)</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-gray-500 text-xs">5-Year Forward</div>
                  <div className="text-2xl font-bold text-white">{snapData.expectations['5y_breakeven']?.toFixed(2) ?? '-'}%</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">10-Year Forward</div>
                  <div className="text-2xl font-bold text-white">{snapData.expectations['10y_breakeven']?.toFixed(2) ?? '-'}%</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
