import { useState, useCallback, useEffect } from 'react';
import { GitCompare } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import { apiClient, API_BASE } from '../../config/api';
import SymbolAutocomplete from '../common/SymbolAutocomplete';

const METRICS = [
  { key: 'price', label: 'Price', fmt: (v) => v != null ? `$${Number(v).toFixed(2)}` : '—' },
  { key: 'changesPercentage', label: 'Change %', fmt: (v) => v != null ? `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(2)}%` : '—', color: true },
  { key: 'marketCap', label: 'Market Cap', fmt: (v) => fmtLarge(v) },
  { key: 'pe', label: 'P/E', fmt: (v) => v != null ? Number(v).toFixed(2) : '—' },
  { key: 'eps', label: 'EPS', fmt: (v) => v != null ? `$${Number(v).toFixed(2)}` : '—' },
  { key: 'beta', label: 'Beta', fmt: (v) => v != null ? Number(v).toFixed(2) : '—' },
  { key: 'dividend_yield', label: 'Div Yield', fmt: (v) => v != null ? `${(Number(v) * 100).toFixed(2)}%` : '—' },
  { key: 'roe', label: 'ROE', fmt: (v) => v != null ? `${(Number(v) * 100).toFixed(2)}%` : '—' },
  { key: 'profit_margin', label: 'Net Margin', fmt: (v) => v != null ? `${(Number(v) * 100).toFixed(2)}%` : '—' },
  { key: 'debt_to_equity', label: 'D/E', fmt: (v) => v != null ? Number(v).toFixed(2) : '—' },
  { key: '52w_high', label: '52W High', fmt: (v) => v != null ? `$${Number(v).toFixed(2)}` : '—' },
  { key: '52w_low', label: '52W Low', fmt: (v) => v != null ? `$${Number(v).toFixed(2)}` : '—' },
];

function fmtLarge(v) {
  if (v == null) return '—';
  const n = Number(v);
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

export default function ComparisonWidget({ onRemove }) {
  const [symbols, setSymbols] = useState(['AAPL', 'MSFT']);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addInput, setAddInput] = useState('');

  const fetchComparison = useCallback(async () => {
    if (symbols.length < 2) return;
    setLoading(true);
    try {
      const res = await apiClient.get(
        `${API_BASE}/stock/compare?symbols=${symbols.map(encodeURIComponent).join(',')}`
      );
      setStocks(res.stocks || []);
    } catch {
      setStocks([]);
    }
    setLoading(false);
  }, [symbols]);

  useEffect(() => { fetchComparison(); }, [fetchComparison]);

  const addSymbol = (stock) => {
    const sym = (stock?.symbol || addInput).toUpperCase();
    if (sym && !symbols.includes(sym) && symbols.length < 4) {
      setSymbols((prev) => [...prev, sym]);
    }
    setAddInput('');
  };

  const removeSymbol = (sym) => {
    setSymbols((prev) => prev.filter((s) => s !== sym));
  };

  return (
    <BaseWidget
      title="Stock Comparison"
      icon={GitCompare}
      loading={loading}
      onRefresh={fetchComparison}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
    >
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-2 px-3 pt-2 pb-1 flex-shrink-0 flex-wrap">
          {symbols.map((sym) => (
            <span
              key={sym}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-gray-800 rounded text-white font-mono"
            >
              {sym}
              <button onClick={() => removeSymbol(sym)} className="text-gray-500 hover:text-red-400">×</button>
            </span>
          ))}
          {symbols.length < 4 && (
            <div className="w-[120px]">
              <SymbolAutocomplete
                value={addInput}
                onChange={setAddInput}
                onSelect={addSymbol}
                placeholder="Add..."
                compact
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {stocks.length >= 2 ? (
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-gray-500 px-3 py-2 font-medium sticky top-0 bg-[#0d0d12] z-10">Metric</th>
                {stocks.map((s) => (
                  <th key={s.symbol} className="text-right text-gray-400 px-3 py-2 font-semibold sticky top-0 bg-[#0d0d12] z-10 font-mono">
                    {s.symbol}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => {
                const vals = stocks.map((s) => s[m.key]);
                const numVals = vals.map(Number).filter(Number.isFinite);
                const best = m.key === 'debt_to_equity'
                  ? Math.min(...numVals)
                  : Math.max(...numVals);
                return (
                  <tr key={m.key} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="text-gray-400 px-3 py-1.5">{m.label}</td>
                    {stocks.map((s) => {
                      const v = s[m.key];
                      const isBest = numVals.length > 1 && Number(v) === best && Number.isFinite(Number(v));
                      let cls = 'text-gray-200';
                      if (m.color && v != null) cls = Number(v) >= 0 ? 'text-green-400' : 'text-red-400';
                      if (isBest) cls += ' font-semibold';
                      return (
                        <td key={s.symbol} className={`text-right px-3 py-1.5 tabular-nums ${cls}`}>
                          {m.fmt(v)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="text-center text-gray-500 text-[11px] py-8">
            Add at least 2 symbols to compare
          </div>
        )}
        </div>
      </div>
    </BaseWidget>
  );
}
