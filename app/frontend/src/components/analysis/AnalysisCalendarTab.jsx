/**
 * Analysis Calendar Tab - WidgetDashboard 기반 동적 레이아웃
 */
import { useState, useEffect } from 'react';
import { Calendar, DollarSign, TrendingUp, Clock, AlertCircle, GripVertical } from 'lucide-react';
import { useStockContext } from './AnalysisDashboard';
import WidgetDashboard from '../WidgetDashboard';
import { API_BASE } from '../../config/api';

function CalendarContentWidget({ symbol, onRemove }) {
  const [calendarData, setCalendarData] = useState(null);
  const [earningsHistory, setEarningsHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (symbol) loadCalendarData();
  }, [symbol]);

  const loadCalendarData = async () => {
    setLoading(true);
    try {
      const [calendarRes, earningsRes] = await Promise.all([
        fetch(`${API_BASE}/stock/calendar/${symbol}`),
        fetch(`${API_BASE}/stock/earnings/${symbol}?limit=8`)
      ]);

      if (calendarRes.ok) setCalendarData(await calendarRes.json());
      if (earningsRes.ok) {
        const data = await earningsRes.json();
        setEarningsHistory(data.earnings || []);
      }
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatNumber = (value, type = 'number') => {
    if (value === null || value === undefined) return 'N/A';
    if (type === 'currency') {
      if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
      if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
      return `$${value.toFixed(2)}`;
    }
    return value.toFixed(2);
  };

  const getDaysUntil = (dateStr) => {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
  };

  const getSurpriseColor = (surprise) => {
    if (surprise === null || surprise === undefined) return 'text-gray-400';
    if (surprise > 0) return 'text-green-400';
    if (surprise < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  if (loading) {
    return (
      <div className="bg-[#1a1f2e] rounded-xl border border-gray-700 h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  const earnings = calendarData?.earnings || {};
  const dividend = calendarData?.dividend || {};
  const earningsDaysUntil = getDaysUntil(earnings.date);
  const dividendDaysUntil = getDaysUntil(dividend.ex_date);

  return (
    <div className="bg-[#1a1f2e] rounded-xl border border-gray-700 h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center gap-3 shrink-0">
        <div className="drag-handle-area cursor-move p-1 hover:bg-gray-700 rounded">
          <GripVertical size={14} className="text-gray-500" />
        </div>
        <Calendar className="text-purple-500" size={24} />
        <div>
          <h2 className="text-lg font-bold text-white">회사 일정</h2>
          <p className="text-gray-400 text-xs">실적 발표 및 배당 일정</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Earnings & Dividend Cards */}
        <div className="grid grid-cols-2 gap-4">
          {/* Earnings Card */}
          <div className="bg-gray-800/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="text-blue-400" size={16} />
              <h3 className="text-sm font-semibold text-white">실적 발표</h3>
            </div>
            {earnings.date ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">발표일</span>
                  <span className="text-white">{formatDate(earnings.date)}</span>
                </div>
                {earningsDaysUntil !== null && (
                  <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                    earningsDaysUntil <= 7 ? 'bg-yellow-600/20 text-yellow-400' : 'bg-gray-800 text-gray-300'
                  }`}>
                    <Clock size={12} />
                    {earningsDaysUntil > 0 ? `${earningsDaysUntil}일 후` : earningsDaysUntil === 0 ? '오늘' : '지남'}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 text-gray-400 text-xs">
                <AlertCircle size={12} />
                예정 일정 없음
              </div>
            )}
          </div>

          {/* Dividend Card */}
          <div className="bg-gray-800/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="text-green-400" size={16} />
              <h3 className="text-sm font-semibold text-white">배당</h3>
            </div>
            {dividend.ex_date || dividend.pay_date ? (
              <div className="space-y-2">
                {dividend.ex_date && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">배당락일</span>
                    <span className="text-white">{formatDate(dividend.ex_date)}</span>
                  </div>
                )}
                {dividend.pay_date && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">지급일</span>
                    <span className="text-white">{formatDate(dividend.pay_date)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 text-gray-400 text-xs">
                <AlertCircle size={12} />
                예정 일정 없음
              </div>
            )}
          </div>
        </div>

        {/* Earnings History */}
        {earningsHistory.length > 0 && (
          <div className="bg-gray-800/30 rounded-lg overflow-hidden">
            <div className="p-3 border-b border-gray-700">
              <h3 className="text-sm font-semibold text-white">실적 발표 이력</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-800/50">
                    <th className="text-left py-2 px-3 text-gray-400 font-medium">기간</th>
                    <th className="text-center py-2 px-3 text-gray-400 font-medium">EPS 실제</th>
                    <th className="text-center py-2 px-3 text-gray-400 font-medium">EPS 예상</th>
                    <th className="text-center py-2 px-3 text-gray-400 font-medium">Surprise</th>
                  </tr>
                </thead>
                <tbody>
                  {earningsHistory.slice(0, 6).map((earning, idx) => (
                    <tr key={idx} className="border-b border-gray-800">
                      <td className="py-2 px-3 text-white">{earning.fiscal_year} {earning.fiscal_period}</td>
                      <td className="text-center py-2 px-3 text-white font-medium">{formatNumber(earning.eps_actual)}</td>
                      <td className="text-center py-2 px-3 text-gray-400">{formatNumber(earning.eps_estimated)}</td>
                      <td className={`text-center py-2 px-3 font-medium ${getSurpriseColor(earning.eps_surprise_percent)}`}>
                        {earning.eps_surprise_percent != null
                          ? `${earning.eps_surprise_percent > 0 ? '+' : ''}${earning.eps_surprise_percent.toFixed(2)}%`
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { CalendarContentWidget };

const AVAILABLE_WIDGETS = [
  { id: 'calendar-content', name: '회사 일정', description: '실적/배당 일정', defaultSize: { w: 12, h: 12 } },
];

export default function AnalysisCalendarTab() {
  const { symbol } = useStockContext();

  const DEFAULT_WIDGETS = [
    { id: 'calendar-content-1', type: 'calendar-content', symbol },
  ];

  const DEFAULT_LAYOUT = [
    { i: 'calendar-content-1', x: 0, y: 0, w: 12, h: 12, minW: 6, minH: 8 },
  ];

  return (
    <WidgetDashboard
      dashboardId={`analysis-calendar-${symbol}`}
      title="회사 일정"
      subtitle={symbol}
      availableWidgets={AVAILABLE_WIDGETS}
      defaultWidgets={DEFAULT_WIDGETS}
      defaultLayout={DEFAULT_LAYOUT}
    />
  );
}
