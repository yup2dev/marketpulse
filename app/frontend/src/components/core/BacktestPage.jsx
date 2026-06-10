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

// Approximate start_date / end_date from period (used by quant rolling endpoint).
function periodToDateRange(period) {
  const end = new Date();
  const start = new Date();
  const years = { '6mo': 0.5, '1y': 1, '2y': 2, '5y': 5 }[period] || 1;
  start.setFullYear(start.getFullYear() - Math.floor(years));
  if (years % 1 !== 0) start.setMonth(start.getMonth() - 6);
  const fmt = d => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

export default function BacktestPage() {
  const [symbol, setSymbol]             = useState('AAPL');
  const [period, setPeriod]             = useState('1y');
  const [loadedSeries, setLoadedSeries] = useState([]);
  const [isAdding, setIsAdding]         = useState(false);

  const handleAddSeries = useCallback(async (entry) => {
    setIsAdding(true);
    const ctx = { symbol, period, ...periodToDateRange(period) };
    const url = resolveTemplate(entry.endpoint, ctx);
    const label = resolveTemplate(entry.label, ctx);
    const seriesKey = `${entry.id}::${entry.needsSymbol ? symbol : 'global'}::${period}`;

    if (loadedSeries.some(s => s.id === seriesKey)) {
      toast.error('Already on chart');
      setIsAdding(false);
      return;
    }

    try {
      const response = await apiClient.get(`${API_BASE}${url}`);
      const points = extractPoints(response, entry);
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
  }, [symbol, period, loadedSeries]);

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
          period={period}
          onPeriodChange={setPeriod}
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
            subtitle={`${symbol} · ${period}`}
            loading={isAdding}
          />
        </div>
      </div>
    </div>
  );
}
