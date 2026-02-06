/**
 * Ownership Institutional Widget - Top institutional holders
 */
import { useState, useEffect, useCallback } from 'react';
import { Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import BaseWidget from '../common/BaseWidget';
import { API_BASE } from '../../../config/api';

const formatNumber = (value) => {
  if (value === null || value === undefined) return '-';
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toLocaleString();
};

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-';
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
};

export default function OwnershipInstitutionalWidget({ symbol, onRemove }) {
  const [ownershipData, setOwnershipData] = useState(null);
  const [institutionalHolders, setInstitutionalHolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('chart');

  const loadData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/holders/${symbol}`);
      if (res.ok) {
        const data = await res.json();
        setOwnershipData(data.summary || {});
        setInstitutionalHolders(data.institutional || []);
      }
    } catch (error) {
      console.error('Error loading institutional holders:', error);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const topHolders = institutionalHolders.slice(0, 10);
  const chartData = topHolders.slice(0, 5).map(h => ({
    name: h.name?.length > 15 ? h.name.substring(0, 15) + '...' : h.name,
    pct: h.pct_held || 0,
  }));

  const renderChart = () => (
    <div className="h-full p-3">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-800/30 rounded-lg p-3">
          <div className="text-gray-400 text-xs mb-1">Total Institutional</div>
          <div className="text-xl font-bold text-blue-400">{ownershipData?.institutional_pct?.toFixed(1) || 0}%</div>
        </div>
        <div className="bg-gray-800/30 rounded-lg p-3">
          <div className="text-gray-400 text-xs mb-1">Top 10 Holdings</div>
          <div className="text-xl font-bold text-white">
            {topHolders.reduce((sum, h) => sum + (h.pct_held || 0), 0).toFixed(1)}%
          </div>
        </div>
        <div className="bg-gray-800/30 rounded-lg p-3">
          <div className="text-gray-400 text-xs mb-1">Institution Count</div>
          <div className="text-xl font-bold text-white">{institutionalHolders.length}</div>
        </div>
      </div>

      {/* Top Holders Chart */}
      {chartData.length > 0 ? (
        <div className="bg-gray-800/30 rounded-lg p-4">
          <h4 className="text-xs text-gray-400 mb-3">Top 5 Institutional Holders</h4>
          <div className="h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis type="number" stroke="#666" fontSize={10} tickFormatter={(v) => `${v}%`} />
                <YAxis dataKey="name" type="category" stroke="#666" fontSize={9} width={100} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                  formatter={(v) => `${v.toFixed(2)}%`} />
                <Bar dataKey="pct" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-[120px] text-gray-500 text-sm">No chart data</div>
      )}
    </div>
  );

  const renderTable = () => (
    <div className="h-full p-3">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-800/30 rounded-lg p-3">
          <div className="text-gray-400 text-xs mb-1">Total Institutional</div>
          <div className="text-xl font-bold text-blue-400">{ownershipData?.institutional_pct?.toFixed(1) || 0}%</div>
        </div>
        <div className="bg-gray-800/30 rounded-lg p-3">
          <div className="text-gray-400 text-xs mb-1">Top 10 Holdings</div>
          <div className="text-xl font-bold text-white">
            {topHolders.reduce((sum, h) => sum + (h.pct_held || 0), 0).toFixed(1)}%
          </div>
        </div>
        <div className="bg-gray-800/30 rounded-lg p-3">
          <div className="text-gray-400 text-xs mb-1">Institution Count</div>
          <div className="text-xl font-bold text-white">{institutionalHolders.length}</div>
        </div>
      </div>

      {/* Holders Table */}
      <div className="bg-gray-800/30 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#0a0a0f]">
            <tr className="text-[10px] text-gray-500">
              <th className="py-2 px-3 text-left font-medium">#</th>
              <th className="py-2 px-3 text-left font-medium">Institution</th>
              <th className="py-2 px-3 text-right font-medium">Shares</th>
              <th className="py-2 px-3 text-right font-medium">Value</th>
              <th className="py-2 px-3 text-right font-medium">% Held</th>
            </tr>
          </thead>
          <tbody>
            {topHolders.length > 0 ? topHolders.map((holder, idx) => (
              <tr key={idx} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                <td className="py-2 px-3 text-xs text-gray-500">{idx + 1}</td>
                <td className="py-2 px-3 text-xs text-white">{holder.name}</td>
                <td className="py-2 px-3 text-right text-xs text-gray-300">{formatNumber(holder.shares)}</td>
                <td className="py-2 px-3 text-right text-xs text-white">{formatCurrency(holder.value)}</td>
                <td className="py-2 px-3 text-right text-xs text-blue-400">{holder.pct_held?.toFixed(2)}%</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500 text-sm">No institutional holder data</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <BaseWidget
      title={`${symbol} - Institutional Holders`}
      icon={Building2}
      iconColor="text-blue-400"
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      showPeriodSelector={false}
    >
      {viewMode === 'chart' ? renderChart() : renderTable()}
    </BaseWidget>
  );
}
