/**
 * Analysis 재무제표 탭 - WidgetDashboard 기반 동적 레이아웃
 */
import { useState, useEffect } from 'react';
import { FileText, TrendingUp, TrendingDown, Table2, BarChart3, GripVertical } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useStockContext } from './AnalysisDashboard';
import WidgetDashboard from '../WidgetDashboard';
import { API_BASE } from '../../config/api';
import { formatNumber } from '../../utils/widgetUtils';

const FINANCIAL_TABS = [
  { id: 'income', name: '손익계산서' },
  { id: 'balance', name: '재무상태표' },
  { id: 'cashflow', name: '현금흐름표' },
  { id: 'margins', name: 'Margin 분석' }
];

const METRIC_LABELS = {
  revenue: '매출액', cost_of_revenue: '매출원가', gross_profit: '매출총이익',
  operating_expenses: '영업비용', operating_income: '영업이익', net_income: '순이익',
  ebitda: 'EBITDA', basic_eps: '기본 EPS', diluted_eps: '희석 EPS',
  total_assets: '총자산', current_assets: '유동자산', cash: '현금',
  total_liabilities: '총부채', current_liabilities: '유동부채', total_equity: '자본총계',
  total_debt: '총차입금', operating_cash_flow: '영업현금흐름', investing_cash_flow: '투자현금흐름',
  financing_cash_flow: '재무현금흐름', free_cash_flow: '잉여현금흐름', capital_expenditure: '자본적지출'
};

const CHART_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

