import { useState, useEffect, useRef, useCallback } from 'react';
import { Grid3X3 } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import { apiClient, API_BASE } from '../../config/api';
import SymbolAutocomplete from '../common/SymbolAutocomplete';

const PERIODS = ['3mo', '6mo', '1y', '2y'];

export default function CorrelationWidget({ onRemove }) {
  const [symbols, setSymbols] = useState(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META']);
  const [period, setPeriod] = useState('1y');
  const [matrix, setMatrix] = useState(null);
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addInput, setAddInput] = useState('');
  const [hovered, setHovered] = useState(null);

  const fetchCorrelation = useCallback(async () => {
    if (symbols.length < 2) return;
    setLoading(true);
    try {
      const res = await apiClient.get(
        `${API_BASE}/quantitative/correlation?symbols=${symbols.join(',')}&period=${period}`
      );
      setMatrix(res.matrix);
      setLabels(res.labels);
    } catch {
      setMatrix(null);
      setLabels([]);
    }
    setLoading(false);
  }, [symbols, period]);

  useEffect(() => { fetchCorrelation(); }, [fetchCorrelation]);

  const addSymbol = (stock) => {
    const sym = (stock?.symbol || addInput).toUpperCase();
    if (sym && !symbols.includes(sym) && symbols.length < 10) {
      setSymbols((prev) => [...prev, sym]);
    }
    setAddInput('');
  };

  const removeSymbol = (sym) => setSymbols((prev) => prev.filter((s) => s !== sym));

  return (
    <BaseWidget
      title="Correlation Matrix"
      icon={Grid3X3}
      loading={loading}
      onRefresh={fetchCorrelation}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
    >
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-2 px-3 pt-2 pb-1 flex-shrink-0 flex-wrap">
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
          {symbols.length < 10 && (
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

        <div className="flex flex-wrap gap-1 px-3 pb-1">
        {symbols.map((sym) => (
          <span key={sym} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-gray-800 rounded text-gray-300 font-mono">
            {sym}
            <button onClick={() => removeSymbol(sym)} className="text-gray-600 hover:text-red-400">×</button>
          </span>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-2">
        {matrix && labels.length ? (
          <div className="relative">
            <table className="text-[10px] mx-auto">
              <thead>
                <tr>
                  <th className="px-1 py-1" />
                  {labels.map((l) => (
                    <th key={l} className="px-2 py-1 text-gray-400 font-mono font-medium text-center" style={{ writingMode: labels.length > 6 ? 'vertical-rl' : undefined }}>
                      {l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {labels.map((rowLabel, ri) => (
                  <tr key={rowLabel}>
                    <td className="px-2 py-1 text-gray-400 font-mono font-medium text-right">{rowLabel}</td>
                    {matrix[ri].map((val, ci) => {
                      const bg = corrColor(val);
                      const isHov = hovered && hovered[0] === ri && hovered[1] === ci;
                      return (
                        <td
                          key={ci}
                          onMouseEnter={() => setHovered([ri, ci])}
                          onMouseLeave={() => setHovered(null)}
                          className="text-center tabular-nums relative"
                          style={{
                            backgroundColor: bg,
                            padding: '6px 8px',
                            color: Math.abs(val) > 0.5 ? '#fff' : '#9ca3af',
                            fontWeight: ri === ci ? 600 : 400,
                            outline: isHov ? '2px solid #22d3ee' : 'none',
                            outlineOffset: -1,
                          }}
                        >
                          {val.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {hovered && (
              <div className="absolute bottom-1 right-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[10px] text-gray-300">
                {labels[hovered[0]]} × {labels[hovered[1]]}: <span className="text-white font-semibold">{matrix[hovered[0]][hovered[1]].toFixed(4)}</span>
              </div>
            )}

            <div className="flex items-center justify-center gap-1 mt-3">
              <span className="text-[9px] text-gray-500">-1.0</span>
              <div className="flex h-3 w-40 rounded overflow-hidden">
                {[...Array(20)].map((_, i) => (
                  <div key={i} className="flex-1" style={{ backgroundColor: corrColor(-1 + (i / 19) * 2) }} />
                ))}
              </div>
              <span className="text-[9px] text-gray-500">+1.0</span>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 text-[11px] py-8">
            Add at least 2 symbols
          </div>
        )}
        </div>
      </div>
    </BaseWidget>
  );
}

function corrColor(v) {
  if (v >= 0) {
    const t = Math.min(v, 1);
    const r = Math.round(13 + (34 - 13) * t);
    const g = Math.round(17 + (197 - 17) * t);
    const b = Math.round(18 + (94 - 18) * t);
    return `rgb(${r},${g},${b})`;
  } else {
    const t = Math.min(-v, 1);
    const r = Math.round(13 + (239 - 13) * t);
    const g = Math.round(17 + (68 - 17) * t);
    const b = Math.round(18 + (68 - 18) * t);
    return `rgb(${r},${g},${b})`;
  }
}
