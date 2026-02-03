/**
 * Ownership Tab - Data-Focused Layout with 3 Separate Widgets
 * Standard Controls: Close, Refresh, Symbol Selector, Corner Resize
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Building2, Users, UserCheck, TrendingUp, TrendingDown,
  RefreshCw, Shield, ArrowUp, ArrowDown
} from 'lucide-react';
import { API_BASE } from '../../config/api';
import { WidgetHeader, AddWidgetPlaceholder, ResizeHandle } from '../common/WidgetHeader';

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

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-';
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
};

// Resizable Widget Wrapper
function ResizableWidgetWrapper({ children, minWidth = 300, minHeight = 200, defaultHeight = 400 }) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 'auto', height: defaultHeight });

  const handleResize = useCallback((deltaX, deltaY) => {
    setSize(prev => ({
      width: prev.width === 'auto' ? 'auto' : Math.max(minWidth, prev.width + deltaX),
      height: Math.max(minHeight, (prev.height || defaultHeight) + deltaY)
    }));
  }, [minWidth, minHeight, defaultHeight]);

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{
        height: size.height === 'auto' ? 'auto' : `${size.height}px`,
        minHeight: `${minHeight}px`,
      }}
    >
      {children}
      <ResizeHandle onResize={handleResize} />
    </div>
  );
}

// Overview Widget Component
function OwnershipOverviewWidget({ ownershipData, loading, symbol, onSymbolChange, onRefresh, onClose }) {
  const ownershipBreakdown = ownershipData ? [
    { name: 'Institutional', value: ownershipData.institutional_pct || 0, color: COLORS.institutional },
    { name: 'Insider', value: ownershipData.insider_pct || 0, color: COLORS.insiders },
    { name: 'Retail/Other', value: Math.max(0, 100 - (ownershipData.institutional_pct || 0) - (ownershipData.insider_pct || 0)), color: COLORS.retail },
  ].filter(item => item.value > 0) : [];

  return (
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden h-full flex flex-col">
      <WidgetHeader
        title="Ownership Overview"
        icon={Users}
        iconColor="text-blue-400"
        symbol={symbol}
        onSymbolChange={onSymbolChange}
        onRefresh={onRefresh}
        onClose={onClose}
        loading={loading}
      />
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : ownershipData ? (
          <>
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

            {/* Pie Chart & Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800/30 rounded-lg p-4">
                <h4 className="text-xs text-gray-400 mb-3">Ownership Breakdown</h4>
                {ownershipBreakdown.length > 0 ? (
                  <div className="h-[140px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={ownershipBreakdown} cx="50%" cy="50%" innerRadius={35} outerRadius={55}
                          paddingAngle={2} dataKey="value">
                          {ownershipBreakdown.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', fontSize: '12px' }}
                          formatter={(value) => `${value.toFixed(1)}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[140px] text-gray-500 text-sm">No data</div>
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
          </>
        ) : (
          <div className="text-center text-gray-500 py-8">No ownership data available</div>
        )}
      </div>
    </div>
  );
}

// Institutional Widget Component
function InstitutionalWidget({ institutionalHolders, ownershipData, loading, symbol, onSymbolChange, onRefresh, onClose }) {
  const topHolders = institutionalHolders.slice(0, 10);
  const chartData = topHolders.slice(0, 5).map(h => ({
    name: h.name?.length > 15 ? h.name.substring(0, 15) + '...' : h.name,
    pct: h.pct_held || 0
  }));

  return (
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden h-full flex flex-col">
      <WidgetHeader
        title="Institutional Holders"
        icon={Building2}
        iconColor="text-blue-400"
        symbol={symbol}
        onSymbolChange={onSymbolChange}
        onRefresh={onRefresh}
        onClose={onClose}
        loading={loading}
      />

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : (
          <>
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
            {chartData.length > 0 && (
              <div className="bg-gray-800/30 rounded-lg p-4 mb-4">
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
            )}

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
          </>
        )}
      </div>
    </div>
  );
}

// Insider Widget Component
function InsiderWidget({ insiderTransactions, insiderSummary, loading, symbol, onSymbolChange, onRefresh, onClose }) {
  return (
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden h-full flex flex-col">
      <WidgetHeader
        title="Insider Activity"
        icon={UserCheck}
        iconColor="text-green-400"
        symbol={symbol}
        onSymbolChange={onSymbolChange}
        onRefresh={onRefresh}
        onClose={onClose}
        loading={loading}
      />

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            {insiderSummary && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-gray-800/30 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
                    <ArrowUp size={12} className="text-green-400" />Total Buys
                  </div>
                  <div className="text-xl font-bold text-green-400">{insiderSummary.buy_count || 0}</div>
                  <div className="text-xs text-gray-500">{formatCurrency(insiderSummary.buy_value)}</div>
                </div>
                <div className="bg-gray-800/30 rounded-lg p-3">
                  <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
                    <ArrowDown size={12} className="text-red-400" />Total Sells
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

            {/* Net Activity Indicator */}
            {insiderSummary && (
              <div className="bg-gray-800/30 rounded-lg p-4 mb-4">
                <h4 className="text-xs text-gray-400 mb-3">Insider Sentiment</h4>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="h-3 bg-gray-700 rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-green-400"
                        style={{ width: `${insiderSummary.buy_count > 0 || insiderSummary.sell_count > 0 ? (insiderSummary.buy_count / (insiderSummary.buy_count + insiderSummary.sell_count) * 100) : 50}%` }}
                      />
                      <div
                        className="h-full bg-red-400"
                        style={{ width: `${insiderSummary.buy_count > 0 || insiderSummary.sell_count > 0 ? (insiderSummary.sell_count / (insiderSummary.buy_count + insiderSummary.sell_count) * 100) : 50}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                      <span>Buying</span>
                      <span>Selling</span>
                    </div>
                  </div>
                  <div className={`text-center px-3 py-2 rounded-lg ${(insiderSummary.net_value || 0) >= 0 ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                    <div className={`text-lg font-bold ${(insiderSummary.net_value || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {(insiderSummary.net_value || 0) >= 0 ? 'Bullish' : 'Bearish'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Transactions Table */}
            <div className="bg-gray-800/30 rounded-lg overflow-hidden">
              <div className="p-3 border-b border-gray-700">
                <h4 className="text-xs text-gray-400">Recent Transactions</h4>
              </div>
              <table className="w-full">
                <thead className="bg-[#0a0a0f]">
                  <tr className="text-[10px] text-gray-500">
                    <th className="py-2 px-3 text-left font-medium">Date</th>
                    <th className="py-2 px-3 text-left font-medium">Name</th>
                    <th className="py-2 px-3 text-center font-medium">Type</th>
                    <th className="py-2 px-3 text-right font-medium">Shares</th>
                    <th className="py-2 px-3 text-right font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {insiderTransactions.length > 0 ? insiderTransactions.slice(0, 10).map((tx, idx) => (
                    <tr key={idx} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                      <td className="py-2 px-3 text-xs text-gray-400">{tx.transaction_date}</td>
                      <td className="py-2 px-3 text-xs text-white">{tx.insider_name}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          tx.acquisition_or_disposition === 'A' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {tx.acquisition_or_disposition === 'A' ? 'Buy' : 'Sell'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-xs text-gray-300">{formatNumber(tx.shares_traded)}</td>
                      <td className="py-2 px-3 text-right text-xs text-white">{formatCurrency(tx.transaction_value)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500 text-sm">No insider transaction data</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Main OwnershipTab Component
export default function OwnershipTab({ symbol: initialSymbol }) {
  const [symbol, setSymbol] = useState(initialSymbol || 'AAPL');
  const [ownershipData, setOwnershipData] = useState(null);
  const [institutionalHolders, setInstitutionalHolders] = useState([]);
  const [insiderTransactions, setInsiderTransactions] = useState([]);
  const [insiderSummary, setInsiderSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Widget visibility state
  const [visibleWidgets, setVisibleWidgets] = useState({
    overview: true,
    institutional: true,
    insider: true
  });

  useEffect(() => {
    if (symbol) loadData();
  }, [symbol]);

  const loadData = async () => {
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

  const handleSymbolChange = (newSymbol) => {
    setSymbol(newSymbol);
  };

  const handleCloseWidget = (widgetId) => {
    setVisibleWidgets(prev => ({ ...prev, [widgetId]: false }));
  };

  const handleAddWidget = (widgetId) => {
    setVisibleWidgets(prev => ({ ...prev, [widgetId]: true }));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Ownership Analysis - {symbol}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh All
          </button>
        </div>
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Overview Widget - Full Width */}
        <div className="col-span-12">
          {visibleWidgets.overview ? (
            <ResizableWidgetWrapper minHeight={300} defaultHeight={380}>
              <OwnershipOverviewWidget
                ownershipData={ownershipData}
                loading={loading}
                symbol={symbol}
                onSymbolChange={handleSymbolChange}
                onRefresh={loadData}
                onClose={() => handleCloseWidget('overview')}
              />
            </ResizableWidgetWrapper>
          ) : (
            <AddWidgetPlaceholder onAdd={() => handleAddWidget('overview')} widgetType="overview" />
          )}
        </div>

        {/* Institutional Widget - Half Width */}
        <div className="col-span-6">
          {visibleWidgets.institutional ? (
            <ResizableWidgetWrapper minHeight={300} defaultHeight={500}>
              <InstitutionalWidget
                institutionalHolders={institutionalHolders}
                ownershipData={ownershipData}
                loading={loading}
                symbol={symbol}
                onSymbolChange={handleSymbolChange}
                onRefresh={loadData}
                onClose={() => handleCloseWidget('institutional')}
              />
            </ResizableWidgetWrapper>
          ) : (
            <AddWidgetPlaceholder onAdd={() => handleAddWidget('institutional')} widgetType="institutional" />
          )}
        </div>

        {/* Insider Widget - Half Width */}
        <div className="col-span-6">
          {visibleWidgets.insider ? (
            <ResizableWidgetWrapper minHeight={300} defaultHeight={500}>
              <InsiderWidget
                insiderTransactions={insiderTransactions}
                insiderSummary={insiderSummary}
                loading={loading}
                symbol={symbol}
                onSymbolChange={handleSymbolChange}
                onRefresh={loadData}
                onClose={() => handleCloseWidget('insider')}
              />
            </ResizableWidgetWrapper>
          ) : (
            <AddWidgetPlaceholder onAdd={() => handleAddWidget('insider')} widgetType="insider" />
          )}
        </div>
      </div>
    </div>
  );
}

// Export for WidgetDashboard compatibility
export function OwnershipTabWidget({ symbol, ...props }) {
  return <OwnershipTab symbol={symbol} {...props} />;
}
