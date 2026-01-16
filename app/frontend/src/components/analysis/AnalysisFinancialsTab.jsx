/**
 * Analysis 재무제표 탭
 */
import { useState, useEffect } from 'react';
import { FileText, TrendingUp, TrendingDown, Table2, BarChart3 } from 'lucide-react';
import { useStockContext } from './AnalysisDashboard';
import { API_BASE } from '../../config/api';
import { formatNumber, formatCurrency } from '../../utils/widgetUtils';

const FINANCIAL_TABS = [
  { id: 'income', name: '손익계산서' },
  { id: 'balance', name: '재무상태표' },
  { id: 'cashflow', name: '현금흐름표' }
];

export default function AnalysisFinancialsTab() {
  const { symbol } = useStockContext();
  const [financials, setFinancials] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFinTab, setActiveFinTab] = useState('income');
  const [period, setPeriod] = useState('quarterly');
  const [viewMode, setViewMode] = useState('table');

  useEffect(() => {
    loadFinancials();
  }, [symbol, period]);

  const loadFinancials = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/stock/financials/${symbol}?freq=${period}&limit=4`);
      if (res.ok) {
        setFinancials(await res.json());
      }
    } catch (error) {
      console.error('Error loading financials:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderFinancialTable = (data, type) => {
    if (!data || data.length === 0) {
      return (
        <div className="text-center text-gray-500 py-12">
          데이터가 없습니다
        </div>
      );
    }

    // Get all unique keys from the data
    const allKeys = [...new Set(data.flatMap(item => Object.keys(item)))];
    const metricKeys = allKeys.filter(key =>
      !['date', 'period', 'symbol', 'reportedCurrency', 'cik', 'fillingDate', 'acceptedDate', 'calendarYear', 'link', 'finalLink'].includes(key)
    );

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 text-gray-400 font-medium sticky left-0 bg-[#1a1f2e]">항목</th>
              {data.map((item, idx) => (
                <th key={idx} className="text-right py-3 px-4 text-gray-400 font-medium min-w-[120px]">
                  {item.date || item.calendarYear}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metricKeys.slice(0, 20).map((key) => (
              <tr key={key} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="py-3 px-4 text-gray-300 sticky left-0 bg-[#1a1f2e]">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </td>
                {data.map((item, idx) => {
                  const value = item[key];
                  const prevValue = data[idx + 1]?.[key];
                  const change = prevValue ? ((value - prevValue) / Math.abs(prevValue)) * 100 : 0;

                  return (
                    <td key={idx} className="text-right py-3 px-4">
                      <div className="flex flex-col items-end">
                        <span className="text-white font-medium">
                          {typeof value === 'number' ? formatNumber(value) : value || '-'}
                        </span>
                        {change !== 0 && !isNaN(change) && (
                          <span className={`text-xs flex items-center gap-1 ${change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {change > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                            {Math.abs(change).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const getCurrentData = () => {
    if (!financials) return [];
    switch (activeFinTab) {
      case 'income':
        return financials.income_statement || [];
      case 'balance':
        return financials.balance_sheet || [];
      case 'cashflow':
        return financials.cash_flow || [];
      default:
        return [];
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="text-purple-500" size={28} />
            <div>
              <h2 className="text-xl font-bold text-white">재무제표</h2>
              <p className="text-gray-400 text-sm mt-0.5">{symbol} - 재무 데이터 분석</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Period Toggle */}
            <div className="flex bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setPeriod('quarterly')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  period === 'quarterly' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                분기
              </button>
              <button
                onClick={() => setPeriod('annual')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  period === 'annual' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                연간
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'table' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Table2 size={16} />
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'chart' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <BarChart3 size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Financial Type Tabs */}
        <div className="flex gap-2">
          {FINANCIAL_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFinTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFinTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-[#1a1f2e] rounded-xl border border-gray-700 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            renderFinancialTable(getCurrentData(), activeFinTab)
          )}
        </div>
      </div>
    </div>
  );
}
