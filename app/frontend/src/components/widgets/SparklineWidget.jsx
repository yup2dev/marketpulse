import { useState, useEffect, useRef, useCallback } from 'react';
import { Activity } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import { apiClient, API_BASE } from '../../config/api';
import SymbolAutocomplete from '../common/SymbolAutocomplete';

const PERIODS = ['1mo', '3mo', '6mo', '1y'];

export default function SparklineWidget({ onRemove }) {
  const [symbols, setSymbols] = useState(['AAPL', 'MSFT', 'GOOGL', 'AMZN']);
  const [period, setPeriod] = useState('3mo');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [addInput, setAddInput] = useState('');

  const fetchAll = useCallback(async () => {
    if (!symbols.length) return;
    setLoading(true);
    const results = {};
    await Promise.allSettled(
      symbols.map(async (sym) => {
        try {
          const res = await apiClient.get(
            `${API_BASE}/stock/history/${encodeURIComponent(sym)}?period=${period}&interval=1d`
          );
          const prices = (res.data || res.prices || res || [])
            .map((d) => d.close ?? d.Close)
            .filter((v) => v != null);
          const quote = res.quote || {};
          results[sym] = { prices, quote };
        } catch {
          results[sym] = { prices: [], quote: {} };
        }
      })
    );
    setData(results);
    setLoading(false);
  }, [symbols, period]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const removeSymbol = (sym) => setSymbols((prev) => prev.filter((s) => s !== sym));

  const addSymbol = (stock) => {
    const sym = (stock?.symbol || addInput).toUpperCase();
    if (sym && !symbols.includes(sym)) {
      setSymbols((prev) => [...prev, sym]);
    }
    setAddInput('');
  };

  return (
    <BaseWidget
      title="Mini Charts"
      icon={Activity}
      loading={loading && !Object.keys(data).length}
      onRefresh={fetchAll}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
    >
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-2 px-3 pt-2 pb-1 flex-shrink-0">
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  period === p ? 'bg-cyan-900/50 text-cyan-300' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex-1 max-w-[140px]">
            <SymbolAutocomplete
              value={addInput}
              onChange={setAddInput}
              onSelect={addSymbol}
              placeholder="Add..."
              compact
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto px-2 pb-2">
          <div className="grid grid-cols-2 gap-1.5">
            {symbols.map((sym) => (
              <MiniChart
                key={sym}
                symbol={sym}
                prices={data[sym]?.prices || []}
                quote={data[sym]?.quote || {}}
                onRemove={() => removeSymbol(sym)}
              />
            ))}
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}

function MiniChart({ symbol, prices, quote, onRemove }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !prices.length) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const isUp = prices[prices.length - 1] >= prices[0];

    ctx.strokeStyle = isUp ? '#22c55e' : '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    prices.forEach((p, i) => {
      const x = (i / (prices.length - 1)) * w;
      const y = h - ((p - min) / range) * (h - 4) - 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, isUp ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  }, [prices]);

  const last = prices[prices.length - 1];
  const first = prices[0];
  const chg = first ? ((last - first) / first) * 100 : 0;
  const isUp = chg >= 0;

  return (
    <div className="bg-[#0a0a0f] border border-gray-800 rounded p-2 relative group">
      <button
        onClick={onRemove}
        className="absolute top-1 right-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 text-[10px] transition-opacity"
      >
        ×
      </button>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[11px] font-semibold text-white font-mono">{symbol}</span>
        <span className={`text-[10px] tabular-nums ${isUp ? 'text-green-400' : 'text-red-400'}`}>
          {isUp ? '+' : ''}{chg.toFixed(2)}%
        </span>
      </div>
      {last != null && (
        <div className="text-[10px] text-gray-400 tabular-nums mb-1">${last.toFixed(2)}</div>
      )}
      <canvas ref={canvasRef} width={160} height={40} className="w-full h-[40px]" />
    </div>
  );
}
