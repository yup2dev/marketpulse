/**
 * Ownership Tab - Static Grid Layout
 */
import { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Treemap
} from 'recharts';
import {
  Building2, Users, UserCheck, TrendingUp, TrendingDown,
  RefreshCw, Briefcase, Shield
} from 'lucide-react';
import { API_BASE } from '../../config/api';
import { formatNumber, formatCurrency } from '../../utils/widgetUtils';

const COLORS = {
  institutional: '#3b82f6',
  insiders: '#22c55e',
  retail: '#f59e0b',
};

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

const OwnershipTab = ({ symbol }) => {
  const [ownershipData, setOwnershipData] = useState(null);
  const [institutionalHolders, setInstitutionalHolders] = useState([]);
  const [insiderTransactions, setInsiderTransactions] = useState([]);
  const [insiderHolders, setInsiderHolders] = useState([]);
  const [insiderSummary, setInsiderSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    if (symbol) {
      loadOwnershipData();
    }
  }, [symbol]);

  const loadOwnershipData = async () => {
    setLoading(true);
    try {
      const [holdersRes, insiderRes, insiderHoldersRes] = await Promise.all([
        fetch(`${API_BASE}/stock/holders/${symbol}`),
        fetch(`${API_BASE}/stock/insider-trading/${symbol}`),
        fetch(`${API_BASE}/stock/insider-holders/${symbol}`)
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

      if (insiderHoldersRes.ok) {
        const data = await insiderHoldersRes.json();
        setInsiderHolders(data.holders || []);
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

  const renderNavButtons = () => (
    <div className="flex bg-gray-800/50 rounded-lg p-1 border border-gray-700">
      {[
        { id: 'overview', label: 'Overview', icon: Briefcase },
        { id: 'institutional', label: 'Institutional', icon: Building2 },
        { id: 'insiders', label: 'Insiders', icon: UserCheck },
      ].map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setActiveSection(id)}
          className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${
            activeSection === id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Icon size={16} />
          {label}
        </button>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="h-full">
        <div className="grid grid-cols-12 gap-1 h-[calc(100vh-180px)]">
          <div className="col-span-12 flex items-center justify-center">
            <RefreshCw className="animate-spin text-blue-500" size={32} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="grid grid-cols-12 gap-1 h-[calc(100vh-180px)]">
        {/* Header */}
        <div className="col-span-12 min-h-[60px]">
          <div className="bg-[#1a1a1a] rounded-lg p-4 border border-gray-800 h-full">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Users className="text-blue-500" size={24} />
                  Ownership Analysis - {symbol}
                </h3>
                <p className="text-gray-400 text-sm mt-1">Institutional, insider, and retail ownership breakdown</p>
              </div>
              <div className="flex items-center gap-3">
                {renderNavButtons()}
                <button
                  onClick={loadOwnershipData}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white text-sm"
                >
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Overview Section */}
        {activeSection === 'overview' && ownershipData && (
          <>
            {/* Summary Cards */}
            <div className="col-span-3 min-h-[120px]">
              <div className="bg-[#1a1a1a] rounded-lg p-5 border border-gray-800 h-full">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                  <Building2 size={16} />
                  Institutional
                </div>
                <div className="text-2xl font-bold text-blue-400">
                  {ownershipData.institutional_pct?.toFixed(1) || 0}%
                </div>
                <div className="text-xs text-gray-500 mt-1">of shares outstanding</div>
              </div>
            </div>
            <div className="col-span-3 min-h-[120px]">
              <div className="bg-[#1a1a1a] rounded-lg p-5 border border-gray-800 h-full">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                  <UserCheck size={16} />
                  Insider
                </div>
                <div className="text-2xl font-bold text-green-400">
                  {ownershipData.insider_pct?.toFixed(1) || 0}%
                </div>
                <div className="text-xs text-gray-500 mt-1">Officers & Directors</div>
              </div>
            </div>
            <div className="col-span-3 min-h-[120px]">
              <div className="bg-[#1a1a1a] rounded-lg p-5 border border-gray-800 h-full">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                  <Shield size={16} />
                  Short Interest
                </div>
                <div className="text-2xl font-bold text-red-400">
                  {ownershipData.short_interest?.toFixed(1) || 0}%
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Ratio: {ownershipData.short_ratio?.toFixed(1) || 0} days
                </div>
              </div>
            </div>
            <div className="col-span-3 min-h-[120px]">
              <div className="bg-[#1a1a1a] rounded-lg p-5 border border-gray-800 h-full">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                  <TrendingUp size={16} />
                  Float %
                </div>
                <div className="text-2xl font-bold text-white">
                  {ownershipData.shares_outstanding && ownershipData.float_shares
                    ? ((ownershipData.float_shares / ownershipData.shares_outstanding) * 100).toFixed(1)
                    : 0}%
                </div>
                <div className="text-xs text-gray-500 mt-1">of total shares</div>
              </div>
            </div>

            {/* Pie Chart */}
            <div className="col-span-6 min-h-[280px]">
              <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800 h-full">
                <h4 className="text-lg font-semibold text-white mb-4">Ownership Breakdown</h4>
                {ownershipBreakdown.length > 0 ? (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={ownershipBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                        >
                          {ownershipBreakdown.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                          formatter={(value) => `${value.toFixed(1)}%`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-48 text-gray-400">
                    No ownership data available
                  </div>
                )}
              </div>
            </div>

            {/* Share Statistics */}
            <div className="col-span-6 min-h-[280px]">
              <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800 h-full">
                <h4 className="text-lg font-semibold text-white mb-4">Share Statistics</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b border-gray-800">
                    <span className="text-gray-400">Shares Outstanding</span>
                    <span className="text-white font-medium">{formatNumber(ownershipData.shares_outstanding)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-gray-800">
                    <span className="text-gray-400">Float</span>
                    <span className="text-white font-medium">{formatNumber(ownershipData.float_shares)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-gray-800">
                    <span className="text-gray-400">Institutional Float %</span>
                    <span className="text-white font-medium">
                      {ownershipData.institutional_float_pct?.toFixed(1) || 0}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3">
                    <span className="text-gray-400">Short % of Float</span>
                    <span className="text-red-400 font-medium">{ownershipData.short_interest?.toFixed(1) || 0}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Holders */}
            {institutionalHolders.length > 0 && (
              <div className="col-span-12 min-h-[200px]">
                <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800 h-full">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-white">Top Institutional Holders</h4>
                    <button
                      onClick={() => setActiveSection('institutional')}
                      className="text-blue-400 text-sm hover:text-blue-300 transition-colors"
                    >
                      View All
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-3 px-4 text-gray-400 font-medium">Institution</th>
                          <th className="text-right py-3 px-4 text-gray-400 font-medium">Shares</th>
                          <th className="text-right py-3 px-4 text-gray-400 font-medium">Value</th>
                          <th className="text-right py-3 px-4 text-gray-400 font-medium">% Held</th>
                          <th className="text-right py-3 px-4 text-gray-400 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {institutionalHolders.slice(0, 5).map((holder, idx) => (
                          <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/30">
                            <td className="py-3 px-4 text-white font-medium">{holder.name}</td>
                            <td className="text-right py-3 px-4 text-gray-300">{formatNumber(holder.shares)}</td>
                            <td className="text-right py-3 px-4 text-white">{formatCurrency(holder.value)}</td>
                            <td className="text-right py-3 px-4 text-blue-400 font-medium">{holder.pct_held?.toFixed(2)}%</td>
                            <td className="text-right py-3 px-4 text-gray-400">{holder.date_reported}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Institutional Section */}
        {activeSection === 'institutional' && (
          <div className="col-span-12 min-h-[400px]">
            <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800 h-full">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Building2 className="text-blue-500" size={20} />
                Institutional Holders ({institutionalHolders.length})
              </h4>
              {institutionalHolders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">#</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Institution</th>
                        <th className="text-right py-3 px-4 text-gray-400 font-medium">Shares</th>
                        <th className="text-right py-3 px-4 text-gray-400 font-medium">Value</th>
                        <th className="text-right py-3 px-4 text-gray-400 font-medium">% Held</th>
                        <th className="text-right py-3 px-4 text-gray-400 font-medium">Date Reported</th>
                      </tr>
                    </thead>
                    <tbody>
                      {institutionalHolders.map((holder, idx) => (
                        <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/30">
                          <td className="py-3 px-4 text-gray-500">{idx + 1}</td>
                          <td className="py-3 px-4 text-white font-medium">{holder.name}</td>
                          <td className="text-right py-3 px-4 text-gray-300">{formatNumber(holder.shares)}</td>
                          <td className="text-right py-3 px-4 text-white">{formatCurrency(holder.value)}</td>
                          <td className="text-right py-3 px-4 text-blue-400 font-medium">{holder.pct_held?.toFixed(2)}%</td>
                          <td className="text-right py-3 px-4 text-gray-400">{holder.date_reported}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">No institutional holder data available</div>
              )}
            </div>
          </div>
        )}

        {/* Insiders Section */}
        {activeSection === 'insiders' && (
          <>
            {insiderSummary && (
              <>
                <div className="col-span-3 min-h-[120px]">
                  <div className="bg-[#1a1a1a] rounded-lg p-5 border border-gray-800 h-full">
                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                      <TrendingUp size={16} className="text-green-400" />
                      Total Buys
                    </div>
                    <div className="text-2xl font-bold text-green-400">{insiderSummary.buy_count || 0}</div>
                    <div className="text-xs text-gray-500 mt-1">{formatCurrency(insiderSummary.buy_value)}</div>
                  </div>
                </div>
                <div className="col-span-3 min-h-[120px]">
                  <div className="bg-[#1a1a1a] rounded-lg p-5 border border-gray-800 h-full">
                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                      <TrendingDown size={16} className="text-red-400" />
                      Total Sells
                    </div>
                    <div className="text-2xl font-bold text-red-400">{insiderSummary.sell_count || 0}</div>
                    <div className="text-xs text-gray-500 mt-1">{formatCurrency(insiderSummary.sell_value)}</div>
                  </div>
                </div>
                <div className="col-span-3 min-h-[120px]">
                  <div className="bg-[#1a1a1a] rounded-lg p-5 border border-gray-800 h-full">
                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                      <Users size={16} />
                      Net Activity
                    </div>
                    <div className={`text-2xl font-bold ${(insiderSummary.net_value || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(Math.abs(insiderSummary.net_value || 0))}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{(insiderSummary.net_value || 0) >= 0 ? 'Net Buying' : 'Net Selling'}</div>
                  </div>
                </div>
                <div className="col-span-3 min-h-[120px]">
                  <div className="bg-[#1a1a1a] rounded-lg p-5 border border-gray-800 h-full">
                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                      <UserCheck size={16} />
                      Insider Holders
                    </div>
                    <div className="text-2xl font-bold text-white">{insiderHolders.length}</div>
                    <div className="text-xs text-gray-500 mt-1">Officers & Directors</div>
                  </div>
                </div>
              </>
            )}

            {/* Insider Transactions */}
            <div className="col-span-12 min-h-[300px]">
              <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800 h-full">
                <h4 className="text-lg font-semibold text-white mb-4">Recent Insider Transactions</h4>
                {insiderTransactions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-3 px-4 text-gray-400 font-medium">Date</th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium">Name</th>
                          <th className="text-left py-3 px-4 text-gray-400 font-medium">Title</th>
                          <th className="text-center py-3 px-4 text-gray-400 font-medium">Type</th>
                          <th className="text-right py-3 px-4 text-gray-400 font-medium">Shares</th>
                          <th className="text-right py-3 px-4 text-gray-400 font-medium">Price</th>
                          <th className="text-right py-3 px-4 text-gray-400 font-medium">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {insiderTransactions.slice(0, 10).map((tx, idx) => (
                          <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/30">
                            <td className="py-3 px-4 text-gray-400">{tx.transaction_date}</td>
                            <td className="py-3 px-4 text-white font-medium">{tx.insider_name}</td>
                            <td className="py-3 px-4 text-gray-400">{tx.insider_title}</td>
                            <td className="text-center py-3 px-4">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                tx.acquisition_or_disposition === 'A' ? 'bg-green-500/20 text-green-400' :
                                tx.acquisition_or_disposition === 'D' ? 'bg-red-500/20 text-red-400' :
                                'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                {tx.acquisition_or_disposition === 'A' ? 'Buy' : tx.acquisition_or_disposition === 'D' ? 'Sell' : tx.transaction_type}
                              </span>
                            </td>
                            <td className="text-right py-3 px-4 text-gray-300">{formatNumber(tx.shares_traded)}</td>
                            <td className="text-right py-3 px-4 text-white">${tx.price_per_share?.toFixed(2) || '-'}</td>
                            <td className="text-right py-3 px-4 text-white font-medium">{formatCurrency(tx.transaction_value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">No insider transaction data available</div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Empty State */}
        {!ownershipData && !loading && (
          <div className="col-span-12 min-h-[200px]">
            <div className="bg-[#1a1a1a] rounded-lg p-12 text-center border border-gray-800 h-full flex flex-col items-center justify-center">
              <Users className="mb-4 text-gray-600" size={48} />
              <div className="text-gray-400 text-lg">No ownership data available for {symbol}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnershipTab;