function FinancialsContentWidget({ symbol, onRemove }) {
  const [financials, setFinancials] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFinTab, setActiveFinTab] = useState('income');
  const [period, setPeriod] = useState('quarterly');
  const [viewMode, setViewMode] = useState('table');

  useEffect(() => {
    if (symbol) loadFinancials();
  }, [symbol, period]);

  const loadFinancials = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/stock/financials/${symbol}?freq=${period}&limit=8`);
      if (res.ok) setFinancials(await res.json());
    } catch (error) {
      console.error('Error loading financials:', error);
    } finally {
      setLoading(false);
    }
  };

  const getChartData = () => {
    if (!financials?.periods) return [];
    return financials.periods.map(p => {
      const inc = p.income_statement || {};
      const bal = p.balance_sheet || {};
      const cf = p.cash_flow || {};
      const grossMargin = inc.revenue && inc.gross_profit ? (inc.gross_profit / inc.revenue * 100) : 0;
      const operatingMargin = inc.revenue && inc.operating_income ? (inc.operating_income / inc.revenue * 100) : 0;
      const netMargin = inc.revenue && inc.net_income ? (inc.net_income / inc.revenue * 100) : 0;
      return {
        date: p.date?.substring(0, 7) || 'N/A',
        revenue: inc.revenue, grossProfit: inc.gross_profit, operatingIncome: inc.operating_income,
        netIncome: inc.net_income, ebitda: inc.ebitda, totalAssets: bal.total_assets,
        totalLiabilities: bal.total_liabilities, totalEquity: bal.total_equity, cash: bal.cash,
        totalDebt: bal.total_debt, operatingCashFlow: cf.operating_cash_flow, freeCashFlow: cf.free_cash_flow,
        grossMargin, operatingMargin, netMargin
      };
    }).reverse();
  };

  const renderChartView = () => {
    const chartData = getChartData();
    if (chartData.length === 0) return <div className="text-center text-gray-500 py-12">데이터가 없습니다</div>;

    const formatYAxis = (value) => {
      if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
      if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
      if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
      return value?.toFixed(1) || '0';
    };

    if (activeFinTab === 'margins') {
      return (
        <div className="p-4 h-full">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} />
              <YAxis stroke="#9ca3af" fontSize={10} tickFormatter={(v) => `${v.toFixed(1)}%`} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
              <Legend />
              <Line type="monotone" dataKey="grossMargin" name="매출총이익률" stroke="#10b981" strokeWidth={2} />
              <Line type="monotone" dataKey="operatingMargin" name="영업이익률" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="netMargin" name="순이익률" stroke="#8b5cf6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    const chartConfig = {
      income: { bars: [{ dataKey: 'revenue', name: '매출액', fill: CHART_COLORS[0] }, { dataKey: 'netIncome', name: '순이익', fill: CHART_COLORS[3] }] },
      balance: { bars: [{ dataKey: 'totalAssets', name: '총자산', fill: CHART_COLORS[0] }, { dataKey: 'totalEquity', name: '자본총계', fill: CHART_COLORS[2] }] },
      cashflow: { bars: [{ dataKey: 'operatingCashFlow', name: '영업현금흐름', fill: CHART_COLORS[2] }, { dataKey: 'freeCashFlow', name: '잉여현금흐름', fill: CHART_COLORS[1] }] }
    };
    const config = chartConfig[activeFinTab];

    return (
      <div className="p-4 h-full">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} />
            <YAxis stroke="#9ca3af" fontSize={10} tickFormatter={formatYAxis} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
            <Legend />
            {config.bars.map((bar, idx) => (
              <Bar key={idx} dataKey={bar.dataKey} name={bar.name} fill={bar.fill} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderFinancialTable = (periods, type) => {
    if (!periods || periods.length === 0) return <div className="text-center text-gray-500 py-12">데이터가 없습니다</div>;

    const getData = (period) => {
      switch (type) {
        case 'income': return period.income_statement || {};
        case 'balance': return period.balance_sheet || {};
        case 'cashflow': return period.cash_flow || {};
        default: return {};
      }
    };

    const firstData = getData(periods[0]);
    const metricKeys = Object.keys(firstData).filter(k => firstData[k] !== null);

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 px-3 text-gray-400 font-medium sticky left-0 bg-[#1a1f2e]">항목</th>
              {periods.map((period, idx) => (
                <th key={idx} className="text-right py-2 px-3 text-gray-400 font-medium min-w-[100px]">
                  {period.date?.substring(0, 7) || 'N/A'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metricKeys.map((key) => (
              <tr key={key} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="py-2 px-3 text-gray-300 sticky left-0 bg-[#1a1f2e]">
                  {METRIC_LABELS[key] || key.replace(/_/g, ' ')}
                </td>
                {periods.map((period, idx) => {
                  const data = getData(period);
                  const value = data[key];
                  return (
                    <td key={idx} className="text-right py-2 px-3 text-white font-medium">
                      {typeof value === 'number' ? formatNumber(value) : value || '-'}
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

  return (
    <div className="bg-[#1a1f2e] rounded-xl border border-gray-700 h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="drag-handle-area cursor-move p-1 hover:bg-gray-700 rounded">
              <GripVertical size={14} className="text-gray-500" />
            </div>
            <FileText className="text-purple-500" size={24} />
            <div>
              <h2 className="text-lg font-bold text-white">재무제표</h2>
              <p className="text-gray-400 text-xs">{symbol}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-800 rounded p-0.5">
              <button onClick={() => setPeriod('quarterly')} className={`px-2 py-1 text-xs rounded ${period === 'quarterly' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>분기</button>
              <button onClick={() => setPeriod('annual')} className={`px-2 py-1 text-xs rounded ${period === 'annual' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>연간</button>
            </div>
            <div className="flex bg-gray-800 rounded p-0.5">
              <button onClick={() => setViewMode('table')} className={`p-1 rounded ${viewMode === 'table' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}><Table2 size={14} /></button>
              <button onClick={() => setViewMode('chart')} className={`p-1 rounded ${viewMode === 'chart' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}><BarChart3 size={14} /></button>
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          {FINANCIAL_TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveFinTab(tab.id)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeFinTab === tab.id ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >{tab.name}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        ) : viewMode === 'chart' || activeFinTab === 'margins' ? (
          renderChartView()
        ) : (
          renderFinancialTable(financials?.periods || [], activeFinTab)
        )}
      </div>
    </div>
  );
}

export { FinancialsContentWidget };

const AVAILABLE_WIDGETS = [
  { id: 'financials-content', name: '재무제표', description: '재무제표 분석', defaultSize: { w: 12, h: 12 } },
];

export default function AnalysisFinancialsTab() {
  const { symbol } = useStockContext();

  const DEFAULT_WIDGETS = [
    { id: 'financials-content-1', type: 'financials-content', symbol },
  ];

  const DEFAULT_LAYOUT = [
    { i: 'financials-content-1', x: 0, y: 0, w: 12, h: 12, minW: 6, minH: 8 },
  ];

  return (
    <WidgetDashboard
      dashboardId={`analysis-financials-${symbol}`}
      title="재무제표"
      subtitle={symbol}
      availableWidgets={AVAILABLE_WIDGETS}
      defaultWidgets={DEFAULT_WIDGETS}
      defaultLayout={DEFAULT_LAYOUT}
    />
  );
}
