import { useState, useEffect } from 'react';
import {
  Calendar, DollarSign, FileText, Users, Bell,
  ChevronLeft, ChevronRight, RefreshCw, Clock,
  TrendingUp, TrendingDown, Check
} from 'lucide-react';
import { API_BASE } from '../../config/api';
import { formatCurrency } from '../../utils/widgetUtils';

const EVENT_TYPES = {
  earnings: { icon: FileText, color: 'blue', label: 'Earnings' },
  dividend: { icon: DollarSign, color: 'green', label: 'Dividend' },
  ex_dividend: { icon: DollarSign, color: 'yellow', label: 'Ex-Dividend' },
  dividend_payment: { icon: DollarSign, color: 'green', label: 'Dividend Payment' },
  split: { icon: TrendingUp, color: 'purple', label: 'Stock Split' },
  meeting: { icon: Users, color: 'orange', label: 'Meeting' },
  conference: { icon: Bell, color: 'cyan', label: 'Conference' },
};

const CompanyCalendarTab = ({ symbol }) => {
  const [calendarEvents, setCalendarEvents] = useState([]);  // 달력 뷰용 월별 이벤트
  const [listEvents, setListEvents] = useState([]);  // 리스트 뷰용 (전월 1개월 ~ 향후 3개월)
  const [earningsHistory, setEarningsHistory] = useState([]);
  const [dividendHistory, setDividendHistory] = useState([]);
  const [dividendInfo, setDividendInfo] = useState({});
  const [upcomingEarnings, setUpcomingEarnings] = useState({});
  const [loading, setLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewMode, setViewMode] = useState('calendar');

  // 월의 시작일과 종료일 계산
  const getMonthRange = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    };
  };

  // 리스트용 기간 계산 (전월 1개월 ~ 향후 3개월)
  const getListDateRange = () => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 4, 0);
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    };
  };

  // 달력 뷰용 월별 이벤트 로드
  const loadCalendarMonthEvents = async (monthDate) => {
    setCalendarLoading(true);
    try {
      const { start, end } = getMonthRange(monthDate);
      const res = await fetch(`${API_BASE}/stock/calendar/${symbol}?start_date=${start}&end_date=${end}`);
      if (res.ok) {
        const data = await res.json();
        setCalendarEvents(data.events || []);
      }
    } catch (error) {
      console.error('Error loading calendar month events:', error);
    } finally {
      setCalendarLoading(false);
    }
  };

  // 리스트 뷰용 이벤트 로드 (전월 1개월 ~ 향후 3개월)
  const loadListEvents = async () => {
    try {
      const { start, end } = getListDateRange();
      const res = await fetch(`${API_BASE}/stock/calendar/${symbol}?start_date=${start}&end_date=${end}`);
      if (res.ok) {
        const data = await res.json();
        setListEvents(data.events || []);
        setUpcomingEarnings(data.upcoming_earnings || {});
      }
    } catch (error) {
      console.error('Error loading list events:', error);
    }
  };

  // 초기 데이터 로드 (earnings, dividends 등)
  useEffect(() => {
    if (symbol) {
      loadInitialData();
    }
  }, [symbol]);

  // 월 변경 시 달력 이벤트 로드
  useEffect(() => {
    if (symbol && viewMode === 'calendar') {
      loadCalendarMonthEvents(currentMonth);
    }
  }, [symbol, currentMonth, viewMode]);

  // 리스트 뷰 선택 시 리스트 이벤트 로드
  useEffect(() => {
    if (symbol && viewMode === 'list') {
      loadListEvents();
    }
  }, [symbol, viewMode]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [calendarRes, earningsRes, dividendsRes] = await Promise.all([
        fetch(`${API_BASE}/stock/calendar/${symbol}`),
        fetch(`${API_BASE}/stock/earnings/${symbol}`),
        fetch(`${API_BASE}/stock/dividends/${symbol}`)
      ]);

      if (calendarRes.ok) {
        const data = await calendarRes.json();
        // Use earnings_history from calendar endpoint (Yahoo Finance)
        if (data.earnings_history && data.earnings_history.length > 0) {
          setEarningsHistory(data.earnings_history);
        }
        setDividendInfo(data.dividend_info || {});
        setUpcomingEarnings(data.upcoming_earnings || {});
      }

      // Fallback to Polygon earnings data if calendar didn't have history
      if (earningsRes.ok) {
        const data = await earningsRes.json();
        if (data.earnings && data.earnings.length > 0) {
          setEarningsHistory(prev => prev.length > 0 ? prev : data.earnings);
        }
      }

      if (dividendsRes.ok) {
        const data = await dividendsRes.json();
        setDividendHistory(data.history || []);
      }

      // 초기 달력 뷰 이벤트 로드
      await loadCalendarMonthEvents(currentMonth);
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calendar helpers
  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatMonthYear = (date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getEventsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return calendarEvents.filter(e => e.date === dateStr);
  };

  const navigateMonth = (direction) => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1);
    setCurrentMonth(newMonth);
    // 월별 이벤트는 useEffect에서 자동으로 로드됨
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 bg-gray-900/30"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const dayEvents = getEventsForDate(date);
      const isToday = new Date().toDateString() === date.toDateString();
      const isSelected = selectedDate?.toDateString() === date.toDateString();

      days.push(
        <div
          key={day}
          onClick={() => setSelectedDate(date)}
          className={`h-24 p-2 border border-gray-800 cursor-pointer transition-colors ${
            isToday ? 'bg-blue-900/20 border-blue-500' :
            isSelected ? 'bg-purple-900/20 border-purple-500' :
            'hover:bg-gray-800/50'
          }`}
        >
          <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-400' : 'text-gray-400'}`}>
            {day}
          </div>
          <div className="space-y-1">
            {dayEvents.slice(0, 2).map((event, idx) => {
              const eventConfig = EVENT_TYPES[event.type] || EVENT_TYPES.earnings;
              return (
                <div
                  key={idx}
                  className={`text-xs px-1.5 py-0.5 rounded truncate bg-${eventConfig.color}-500/20 text-${eventConfig.color}-400`}
                  title={event.title}
                >
                  {event.title}
                </div>
              );
            })}
            {dayEvents.length > 2 && (
              <div className="text-xs text-gray-500">+{dayEvents.length - 2} more</div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  // 리스트 뷰용: 전월 1개월 ~ 향후 3개월 이벤트 (정렬)
  const sortedListEvents = [...listEvents].sort((a, b) => new Date(a.date) - new Date(b.date));

  // 다가오는 이벤트 (오늘 이후)
  const upcomingEventsFiltered = sortedListEvents.filter(e => new Date(e.date) >= new Date());

  const nextEarnings = upcomingEventsFiltered.find(e => e.type === 'earnings');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold text-white flex items-center gap-2">
              <Calendar className="text-blue-500" size={24} />
              Company Calendar - {symbol}
            </h3>
            <p className="text-gray-400 text-sm mt-1">Earnings, dividends, and corporate events</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-800/50 rounded-lg p-1 border border-gray-700">
              {['calendar', 'list', 'earnings'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors capitalize ${
                    viewMode === mode ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                loadInitialData();
                if (viewMode === 'list') loadListEvents();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white text-sm"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        {/* Next Earnings Highlight */}
        {nextEarnings && (
          <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg p-4 border border-blue-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-blue-500/20 p-3 rounded-lg">
                  <FileText className="text-blue-400" size={24} />
                </div>
                <div>
                  <div className="text-white font-semibold">Next Earnings Release</div>
                  <div className="text-gray-400 text-sm">{nextEarnings.title}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white font-bold text-lg">
                  {new Date(nextEarnings.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                {nextEarnings.eps_estimate && (
                  <div className="text-blue-400 text-sm">
                    EPS Est: ${nextEarnings.eps_estimate.toFixed(2)}
                  </div>
                )}
              </div>
            </div>
            {nextEarnings.revenue_estimate && (
              <div className="mt-3 pt-3 border-t border-blue-500/20 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">EPS Range:</span>
                  <span className="text-white ml-2">
                    ${nextEarnings.eps_low?.toFixed(2)} - ${nextEarnings.eps_high?.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Rev Est:</span>
                  <span className="text-white ml-2">{formatCurrency(nextEarnings.revenue_estimate)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Rev Range:</span>
                  <span className="text-white ml-2">
                    {formatCurrency(nextEarnings.revenue_low)} - {formatCurrency(nextEarnings.revenue_high)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              <h4 className="text-lg font-semibold text-white">{formatMonthYear(currentMonth)}</h4>
              {calendarLoading && <RefreshCw className="animate-spin text-blue-500" size={16} />}
            </div>
            <button
              onClick={() => navigateMonth(1)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-px bg-gray-800 rounded-lg overflow-hidden">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="bg-gray-900 py-2 text-center text-sm font-medium text-gray-400">
                {day}
              </div>
            ))}
            {renderCalendar()}
          </div>

          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-800">
            {Object.entries(EVENT_TYPES).map(([key, config]) => (
              <div key={key} className="flex items-center gap-2 text-sm">
                <div className={`w-3 h-3 rounded bg-${config.color}-500`}></div>
                <span className="text-gray-400">{config.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List View - 전월 1개월 ~ 향후 3개월 */}
      {viewMode === 'list' && (
        <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-white">Events (Past 1 Month ~ Next 3 Months)</h4>
            <span className="text-sm text-gray-400">
              {(() => {
                const { start, end } = getListDateRange();
                return `${start} ~ ${end}`;
              })()}
            </span>
          </div>
          <div className="space-y-3">
            {sortedListEvents.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No events in this period</div>
            ) : (
              sortedListEvents.map((event, idx) => {
                const eventConfig = EVENT_TYPES[event.type] || EVENT_TYPES.earnings;
                const IconComponent = eventConfig.icon;
                const isPast = new Date(event.date) < new Date();
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-4 p-4 rounded-lg transition-colors ${
                      isPast ? 'bg-gray-800/20 opacity-60' : 'bg-gray-800/30 hover:bg-gray-800/50'
                    }`}
                  >
                    <div className={`p-2 rounded-lg bg-${eventConfig.color}-500/20`}>
                      <IconComponent className={`text-${eventConfig.color}-400`} size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{event.title}</span>
                        {isPast && <span className="text-xs text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded">Past</span>}
                      </div>
                      <div className="text-gray-400 text-sm mt-1">{event.description}</div>
                      {event.amount && (
                        <div className="text-green-400 text-sm mt-1">${event.amount} per share</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-white font-medium">
                        {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      {event.time && (
                        <div className="text-gray-400 text-sm">{event.time}</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Earnings View */}
      {viewMode === 'earnings' && (
        <>
          {/* Earnings History */}
          <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
            <h4 className="text-lg font-semibold text-white mb-4">Earnings History</h4>
            {earningsHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Date</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">EPS Est.</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">EPS Act.</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Surprise</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {earningsHistory.map((earning, idx) => {
                      // Handle both Yahoo Finance format (from calendar) and Polygon format (from earnings)
                      const date = earning.date || earning.report_date;
                      const epsEst = earning.eps_estimate ?? earning.eps_estimated;
                      const epsAct = earning.eps_actual;
                      const surprisePct = earning.surprise_pct ?? earning.eps_surprise_percent ?? 0;
                      const isBeat = epsAct && epsEst && epsAct > epsEst;

                      return (
                        <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/30">
                          <td className="py-3 px-4 text-white font-medium">{date}</td>
                          <td className="text-right py-3 px-4 text-gray-300">
                            {epsEst != null ? `$${epsEst.toFixed(2)}` : '-'}
                          </td>
                          <td className="text-right py-3 px-4 text-white font-medium">
                            {epsAct != null ? `$${epsAct.toFixed(2)}` : '-'}
                          </td>
                          <td className={`text-right py-3 px-4 font-medium ${
                            surprisePct >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            <span className="flex items-center justify-end gap-1">
                              {surprisePct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                              {surprisePct >= 0 ? '+' : ''}{surprisePct.toFixed(1)}%
                            </span>
                          </td>
                          <td className="text-center py-3 px-4">
                            {epsAct != null && epsEst != null && (
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                isBeat ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                              }`}>
                                {isBeat ? 'BEAT' : 'MISS'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">No earnings history available</div>
            )}
          </div>

          {/* Dividend History */}
          <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
            <h4 className="text-lg font-semibold text-white mb-4">Dividend History</h4>
            {dividendHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Date</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Amount</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Yield</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">YoY Growth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dividendHistory.slice(0, 12).map((dividend, idx) => (
                      <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="py-3 px-4 text-white">{dividend.date}</td>
                        <td className="text-right py-3 px-4 text-green-400 font-medium">
                          ${dividend.amount?.toFixed(4) || '-'}
                        </td>
                        <td className="text-right py-3 px-4 text-gray-300">
                          {dividend.dividend_yield ? `${dividend.dividend_yield.toFixed(2)}%` : '-'}
                        </td>
                        <td className={`text-right py-3 px-4 font-medium ${
                          (dividend.yoy_growth || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {dividend.yoy_growth ? `${dividend.yoy_growth >= 0 ? '+' : ''}${dividend.yoy_growth.toFixed(1)}%` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">No dividend history available</div>
            )}
          </div>

          {/* Earnings Beat/Miss Summary */}
          {earningsHistory.length > 0 && (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-[#1a1a1a] rounded-lg p-5 border border-gray-800">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                  <Check className="text-green-500" size={16} />
                  EPS Beat Rate
                </div>
                <div className="text-2xl font-bold text-green-400">
                  {Math.round((earningsHistory.filter(e => {
                    const epsAct = e.eps_actual;
                    const epsEst = e.eps_estimate ?? e.eps_estimated;
                    return epsAct && epsEst && epsAct > epsEst;
                  }).length / earningsHistory.length) * 100)}%
                </div>
                <div className="text-xs text-gray-500 mt-1">Last {earningsHistory.length} quarters</div>
              </div>
              <div className="bg-[#1a1a1a] rounded-lg p-5 border border-gray-800">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                  <TrendingUp className="text-blue-500" size={16} />
                  Avg. EPS Surprise
                </div>
                <div className="text-2xl font-bold text-blue-400">
                  {(() => {
                    const surprises = earningsHistory.map(e => e.surprise_pct ?? e.eps_surprise_percent ?? 0);
                    const avg = surprises.reduce((a, b) => a + b, 0) / surprises.length;
                    return `${avg >= 0 ? '+' : ''}${avg.toFixed(1)}%`;
                  })()}
                </div>
                <div className="text-xs text-gray-500 mt-1">vs estimates</div>
              </div>
              <div className="bg-[#1a1a1a] rounded-lg p-5 border border-gray-800">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                  <DollarSign className="text-green-500" size={16} />
                  Dividend Rate
                </div>
                <div className="text-2xl font-bold text-white">
                  ${dividendInfo.rate?.toFixed(2) || dividendHistory[0]?.amount?.toFixed(2) || '-'}
                </div>
                <div className="text-xs text-gray-500 mt-1">annual per share</div>
              </div>
              <div className="bg-[#1a1a1a] rounded-lg p-5 border border-gray-800">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                  <TrendingUp className="text-yellow-500" size={16} />
                  Dividend Yield
                </div>
                <div className="text-2xl font-bold text-yellow-400">
                  {dividendInfo.yield ? `${(dividendInfo.yield * 100).toFixed(2)}%` : '-'}
                </div>
                <div className="text-xs text-gray-500 mt-1">current yield</div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Selected Date Events */}
      {selectedDate && viewMode === 'calendar' && getEventsForDate(selectedDate).length > 0 && (
        <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
          <h4 className="text-lg font-semibold text-white mb-4">
            Events on {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </h4>
          <div className="space-y-3">
            {getEventsForDate(selectedDate).map((event, idx) => {
              const eventConfig = EVENT_TYPES[event.type] || EVENT_TYPES.earnings;
              const IconComponent = eventConfig.icon;
              return (
                <div key={idx} className="flex items-start gap-4 p-4 bg-gray-800/30 rounded-lg">
                  <div className={`p-2 rounded-lg bg-${eventConfig.color}-500/20`}>
                    <IconComponent className={`text-${eventConfig.color}-400`} size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-medium">{event.title}</div>
                    <div className="text-gray-400 text-sm mt-1">{event.description}</div>
                    {event.time && (
                      <div className="text-gray-500 text-sm mt-1 flex items-center gap-1">
                        <Clock size={12} />
                        {event.time}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {calendarEvents.length === 0 && listEvents.length === 0 && earningsHistory.length === 0 && !loading && (
        <div className="bg-[#1a1a1a] rounded-lg p-12 text-center border border-gray-800">
          <Calendar className="mx-auto mb-4 text-gray-600" size={48} />
          <div className="text-gray-400 text-lg">No calendar data available for {symbol}</div>
        </div>
      )}
    </div>
  );
};

export default CompanyCalendarTab;
