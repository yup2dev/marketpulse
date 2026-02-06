/**
 * Ownership Insider Widget - Insider trading activity
 */
import { useState, useEffect, useCallback } from 'react';
import { UserCheck, ArrowUp, ArrowDown, Users } from 'lucide-react';
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

export default function OwnershipInsiderWidget({ symbol, onRemove }) {
  const [insiderTransactions, setInsiderTransactions] = useState([]);
  const [insiderSummary, setInsiderSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('chart');

  const loadData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/insider-trading/${symbol}`);
      if (res.ok) {
        const data = await res.json();
        setInsiderTransactions(data.transactions || []);
        setInsiderSummary(data.summary || null);
      }
    } catch (error) {
      console.error('Error loading insider activity:', error);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const renderChart = () => (
    <div className="h-full p-3">
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

      {/* Insider Sentiment Bar */}
      {insiderSummary && (
        <div className="bg-gray-800/30 rounded-lg p-4">
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

      {!insiderSummary && (
        <div className="flex items-center justify-center h-full text-gray-500">No insider data</div>
      )}
    </div>
  );

  const renderTable = () => (
    <div className="h-full p-3">
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
    </div>
  );

  return (
    <BaseWidget
      title={`${symbol} - Insider Activity`}
      icon={UserCheck}
      iconColor="text-green-400"
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
