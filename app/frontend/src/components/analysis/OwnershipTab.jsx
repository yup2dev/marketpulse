/**
 * Ownership Tab - Single table component for ownership data
 * Combines overview, institutional holders, and insider activity
 */
import { useState, useEffect, useCallback } from 'react';
import { Building2, UserCheck, Shield, TrendingUp, RefreshCw } from 'lucide-react';
import { API_BASE } from '../../config/api';

const CATEGORIES = [
  { id: 'overview', name: 'Overview' },
  { id: 'institutional', name: 'Institutional' },
  { id: 'insider', name: 'Insider' },
];

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

export default function OwnershipTab({ symbol }) {
  const [activeCategory, setActiveCategory] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({});
  const [institutional, setInstitutional] = useState([]);
  const [insiderTransactions, setInsiderTransactions] = useState([]);
  const [insiderSummary, setInsiderSummary] = useState(null);

  const loadData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const [holdersRes, insiderRes] = await Promise.all([
        fetch(`${API_BASE}/stock/holders/${symbol}`),
        fetch(`${API_BASE}/stock/insider-trading/${symbol}`),
      ]);

      if (holdersRes.ok) {
        const data = await holdersRes.json();
        setSummary(data.summary || {});
        setInstitutional(data.institutional || []);
      }
      if (insiderRes.ok) {
        const data = await insiderRes.json();
        setInsiderTransactions(data.transactions || []);
        setInsiderSummary(data.summary || null);
      }
    } catch (error) {
      console.error('Error loading ownership data:', error);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const floatPct = summary.shares_outstanding && summary.float_shares
    ? ((summary.float_shares / summary.shares_outstanding) * 100).toFixed(1)
    : '0';

  const overviewRows = [
    { metric: 'Shares Outstanding', value: formatNumber(summary.shares_outstanding) },
    { metric: 'Float', value: formatNumber(summary.float_shares) },
    { metric: 'Short % of Float', value: `${summary.short_interest?.toFixed(1) || 0}%`, color: 'text-red-400' },
    { metric: 'Avg. Volume', value: formatNumber(summary.avg_volume) },
    { metric: 'Institutional %', value: `${summary.institutional_pct?.toFixed(1) || 0}%`, color: 'text-blue-400' },
    { metric: 'Insider %', value: `${summary.insider_pct?.toFixed(1) || 0}%`, color: 'text-green-400' },
  ];

  const renderOverviewTable = () => (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-[#0d0d12] z-10">
        <tr className="border-b border-gray-800">
          <th className="text-left py-3 px-4 text-gray-400 font-medium">Metric</th>
          <th className="text-right py-3 px-4 text-gray-400 font-medium">Value</th>
        </tr>
      </thead>
      <tbody>
        {overviewRows.map((row) => (
          <tr key={row.metric} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
            <td className="py-3 px-4 text-gray-400 text-xs">{row.metric}</td>
            <td className={`py-3 px-4 text-right text-sm font-medium tabular-nums ${row.color || 'text-white'}`}>
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderInstitutionalTable = () => (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-[#0d0d12] z-10">
        <tr className="border-b border-gray-800">
          <th className="text-left py-3 px-4 text-gray-400 font-medium w-10">#</th>
          <th className="text-left py-3 px-4 text-gray-400 font-medium">Institution</th>
          <th className="text-right py-3 px-4 text-gray-400 font-medium">Shares</th>
          <th className="text-right py-3 px-4 text-gray-400 font-medium">Value</th>
          <th className="text-right py-3 px-4 text-gray-400 font-medium">% Held</th>
        </tr>
      </thead>
      <tbody>
        {institutional.length > 0 ? institutional.map((holder, idx) => (
          <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
            <td className="py-3 px-4 text-xs text-gray-500">{idx + 1}</td>
            <td className="py-3 px-4 text-xs text-white">{holder.name}</td>
            <td className="py-3 px-4 text-right text-xs text-gray-300 tabular-nums">{formatNumber(holder.shares)}</td>
            <td className="py-3 px-4 text-right text-xs text-white tabular-nums">{formatCurrency(holder.value)}</td>
            <td className="py-3 px-4 text-right text-xs text-blue-400 tabular-nums">{holder.pct_held?.toFixed(2)}%</td>
          </tr>
        )) : (
          <tr>
            <td colSpan={5} className="py-8 text-center text-gray-500 text-sm">No institutional holder data</td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const renderInsiderTable = () => (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-[#0d0d12] z-10">
        <tr className="border-b border-gray-800">
          <th className="text-left py-3 px-4 text-gray-400 font-medium">Date</th>
          <th className="text-left py-3 px-4 text-gray-400 font-medium">Name</th>
          <th className="text-center py-3 px-4 text-gray-400 font-medium">Type</th>
          <th className="text-right py-3 px-4 text-gray-400 font-medium">Shares</th>
          <th className="text-right py-3 px-4 text-gray-400 font-medium">Value</th>
        </tr>
      </thead>
      <tbody>
        {insiderTransactions.length > 0 ? insiderTransactions.map((tx, idx) => (
          <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
            <td className="py-3 px-4 text-xs text-gray-400">{tx.transaction_date}</td>
            <td className="py-3 px-4 text-xs text-white">{tx.insider_name}</td>
            <td className="py-3 px-4 text-center">
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                tx.acquisition_or_disposition === 'A' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {tx.acquisition_or_disposition === 'A' ? 'Buy' : 'Sell'}
              </span>
            </td>
            <td className="py-3 px-4 text-right text-xs text-gray-300 tabular-nums">{formatNumber(tx.shares_traded)}</td>
            <td className="py-3 px-4 text-right text-xs text-white tabular-nums">{formatCurrency(tx.transaction_value)}</td>
          </tr>
        )) : (
          <tr>
            <td colSpan={5} className="py-8 text-center text-gray-500 text-sm">No insider transaction data</td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const renderTable = () => {
    switch (activeCategory) {
      case 'overview': return renderOverviewTable();
      case 'institutional': return renderInstitutionalTable();
      case 'insider': return renderInsiderTable();
      default: return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      {/* Header - Summary Cards */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="grid grid-cols-4 gap-3 flex-1">
            <div className="bg-gray-800/30 rounded-lg p-3">
              <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
                <Building2 size={12} />Institutional
              </div>
              <div className="text-xl font-bold text-blue-400">{summary.institutional_pct?.toFixed(1) || 0}%</div>
            </div>
            <div className="bg-gray-800/30 rounded-lg p-3">
              <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
                <UserCheck size={12} />Insider
              </div>
              <div className="text-xl font-bold text-green-400">{summary.insider_pct?.toFixed(1) || 0}%</div>
            </div>
            <div className="bg-gray-800/30 rounded-lg p-3">
              <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
                <Shield size={12} />Short Interest
              </div>
              <div className="text-xl font-bold text-red-400">{summary.short_interest?.toFixed(1) || 0}%</div>
            </div>
            <div className="bg-gray-800/30 rounded-lg p-3">
              <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
                <TrendingUp size={12} />Float %
              </div>
              <div className="text-xl font-bold text-white">{floatPct}%</div>
            </div>
          </div>
          <button
            onClick={loadData}
            className="ml-3 p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded transition-colors ${
              activeCategory === cat.id
                ? 'text-cyan-400 bg-cyan-400/10'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <RefreshCw size={16} className="animate-spin mr-2" />
            Loading...
          </div>
        ) : (
          renderTable()
        )}
      </div>
    </div>
  );
}
