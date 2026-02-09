/**
 * Ownership Institutional Widget - Top institutional holders
 */
import { useState, useEffect, useCallback } from 'react';
import { Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import BaseWidget from '../common/BaseWidget';
import WidgetTable from '../common/WidgetTable';
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

export default function OwnershipInstitutionalWidget({ symbol: initialSymbol = 'AAPL', onRemove }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [ownershipData, setOwnershipData] = useState(null);
  const [institutionalHolders, setInstitutionalHolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('table');

  useEffect(() => {
    setSymbol(initialSymbol);
  }, [initialSymbol]);

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

  const columns = [
    {
      key: 'name',
      header: 'Institution',
      render: (row) => <span className="text-white">{row.name}</span>
    },
    {
      key: 'shares',
      header: 'Shares',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.shares,
      render: (row) => <span className="text-gray-300">{formatNumber(row.shares)}</span>
    },
    {
      key: 'value',
      header: 'Value',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.value,
      render: (row) => <span className="text-white">{formatCurrency(row.value)}</span>
    },
    {
      key: 'pct_held',
      header: '% Held',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.pct_held,
      render: (row) => <span className="text-blue-400">{row.pct_held?.toFixed(2)}%</span>
    },
  ];

  const renderSummary = () => (
    <div className="grid grid-cols-3 gap-3 mb-4 p-3 pb-0">
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
  );

  const renderChart = () => (
    <div className="h-full flex flex-col">
      {renderSummary()}
      {/* Top Holders Chart */}
      {chartData.length > 0 ? (
        <div className="flex-1 px-3 pb-3">
          <div className="bg-gray-800/30 rounded-lg p-4 h-full">
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
        </div>
      ) : (
        <div className="flex items-center justify-center flex-1 text-gray-500 text-sm">No chart data</div>
      )}
    </div>
  );

  const renderTable = () => (
    <div className="h-full flex flex-col">
      {renderSummary()}
      <div className="flex-1 overflow-auto px-3 pb-3">
        <WidgetTable
          columns={columns}
          data={topHolders}
          loading={loading}
          size="compact"
          showRowNumbers={true}
          emptyMessage="No institutional holder data"
        />
      </div>
    </div>
  );

  return (
    <BaseWidget
      title="Institutional Holders"
      icon={Building2}
      iconColor="text-blue-400"
      symbol={symbol}
      onSymbolChange={setSymbol}
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
