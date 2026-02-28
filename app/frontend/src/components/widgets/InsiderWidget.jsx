/**
 * InsiderWidget - Displays insider trading activity using BaseWidget
 */
import { useState, useEffect, useCallback } from 'react';
import { UserCheck, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import BaseWidget from './common/BaseWidget';
import { formatNumber, formatPrice, API_BASE } from './constants';

const InsiderWidget = ({ symbol, onRemove }) => {
  const [insider, setInsider] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('table');

  const loadData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/insider-trading/${symbol}`);
      if (res.ok) setInsider(await res.json());
    } catch (error) {
      console.error('Error loading insider data:', error);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  };

  const getTransactionIcon = (type) => {
    if (type === 'A') return <ArrowUpCircle size={14} className="text-green-400" />;
    if (type === 'D') return <ArrowDownCircle size={14} className="text-red-400" />;
    return null;
  };

  const getTransactionLabel = (type) => {
    if (type === 'A') return 'Buy';
    if (type === 'D') return 'Sell';
    return type;
  };

  const getChartData = () => {
    if (!insider?.summary) return [];
    return [
      { name: 'Buys', value: insider.summary.buy_value || 0, count: insider.summary.buy_count || 0 },
      { name: 'Sells', value: Math.abs(insider.summary.sell_value || 0), count: insider.summary.sell_count || 0 },
    ];
  };

  const renderChart = () => {
    const chartData = getChartData();
    if (chartData.length === 0 || (chartData[0].value === 0 && chartData[1].value === 0)) {
      return <div className="flex items-center justify-center h-full text-gray-500">No data</div>;
    }

    return (
      <div className="h-full flex flex-col">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-green-500/10 border border-green-500/20 rounded p-2">
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp size={12} className="text-green-400" />
              <span className="text-[10px] text-green-400 font-medium">Buys</span>
            </div>
            <div className="text-lg font-bold text-green-400">{insider?.summary?.buy_count || 0}</div>
            <div className="text-[10px] text-gray-500">{formatNumber(insider?.summary?.buy_value || 0)}</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded p-2">
            <div className="flex items-center gap-1 mb-1">
              <TrendingDown size={12} className="text-red-400" />
              <span className="text-[10px] text-red-400 font-medium">Sells</span>
            </div>
            <div className="text-lg font-bold text-red-400">{insider?.summary?.sell_count || 0}</div>
            <div className="text-[10px] text-gray-500">{formatNumber(insider?.summary?.sell_value || 0)}</div>
          </div>
        </div>

        {/* Net Activity */}
        {insider?.summary?.net_value !== undefined && (
          <div className={`rounded p-2 mb-3 ${insider.summary.net_value >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-xs">Net Activity</span>
              <span className={`font-bold text-sm ${insider.summary.net_value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {insider.summary.net_value >= 0 ? '+' : ''}{formatNumber(insider.summary.net_value)}
              </span>
            </div>
          </div>
        )}

        {/* Bar Chart */}
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} tickFormatter={(v) => formatNumber(v)} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1f', border: '1px solid #374151', borderRadius: '8px' }} formatter={(v) => formatNumber(v)} />
              <Bar dataKey="value" name="Value">
                {chartData.map((entry, index) => (
                  <rect key={index} fill={index === 0 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderTable = () => {
    if (!insider) return <div className="flex items-center justify-center h-full text-gray-500">No data</div>;

    return (
      <div className="space-y-3 overflow-auto h-full">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-green-500/10 border border-green-500/20 rounded p-2">
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp size={12} className="text-green-400" />
              <span className="text-[10px] text-green-400 font-medium">Buys</span>
            </div>
            <div className="text-lg font-bold text-green-400">{insider.summary?.buy_count || 0}</div>
            <div className="text-[10px] text-gray-500">{formatNumber(insider.summary?.buy_value || 0)}</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded p-2">
            <div className="flex items-center gap-1 mb-1">
              <TrendingDown size={12} className="text-red-400" />
              <span className="text-[10px] text-red-400 font-medium">Sells</span>
            </div>
            <div className="text-lg font-bold text-red-400">{insider.summary?.sell_count || 0}</div>
            <div className="text-[10px] text-gray-500">{formatNumber(insider.summary?.sell_value || 0)}</div>
          </div>
        </div>

        {/* Net Activity */}
        {insider.summary?.net_value !== undefined && (
          <div className={`rounded p-2 ${insider.summary.net_value >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-xs">Net Activity</span>
              <span className={`font-bold text-sm ${insider.summary.net_value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {insider.summary.net_value >= 0 ? '+' : ''}{formatNumber(insider.summary.net_value)}
              </span>
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        {insider.transactions?.length > 0 && (
          <div>
            <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-2">Recent Transactions</h4>
            <div className="space-y-1.5">
              {insider.transactions.slice(0, 8).map((tx, idx) => (
                <div key={idx} className="bg-gray-800/30 rounded p-2 hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {getTransactionIcon(tx.acquisition_or_disposition)}
                        <span className="text-white text-xs font-medium truncate">{tx.insider_name || 'Unknown'}</span>
                      </div>
                      {tx.insider_title && (
                        <div className="text-[10px] text-gray-500 truncate mt-0.5">{tx.insider_title}</div>
                      )}
                    </div>
                    <div className="text-right ml-2">
                      <div className={`text-xs font-medium ${tx.acquisition_or_disposition === 'A' ? 'text-green-400' : 'text-red-400'}`}>
                        {getTransactionLabel(tx.acquisition_or_disposition)}
                      </div>
                      <div className="text-[10px] text-gray-500">{formatDate(tx.transaction_date)}</div>
                    </div>
                  </div>
                  <div className="flex justify-between mt-1.5 text-[10px]">
                    <span className="text-gray-400">{formatNumber(tx.shares_traded)} shares</span>
                    <span className="text-gray-400">@ {formatPrice(tx.price_per_share)}</span>
                    <span className="text-white font-medium">{formatNumber(tx.transaction_value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(!insider.transactions || insider.transactions.length === 0) && (
          <div className="text-center text-gray-500 py-4 text-xs">No recent transactions</div>
        )}
      </div>
    );
  };

  const getExportData = () => {
    const transactions = insider?.transactions || [];
    return {
      columns: [
        { key: 'date',           header: 'Date'        },
        { key: 'name',           header: 'Insider'     },
        { key: 'title',          header: 'Title'       },
        { key: 'transactionType', header: 'Type',      exportValue: r => getTransactionLabel(r.transactionType) },
        { key: 'shares',         header: 'Shares',     exportValue: r => r.shares?.toLocaleString() ?? '' },
        { key: 'price',          header: 'Price ($)',  exportValue: r => r.price?.toFixed(2) ?? '' },
        { key: 'value',          header: 'Value ($)',  exportValue: r => r.value ? formatNumber(r.value) : '' },
      ],
      rows: transactions,
    };
  };

  return (
    <BaseWidget
      title={`${symbol} - Insider`}
      icon={UserCheck}
      iconColor="text-purple-400"
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      showPeriodSelector={false}
      symbol={symbol}
      exportData={insider ? getExportData : undefined}
    >
      <div className="h-full p-3">
        {viewMode === 'chart' ? renderChart() : renderTable()}
      </div>
    </BaseWidget>
  );
};

export default InsiderWidget;
