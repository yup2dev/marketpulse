/**
 * Ownership Tab - WidgetDashboard 기반 동적 레이아웃
 */
import { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell,
  Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Building2, Users, UserCheck, TrendingUp, TrendingDown,
  RefreshCw, Briefcase, Shield, GripVertical
} from 'lucide-react';
import WidgetDashboard from '../WidgetDashboard';
import { API_BASE } from '../../config/api';
import { formatNumber, formatCurrency } from '../../utils/widgetUtils';

const COLORS = {
  institutional: '#3b82f6',
  insiders: '#22c55e',
  retail: '#f59e0b',
};

function OwnershipTabWidget({ symbol, onRemove }) {
  const [ownershipData, setOwnershipData] = useState(null);
  const [institutionalHolders, setInstitutionalHolders] = useState([]);
  const [insiderTransactions, setInsiderTransactions] = useState([]);
  const [insiderSummary, setInsiderSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    if (symbol) loadOwnershipData();
  }, [symbol]);

  const loadOwnershipData = async () => {
    setLoading(true);
    try {
      const [holdersRes, insiderRes] = await Promise.all([
        fetch(`${API_BASE}/stock/holders/${symbol}`),
        fetch(`${API_BASE}/stock/insider-trading/${symbol}`)
      ]);

      if (holdersRes.ok) {
        const data = await holdersRes.json();
        setOwnershipData(data.summary || {});
        setInstitutionalHolders(data.institutional || []);
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
  };

  const ownershipBreakdown = ownershipData ? [
    { name: 'Institutional', value: ownershipData.institutional_pct || 0, color: COLORS.institutional },
    { name: 'Insider', value: ownershipData.insider_pct || 0, color: COLORS.insiders },
    { name: 'Retail/Other', value: Math.max(0, 100 - (ownershipData.institutional_pct || 0) - (ownershipData.insider_pct || 0)), color: COLORS.retail },
  ].filter(item => item.value > 0) : [];

  if (loading) {
    return (
      <div className="bg-[#0d0d12] rounded-lg border border-gray-800 h-full flex items-center justify-center">
        <RefreshCw className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="drag-handle-area cursor-move p-1 hover:bg-gray-700 rounded">
              <GripVertical size={14} className="text-gray-500" />
            </div>
            <Users className="text-blue-500" size={24} />
            <div>
              <h3 className="text-lg font-semibold text-white">Ownership - {symbol}</h3>
              <p className="text-gray-400 text-xs">Institutional, insider, and retail ownership</p>
            </div>
          </div>
          <button
            onClick={loadOwnershipData}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
        <div className="flex gap-1">
          {[
            { id: 'overview', label: 'Overview', icon: Briefcase },
            { id: 'institutional', label: 'Institutional', icon: Building2 },
            { id: 'insiders', label: 'Insiders', icon: UserCheck },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeSection === id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Overview Section */}
        {activeSection === 'overview' && ownershipData && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-3">
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

            {/* Pie Chart & Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800/30 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-white mb-3">Ownership Breakdown</h4>
                {ownershipBreakdown.length > 0 ? (
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={ownershipBreakdown} cx="50%" cy="50%" innerRadius={30} outerRadius={50}
                          paddingAngle={2} dataKey="value" label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}>
                          {ownershipBreakdown.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                          formatter={(value) => `${value.toFixed(1)}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-gray-400 text-sm">No data</div>
                )}
              </div>
              <div className="bg-gray-800/30 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-white mb-3">Share Statistics</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-2 border-b border-gray-800">
                    <span className="text-gray-400">Shares Outstanding</span>
                    <span className="text-white">{formatNumber(ownershipData.shares_outstanding)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-800">
                    <span className="text-gray-400">Float</span>
                    <span className="text-white">{formatNumber(ownershipData.float_shares)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-400">Short % of Float</span>
                    <span className="text-red-400">{ownershipData.short_interest?.toFixed(1) || 0}%</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Institutional Section */}
        {activeSection === 'institutional' && (
          <div className="bg-gray-800/30 rounded-lg overflow-hidden">
            <div className="p-3 border-b border-gray-700">
              <h4 className="text-sm font-semibold text-white">Institutional Holders ({institutionalHolders.length})</h4>
            </div>
            {institutionalHolders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 px-3 text-gray-400">#</th>
                      <th className="text-left py-2 px-3 text-gray-400">Institution</th>
                      <th className="text-right py-2 px-3 text-gray-400">Shares</th>
                      <th className="text-right py-2 px-3 text-gray-400">Value</th>
                      <th className="text-right py-2 px-3 text-gray-400">% Held</th>
                    </tr>
                  </thead>
                  <tbody>
                    {institutionalHolders.slice(0, 10).map((holder, idx) => (
                      <tr key={idx} className="border-b border-gray-800">
                        <td className="py-2 px-3 text-gray-500">{idx + 1}</td>
                        <td className="py-2 px-3 text-white">{holder.name}</td>
                        <td className="text-right py-2 px-3 text-gray-300">{formatNumber(holder.shares)}</td>
                        <td className="text-right py-2 px-3 text-white">{formatCurrency(holder.value)}</td>
                        <td className="text-right py-2 px-3 text-blue-400">{holder.pct_held?.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">No institutional holder data</div>
            )}
          </div>
        )}

        {/* Insiders Section */}
        {activeSection === 'insiders' && (
          <>
            {insiderSummary && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800/30 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
                    <TrendingUp size={12} className="text-green-400" />Total Buys
                  </div>
                  <div className="text-xl font-bold text-green-400">{insiderSummary.buy_count || 0}</div>
                  <div className="text-xs text-gray-500">{formatCurrency(insiderSummary.buy_value)}</div>
                </div>
                <div className="bg-gray-800/30 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
                    <TrendingDown size={12} className="text-red-400" />Total Sells
                  </div>
                  <div className="text-xl font-bold text-red-400">{insiderSummary.sell_count || 0}</div>
                  <div className="text-xs text-gray-500">{formatCurrency(insiderSummary.sell_value)}</div>
                </div>
                <div className="bg-gray-800/30 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
                    <Users size={12} />Net Activity
                  </div>
                  <div className={`text-xl font-bold ${(insiderSummary.net_value || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(Math.abs(insiderSummary.net_value || 0))}
                  </div>
                  <div className="text-xs text-gray-500">{(insiderSummary.net_value || 0) >= 0 ? 'Net Buying' : 'Net Selling'}</div>
                </div>
              </div>
            )}

            <div className="bg-gray-800/30 rounded-lg overflow-hidden">
              <div className="p-3 border-b border-gray-700">
                <h4 className="text-sm font-semibold text-white">Recent Insider Transactions</h4>
              </div>
              {insiderTransactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-2 px-3 text-gray-400">Date</th>
                        <th className="text-left py-2 px-3 text-gray-400">Name</th>
                        <th className="text-center py-2 px-3 text-gray-400">Type</th>
                        <th className="text-right py-2 px-3 text-gray-400">Shares</th>
                        <th className="text-right py-2 px-3 text-gray-400">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insiderTransactions.slice(0, 8).map((tx, idx) => (
                        <tr key={idx} className="border-b border-gray-800">
                          <td className="py-2 px-3 text-gray-400">{tx.transaction_date}</td>
                          <td className="py-2 px-3 text-white">{tx.insider_name}</td>
                          <td className="text-center py-2 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                              tx.acquisition_or_disposition === 'A' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {tx.acquisition_or_disposition === 'A' ? 'Buy' : 'Sell'}
                            </span>
                          </td>
                          <td className="text-right py-2 px-3 text-gray-300">{formatNumber(tx.shares_traded)}</td>
                          <td className="text-right py-2 px-3 text-white">{formatCurrency(tx.transaction_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm">No insider transaction data</div>
              )}
            </div>
          </>
        )}

        {/* Empty State */}
        {!ownershipData && !loading && (
          <div className="bg-gray-800/30 rounded-lg p-8 text-center">
            <Users className="mx-auto mb-3 text-gray-600" size={40} />
            <div className="text-gray-400">No ownership data available for {symbol}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export { OwnershipTabWidget };

const AVAILABLE_WIDGETS = [
  { id: 'ownership-tab', name: 'Ownership', description: 'Ownership analysis', defaultSize: { w: 12, h: 12 } },
];

const OwnershipTab = ({ symbol }) => {
  const DEFAULT_WIDGETS = [
    { id: 'ownership-tab-1', type: 'ownership-tab', symbol },
  ];

  const DEFAULT_LAYOUT = [
    { i: 'ownership-tab-1', x: 0, y: 0, w: 12, h: 12, minW: 6, minH: 8 },
  ];

  return (
    <WidgetDashboard
      dashboardId={`ownership-tab-${symbol}`}
      title="Ownership"
      subtitle={symbol}
      availableWidgets={AVAILABLE_WIDGETS}
      defaultWidgets={DEFAULT_WIDGETS}
      defaultLayout={DEFAULT_LAYOUT}
    />
  );
};

export default OwnershipTab;
