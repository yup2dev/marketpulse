/**
 * Ownership Overview Widget - Ownership breakdown pie chart & share statistics
 */
import { useState, useEffect, useCallback } from 'react';
import { Users, Building2, UserCheck, Shield, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import BaseWidget from '../common/BaseWidget';
import { API_BASE } from '../../../config/api';

const COLORS = {
  institutional: '#3b82f6',
  insiders: '#22c55e',
  retail: '#f59e0b',
};

const formatNumber = (value) => {
  if (value === null || value === undefined) return '-';
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toLocaleString();
};

export default function OwnershipOverviewWidget({ symbol, onRemove }) {
  const [ownershipData, setOwnershipData] = useState(null);
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
      }
    } catch (error) {
      console.error('Error loading ownership overview:', error);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const ownershipBreakdown = ownershipData ? [
    { name: 'Institutional', value: ownershipData.institutional_pct || 0, color: COLORS.institutional },
    { name: 'Insider', value: ownershipData.insider_pct || 0, color: COLORS.insiders },
    { name: 'Retail/Other', value: Math.max(0, 100 - (ownershipData.institutional_pct || 0) - (ownershipData.insider_pct || 0)), color: COLORS.retail },
  ].filter(item => item.value > 0) : [];

  const renderChart = () => {
    if (!ownershipData) return <div className="flex items-center justify-center h-full text-gray-500">No data</div>;

    return (
      <div className="h-full p-3">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-gray-800/30 rounded-lg p-3">
            <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
              <Building2 size={12} />Institutional
            </div>
            <div className="text-xl font-bold text-blue-400">{ownershipData.institutional_pct?.toFixed(1) || 0}%</div>
          </div>
          <div className="bg-gray-800/30 rounded-lg p-3">
            <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
              <UserCheck size={12} />Insider
            </div>
            <div className="text-xl font-bold text-green-400">{ownershipData.insider_pct?.toFixed(1) || 0}%</div>
          </div>
          <div className="bg-gray-800/30 rounded-lg p-3">
            <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
              <Shield size={12} />Short Interest
            </div>
            <div className="text-xl font-bold text-red-400">{ownershipData.short_interest?.toFixed(1) || 0}%</div>
          </div>
          <div className="bg-gray-800/30 rounded-lg p-3">
            <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
              <TrendingUp size={12} />Float %
            </div>
            <div className="text-xl font-bold text-white">
              {ownershipData.shares_outstanding && ownershipData.float_shares
                ? ((ownershipData.float_shares / ownershipData.shares_outstanding) * 100).toFixed(1)
                : 0}%
            </div>
          </div>
        </div>

        {/* Pie Chart */}
        {ownershipBreakdown.length > 0 ? (
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={ownershipBreakdown} cx="50%" cy="50%" innerRadius={35} outerRadius={55}
                  paddingAngle={2} dataKey="value" isAnimationActive={false}>
                  {ownershipBreakdown.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', fontSize: '12px' }}
                  formatter={(value) => `${value.toFixed(1)}%`} isAnimationActive={false} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[160px] text-gray-500 text-sm">No data</div>
        )}
        <div className="flex justify-center gap-4 mt-2 flex-wrap">
          {ownershipBreakdown.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1 text-xs">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-gray-400">{item.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTable = () => {
    if (!ownershipData) return <div className="flex items-center justify-center h-full text-gray-500">No ownership data available</div>;

    return (
      <div className="h-full p-3">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-gray-800/30 rounded-lg p-3">
            <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
              <Building2 size={12} />Institutional
            </div>
            <div className="text-xl font-bold text-blue-400">{ownershipData.institutional_pct?.toFixed(1) || 0}%</div>
          </div>
          <div className="bg-gray-800/30 rounded-lg p-3">
            <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
              <UserCheck size={12} />Insider
            </div>
            <div className="text-xl font-bold text-green-400">{ownershipData.insider_pct?.toFixed(1) || 0}%</div>
          </div>
          <div className="bg-gray-800/30 rounded-lg p-3">
            <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
              <Shield size={12} />Short Interest
            </div>
            <div className="text-xl font-bold text-red-400">{ownershipData.short_interest?.toFixed(1) || 0}%</div>
          </div>
          <div className="bg-gray-800/30 rounded-lg p-3">
            <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
              <TrendingUp size={12} />Float %
            </div>
            <div className="text-xl font-bold text-white">
              {ownershipData.shares_outstanding && ownershipData.float_shares
                ? ((ownershipData.float_shares / ownershipData.shares_outstanding) * 100).toFixed(1)
                : 0}%
            </div>
          </div>
        </div>

        {/* Share Statistics Table */}
        <div className="bg-gray-800/30 rounded-lg p-4">
          <h4 className="text-xs text-gray-400 mb-3">Share Statistics</h4>
          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b border-gray-700">
              <span className="text-gray-400 text-xs">Shares Outstanding</span>
              <span className="text-white text-sm font-medium">{formatNumber(ownershipData.shares_outstanding)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-700">
              <span className="text-gray-400 text-xs">Float</span>
              <span className="text-white text-sm font-medium">{formatNumber(ownershipData.float_shares)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-700">
              <span className="text-gray-400 text-xs">Short % of Float</span>
              <span className="text-red-400 text-sm font-medium">{ownershipData.short_interest?.toFixed(1) || 0}%</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-400 text-xs">Avg. Volume</span>
              <span className="text-white text-sm font-medium">{formatNumber(ownershipData.avg_volume)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <BaseWidget
      title={`${symbol} - Ownership Overview`}
      icon={Users}
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
