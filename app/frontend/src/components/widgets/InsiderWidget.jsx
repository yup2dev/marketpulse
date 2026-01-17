/**
 * InsiderWidget - Displays insider trading activity
 */
import { useState, useEffect } from 'react';
import { UserCheck, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import {
  WidgetHeader,
  LoadingSpinner,
  NoDataState,
  formatNumber,
  formatPrice,
  API_BASE,
  WIDGET_STYLES,
} from './common';

const InsiderWidget = ({ symbol, onRemove }) => {
  const [insider, setInsider] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (symbol) {
      loadData();
    }
  }, [symbol]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/insider-trading/${symbol}`);
      if (res.ok) {
        setInsider(await res.json());
      }
    } catch (error) {
      console.error('Error loading insider data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  };

  const getTransactionIcon = (type) => {
    if (type === 'A') return <ArrowUpCircle size={16} className="text-green-400" />;
    if (type === 'D') return <ArrowDownCircle size={16} className="text-red-400" />;
    return null;
  };

  const getTransactionLabel = (type) => {
    if (type === 'A') return 'Buy';
    if (type === 'D') return 'Sell';
    return type;
  };

  return (
    <div className={WIDGET_STYLES.container}>
      <WidgetHeader
        icon={UserCheck}
        iconColor="text-purple-400"
        title={`${symbol} - Insider`}
        loading={loading}
        onRefresh={loadData}
        onRemove={onRemove}
      />

      <div className={`${WIDGET_STYLES.content} p-3`}>
        {loading ? (
          <LoadingSpinner color="border-purple-500" />
        ) : insider ? (
          <div className="space-y-4">
            {/* Summary Cards */}
            {insider.summary && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp size={16} className="text-green-400" />
                    <span className="text-xs text-green-400 font-medium">Buys</span>
                  </div>
                  <div className="text-xl font-bold text-green-400">
                    {insider.summary.buy_count || 0}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatNumber(insider.summary.buy_value || 0)}
                  </div>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown size={16} className="text-red-400" />
                    <span className="text-xs text-red-400 font-medium">Sells</span>
                  </div>
                  <div className="text-xl font-bold text-red-400">
                    {insider.summary.sell_count || 0}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatNumber(insider.summary.sell_value || 0)}
                  </div>
                </div>
              </div>
            )}

            {/* Net Activity */}
            {insider.summary?.net_value !== undefined && (
              <div className={`rounded-lg p-3 ${
                insider.summary.net_value >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
              }`}>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Net Activity</span>
                  <span className={`font-bold text-lg ${
                    insider.summary.net_value >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {insider.summary.net_value >= 0 ? '+' : ''}{formatNumber(insider.summary.net_value)}
                  </span>
                </div>
              </div>
            )}

            {/* Recent Transactions */}
            {insider.transactions?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Recent Transactions</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {insider.transactions.slice(0, 10).map((tx, idx) => (
                    <div
                      key={idx}
                      className="bg-gray-800/30 rounded-lg p-2 hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {getTransactionIcon(tx.acquisition_or_disposition)}
                            <span className="text-white text-sm font-medium truncate">
                              {tx.insider_name || 'Unknown'}
                            </span>
                          </div>
                          {tx.insider_title && (
                            <div className="text-xs text-gray-500 mt-0.5 truncate">
                              {tx.insider_title}
                            </div>
                          )}
                        </div>
                        <div className="text-right ml-2">
                          <div className={`text-sm font-medium ${
                            tx.acquisition_or_disposition === 'A' ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {getTransactionLabel(tx.acquisition_or_disposition)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDate(tx.transaction_date)}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between mt-2 text-xs">
                        <span className="text-gray-400">
                          {formatNumber(tx.shares_traded)} shares
                        </span>
                        <span className="text-gray-400">
                          @ {formatPrice(tx.price_per_share)}
                        </span>
                        <span className="text-white font-medium">
                          {formatNumber(tx.transaction_value)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(!insider.transactions || insider.transactions.length === 0) && (
              <div className="text-center text-gray-500 py-4 text-sm">
                No recent insider transactions
              </div>
            )}
          </div>
        ) : (
          <NoDataState message="No insider data available" />
        )}
      </div>
    </div>
  );
};

export default InsiderWidget;
