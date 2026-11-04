/**
 * BacktestLabWidget — chart studio combining the Advanced Chart
 * (ChartWidget series-mode) with data drawn from the series catalog.
 *
 * /backtest 탭 템플릿(urlWidgetMap)의 'backtest-lab' 위젯. 헤더의 심볼 선택을 seed 로 받는다.
 * v1: chart-only (no strategy backtest engine yet — see roadmap).
 */
import { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';

import SeriesPicker  from '../backtest/SeriesPicker';
import ChartWidget   from './ChartWidget';
import { extractPoints, resolveTemplate, rangeToPeriod } from '../backtest/seriesCatalog';
import { CHART_COLORS } from './constants';
import { apiClient, API_BASE } from '../../config/api';

const fmtDate = d => d.toISOString().slice(0, 10);

// Default range: last 1 month.
function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 1);
  return { start: fmtDate(start), end: fmtDate(end) };
}

export default function BacktestLabWidget({ symbol: symbolProp, onRemove }) {
  const [symbol, setSymbol]             = useState(symbolProp || 'AAPL');
  const [startDate, setStartDate]       = useState(() => defaultRange().start);
  const [endDate, setEndDate]           = useState(() => defaultRange().end);
  const [loadedSeries, setLoadedSeries] = useState([]);
  const [isAdding, setIsAdding]         = useState(false);

  // 헤더 심볼 선택이 바뀌면 다음에 추가할 시리즈의 심볼도 따라간다(이미 그린 시리즈는 유지).
  useEffect(() => { if (symbolProp) setSymbol(symbolProp); }, [symbolProp]);

  const handleAddSeries = useCallback(async (entry) => {
    if (!startDate || !endDate || startDate > endDate) {
      toast.error('Invalid date range');
      return;
    }
    setIsAdding(true);
    const ctx = { symbol, startDate, endDate, period: rangeToPeriod(startDate) };
    const url = resolveTemplate(entry.endpoint, ctx);
    const label = resolveTemplate(entry.label, ctx);
    const seriesKey = `${entry.id}::${entry.needsSymbol ? symbol : 'global'}::${startDate}~${endDate}`;

    if (loadedSeries.some(s => s.id === seriesKey)) {
      toast.error('Already on chart');
      setIsAdding(false);
      return;
    }

    try {
      const response = await apiClient.get(`${API_BASE}${url}`);
      const points = extractPoints(response, entry).filter(p => {
        const d = String(p.date).slice(0, 10);
        return d >= startDate && d <= endDate;
      });
      if (!points.length) {
        toast.error(`No data for ${label}`);
        return;
      }
      setLoadedSeries(prev => [
        ...prev,
        {
          id:      seriesKey,
          name:    label,
          color:   CHART_COLORS[prev.length % CHART_COLORS.length],
          visible: true,
          data:    points,
        },
      ]);
      toast.success(`Added ${label} (${points.length} pts)`);
    } catch (e) {
      toast.error(e.detail || e.message || 'Fetch failed');
    } finally {
      setIsAdding(false);
    }
  }, [symbol, startDate, endDate, loadedSeries]);

  const handleRemoveSeries = useCallback((id) => {
    setLoadedSeries(prev => prev.filter(s => s.id !== id));
  }, []);

  const handleToggleVisible = useCallback((id) => {
    setLoadedSeries(prev =>
      prev.map(s => s.id === id ? { ...s, visible: s.visible === false } : s)
    );
  }, []);

  return (
    <div className="flex gap-3 h-full min-h-0">
      <div className="flex-shrink-0 overflow-y-auto">
        <SeriesPicker
          symbol={symbol}
          onSymbolChange={setSymbol}
          startDate={startDate}
          onStartDateChange={setStartDate}
          endDate={endDate}
          onEndDateChange={setEndDate}
          loadedSeries={loadedSeries}
          onAddSeries={handleAddSeries}
          onRemoveSeries={handleRemoveSeries}
          onToggleVisible={handleToggleVisible}
          isAdding={isAdding}
        />
      </div>

      <div className="flex-1 min-w-0 min-h-0">
        <ChartWidget
          series={loadedSeries}
          title="Backtest Chart"
          subtitle={`${symbol} · ${startDate} ~ ${endDate}`}
          loading={isAdding}
          onRemove={onRemove}
        />
      </div>
    </div>
  );
}
