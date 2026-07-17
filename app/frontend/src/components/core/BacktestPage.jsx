/**
 * BacktestPage — visualization tab combining the existing Advanced Chart
 * (ChartWidget series-mode) with data drawn from the widget catalog.
 *
 * v1: chart-only (no strategy backtest engine yet — see roadmap).
 */
import { useState, useCallback } from 'react';
import { LineChart } from 'lucide-react';
import toast from 'react-hot-toast';

import SeriesPicker  from '../backtest/SeriesPicker';
import ChartWidget   from '../widgets/ChartWidget';
import { extractPoints, resolveTemplate } from '../backtest/seriesCatalog';
import { CHART_COLORS } from '../widgets/constants';
import { apiClient, API_BASE } from '../../config/api';

const fmtDate = d => d.toISOString().slice(0, 10);

// Default range: last 1 month.
function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 1);
  return { start: fmtDate(start), end: fmtDate(end) };
}

// Period-based endpoints anchor at today, so pick the smallest preset
// covering startDate→today; the response is then filtered to [start, end].
function rangeToPeriod(startDate) {
  const days = Math.ceil((Date.now() - new Date(startDate).getTime()) / 86400000);
  if (days <= 31)   return '1mo';
  if (days <= 93)   return '3mo';
  if (days <= 186)  return '6mo';
  if (days <= 366)  return '1y';
  if (days <= 731)  return '2y';
  if (days <= 1827) return '5y';
  if (days <= 3653) return '10y';
  return 'max';
}

export default function BacktestPage() {
  const [symbol, setSymbol]             = useState('AAPL');
  const [startDate, setStartDate]       = useState(() => defaultRange().start);
  const [endDate, setEndDate]           = useState(() => defaultRange().end);
  const [loadedSeries, setLoadedSeries] = useState([]);
  const [isAdding, setIsAdding]         = useState(false);

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
    <div className="px-6 py-4 min-h-[calc(100vh-3.5rem-4rem)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <LineChart className="text-cyan-400" size={18} />
          <h1 className="text-lg font-semibold text-white">Backtest Lab</h1>
          <span className="text-[11px] text-gray-500 ml-2">
            Chart studio — combine price, fundamentals, quant & macro on one canvas
          </span>
        </div>
      </div>

      <div className="flex gap-4">
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

        <div className="flex-1 min-w-0" style={{ minHeight: 600 }}>
          <ChartWidget
            series={loadedSeries}
            title="Backtest Chart"
            subtitle={`${symbol} · ${startDate} ~ ${endDate}`}
            loading={isAdding}
          />
        </div>
      </div>
    </div>
  );
}
