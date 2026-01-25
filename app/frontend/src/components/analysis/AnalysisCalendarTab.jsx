/**
 * Analysis Calendar Tab - 회사 일정 (실적 발표, 배당)
 */
import { useState, useEffect } from 'react';
import { Calendar, DollarSign, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { useStockContext } from './AnalysisDashboard';
import { API_BASE } from '../../config/api';

export default function AnalysisCalendarTab() {
  const { symbol } = useStockContext();
  const [calendarData, setCalendarData] = useState(null);
  const [earningsHistory, setEarningsHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCalendarData();
  }, [symbol]);

  const loadCalendarData = async () => {
    setLoading(true);
    try {
      const [calendarRes, earningsRes] = await Promise.all([
        fetch(`${API_BASE}/stock/calendar/${symbol}`),
        fetch(`${API_BASE}/stock/earnings/${symbol}?limit=8`)
      ]);

      if (calendarRes.ok) {
        const data = await calendarRes.json();
        setCalendarData(data);
      }

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
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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
    const date = new Date(dateStr);
    const today = new Date();
    const diffTime = date - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getSurpriseColor = (surprise) => {
    if (surprise === null || surprise === undefined) return 'text-gray-400';
    if (surprise > 0) return 'text-green-400';
    if (surprise < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      </div>
    );
  }

  const earnings = calendarData?.earnings || {};
  const dividend = calendarData?.dividend || {};
  const earningsDaysUntil = getDaysUntil(earnings.date);
  const dividendDaysUntil = getDaysUntil(dividend.ex_date);

  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Calendar className="text-purple-500" size={28} />
          <div>
            <h2 className="text-xl font-bold text-white">회사 일정</h2>
            <p className="text-gray-400 text-sm mt-0.5">실적 발표 및 배당 일정을 확인하세요</p>
          </div>
        </div>

        {/* Upcoming Events Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Earnings Card */}
          <div className="bg-[#1a1f2e] rounded-xl border border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-600/20 rounded-lg">
                <TrendingUp className="text-blue-400" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">실적 발표</h3>
                <p className="text-gray-400 text-sm">Earnings Announcement</p>
              </div>
            </div>

            {earnings.date ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">발표일</span>
                  <div className="text-right">
                    <span className="text-white font-medium">{formatDate(earnings.date)}</span>
                    {earnings.date_end && earnings.date !== earnings.date_end && (
                      <span className="text-gray-400 text-sm ml-1">~ {formatDate(earnings.date_end)}</span>
                    )}
                  </div>
                </div>

                {earningsDaysUntil !== null && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                    earningsDaysUntil <= 7 ? 'bg-yellow-600/20' : 'bg-gray-800'
                  }`}>
                    <Clock size={16} className={earningsDaysUntil <= 7 ? 'text-yellow-400' : 'text-gray-400'} />
                    <span className={earningsDaysUntil <= 7 ? 'text-yellow-400' : 'text-gray-300'}>
                      {earningsDaysUntil > 0 ? `${earningsDaysUntil}일 후` : earningsDaysUntil === 0 ? '오늘' : '지남'}
                    </span>
                  </div>
                )}

                {/* EPS Estimate */}
                {(earnings.eps_average || earnings.eps_low || earnings.eps_high) && (
                  <div className="border-t border-gray-700 pt-4">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">EPS 추정치</h4>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-gray-800 rounded-lg p-2">
                        <div className="text-xs text-gray-500">Low</div>
                        <div className="text-white font-medium">{formatNumber(earnings.eps_low)}</div>
                      </div>
                      <div className="bg-purple-600/20 rounded-lg p-2">
                        <div className="text-xs text-purple-400">Avg</div>
                        <div className="text-white font-bold">{formatNumber(earnings.eps_average)}</div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-2">
                        <div className="text-xs text-gray-500">High</div>
                        <div className="text-white font-medium">{formatNumber(earnings.eps_high)}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Revenue Estimate */}
                {(earnings.revenue_average || earnings.revenue_low || earnings.revenue_high) && (
                  <div className="border-t border-gray-700 pt-4">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">매출 추정치</h4>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-gray-800 rounded-lg p-2">
                        <div className="text-xs text-gray-500">Low</div>
                        <div className="text-white font-medium text-sm">{formatNumber(earnings.revenue_low, 'currency')}</div>
                      </div>
                      <div className="bg-purple-600/20 rounded-lg p-2">
                        <div className="text-xs text-purple-400">Avg</div>
                        <div className="text-white font-bold text-sm">{formatNumber(earnings.revenue_average, 'currency')}</div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-2">
                        <div className="text-xs text-gray-500">High</div>
                        <div className="text-white font-medium text-sm">{formatNumber(earnings.revenue_high, 'currency')}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-400">
                <AlertCircle size={16} />
                <span>예정된 실적 발표 일정이 없습니다</span>
              </div>
            )}
          </div>

          {/* Dividend Card */}
          <div className="bg-[#1a1f2e] rounded-xl border border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-600/20 rounded-lg">
                <DollarSign className="text-green-400" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">배당</h3>
                <p className="text-gray-400 text-sm">Dividend</p>
              </div>
            </div>

            {dividend.ex_date || dividend.pay_date ? (
              <div className="space-y-4">
                {dividend.ex_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">배당락일 (Ex-Date)</span>
                    <div className="text-right">
                      <span className="text-white font-medium">{formatDate(dividend.ex_date)}</span>
                    </div>
                  </div>
                )}

                {dividend.pay_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">지급일 (Pay Date)</span>
                    <div className="text-right">
                      <span className="text-white font-medium">{formatDate(dividend.pay_date)}</span>
                    </div>
                  </div>
                )}

                {dividendDaysUntil !== null && dividend.ex_date && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                    dividendDaysUntil <= 7 && dividendDaysUntil > 0 ? 'bg-green-600/20' : 'bg-gray-800'
                  }`}>
                    <Clock size={16} className={dividendDaysUntil <= 7 && dividendDaysUntil > 0 ? 'text-green-400' : 'text-gray-400'} />
                    <span className={dividendDaysUntil <= 7 && dividendDaysUntil > 0 ? 'text-green-400' : 'text-gray-300'}>
                      배당락일까지 {dividendDaysUntil > 0 ? `${dividendDaysUntil}일` : dividendDaysUntil === 0 ? '오늘' : '지남'}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-400">
                <AlertCircle size={16} />
                <span>예정된 배당 일정이 없습니다</span>
              </div>
            )}
          </div>
        </div>

        {/* Earnings History Table */}
        {earningsHistory.length > 0 && (
          <div className="bg-[#1a1f2e] rounded-xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">실적 발표 이력</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-800/50">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">기간</th>
                    <th className="text-center py-3 px-4 text-gray-400 font-medium">발표일</th>
                    <th className="text-center py-3 px-4 text-gray-400 font-medium">EPS 실제</th>
                    <th className="text-center py-3 px-4 text-gray-400 font-medium">EPS 예상</th>
                    <th className="text-center py-3 px-4 text-gray-400 font-medium">Surprise</th>
                    <th className="text-center py-3 px-4 text-gray-400 font-medium">매출</th>
                  </tr>
                </thead>
                <tbody>
                  {earningsHistory.map((earning, index) => (
                    <tr key={index} className="border-b border-gray-800 hover:bg-gray-800/30">
                      <td className="py-3 px-4 text-white font-medium">
                        {earning.fiscal_year} {earning.fiscal_period}
                      </td>
                      <td className="text-center py-3 px-4 text-gray-300">
                        {formatDate(earning.report_date)}
                      </td>
                      <td className="text-center py-3 px-4 text-white font-medium">
                        {formatNumber(earning.eps_actual)}
                      </td>
                      <td className="text-center py-3 px-4 text-gray-400">
                        {formatNumber(earning.eps_estimated)}
                      </td>
                      <td className={`text-center py-3 px-4 font-medium ${getSurpriseColor(earning.eps_surprise_percent)}`}>
                        {earning.eps_surprise_percent != null
                          ? `${earning.eps_surprise_percent > 0 ? '+' : ''}${earning.eps_surprise_percent.toFixed(2)}%`
                          : 'N/A'}
                      </td>
                      <td className="text-center py-3 px-4 text-gray-300">
                        {formatNumber(earning.revenue_actual, 'currency')}
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
