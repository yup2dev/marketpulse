import { useState, useEffect, useRef, useCallback } from 'react';
import { Grid3X3 } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import { PeriodSelect, WidgetState, stateFromError } from './ui';
import { apiClient, API_BASE } from '../../config/api';
import SymbolAutocomplete from '../common/SymbolAutocomplete';

// 기간 표기는 periods.js 기준 (3M 6M 1Y 2Y)
const PERIODS = ['3mo', '6mo', '1y', '2y'];

export default function CorrelationWidget({ onRemove }) {
  const [symbols, setSymbols] = useState(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META']);
  const [period, setPeriod] = useState('1y');
  const [matrix, setMatrix] = useState(null);
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [addInput, setAddInput] = useState('');
  const [hovered, setHovered] = useState(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const fetchCorrelation = useCallback(async () => {
    if (symbols.length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(
        `${API_BASE}/quantitative/correlation?symbols=${symbols.join(',')}&period=${period}`
      );
      const row = res?.results?.[0];
      setMatrix(row?.matrix ?? null);
      setLabels(Array.isArray(row?.labels) ? row.labels : []);
    } catch (e) {
      setMatrix(null);
      setLabels([]);
      setError(stateFromError(e));
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

  // Dynamic cell sizing: fit n×n matrix + label column + legend into available space
  const n = labels.length;
  // width: n cells + ~1.2x cell for row-label column
  // height: n cells + 1 header row (≈ cellSize for vertical labels) + 30px legend
  const cellSize = n > 0 && dims.w > 0 && dims.h > 0
    ? Math.max(20, Math.min(60, Math.floor(Math.min(
        dims.w / (n + 1.2),
        (dims.h - 30) / (n + 1),
      ))))
    : 36;
  const fontSize = Math.max(8, Math.min(11, cellSize * 0.27));
  const verticalHeader = n > 5 || cellSize < 36;

  return (
    <BaseWidget
      title="Correlation Matrix"
      icon={Grid3X3}
      onRefresh={fetchCorrelation}
      onRemove={onRemove}
      showPeriodSelector={false}
      filters={{
        left: (
          <>
            <PeriodSelect value={period} onChange={setPeriod} preset={PERIODS} variant="segmented" />
            {symbols.length < 10 && (
              <div className="w-[120px]">
                <SymbolAutocomplete
                  value={addInput}
                  onChange={setAddInput}
                  onSelect={addSymbol}
                  placeholder="Add symbol"
                  compact
                />
              </div>
            )}
          </>
        ),
      }}
    >
      {/* absolute inset-0: widget-content is position:relative, so this fills it without h-full */}
      <div className="absolute inset-0 flex flex-col">
      {loading && (
        <div className="absolute inset-0 z-10 bg-black/20">
          <WidgetState kind="loading" />
        </div>
      )}
        {/* Symbol chips */}
        <div className="flex flex-wrap gap-1 px-3 pt-2 pb-1 flex-shrink-0">
          {symbols.map((sym) => (
            <span key={sym} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-gray-800 rounded text-gray-300 font-mono">
              {sym}
              <button onClick={() => removeSymbol(sym)} className="text-gray-600 hover:text-red-400">×</button>
            </span>
          ))}
        </div>

        {/* containerRef directly on flex-1 div — ResizeObserver gets flex-allocated size */}
        <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden relative">
          {matrix && labels.length ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <table style={{ borderCollapse: 'collapse', fontSize }}>
                <thead>
                  <tr>
                    <th style={{ padding: `0 ${Math.max(4, cellSize * 0.15)}px` }} />
                    {labels.map((l) => (
                      <th
                        key={l}
                        className="text-gray-400 font-mono font-medium text-center"
                        style={{
                          padding: `4px ${Math.max(2, cellSize * 0.1)}px`,
                          writingMode: verticalHeader ? 'vertical-rl' : undefined,
                          transform: verticalHeader ? 'rotate(180deg)' : undefined,
                          maxWidth: cellSize,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {l}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {labels.map((rowLabel, ri) => (
                    <tr key={rowLabel}>
                      <td
                        className="text-gray-400 font-mono font-medium text-right"
                        style={{
                          padding: `${Math.max(2, cellSize * 0.1)}px ${Math.max(4, cellSize * 0.2)}px`,
                          whiteSpace: 'nowrap',
                          fontSize,
                        }}
                      >
                        {rowLabel}
                      </td>
                      {matrix[ri].map((val, ci) => {
                        const isHov = hovered && hovered[0] === ri && hovered[1] === ci;
                        return (
                          <td
                            key={ci}
                            onMouseEnter={() => setHovered([ri, ci])}
                            onMouseLeave={() => setHovered(null)}
                            className="text-center tabular-nums"
                            style={{
                              backgroundColor: corrColor(val),
                              width: cellSize,
                              height: cellSize,
                              padding: `${Math.max(2, cellSize * 0.1)}px ${Math.max(2, cellSize * 0.15)}px`,
                              color: Math.abs(val) > 0.5 ? '#fff' : '#9ca3af',
                              fontWeight: ri === ci ? 600 : 400,
                              outline: isHov ? '2px solid #22d3ee' : 'none',
                              outlineOffset: -1,
                              fontSize,
                            }}
                          >
                            {cellSize >= 30 ? val.toFixed(2) : val.toFixed(1)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Legend */}
              <div className="flex items-center justify-center gap-1 mt-2 flex-shrink-0">
                <span className="text-[9px] text-gray-500">-1.0</span>
                <div className="flex h-2.5 rounded overflow-hidden" style={{ width: Math.min(160, dims.w * 0.5) }}>
                  {[...Array(20)].map((_, i) => (
                    <div key={i} className="flex-1" style={{ backgroundColor: corrColor(-1 + (i / 19) * 2) }} />
                  ))}
                </div>
                <span className="text-[9px] text-gray-500">+1.0</span>
              </div>

              {hovered && (
                <div className="absolute bottom-2 right-2 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[10px] text-gray-300 pointer-events-none z-10">
                  {labels[hovered[0]]} × {labels[hovered[1]]}: <span className="text-white font-semibold">{matrix[hovered[0]][hovered[1]].toFixed(4)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="absolute inset-0">
              {error ? (
                <WidgetState {...error} onRetry={fetchCorrelation} />
              ) : symbols.length < 2 ? (
                <WidgetState kind="idle" title="Add at least 2 symbols" message="Use Add symbol above to build the matrix." />
              ) : (
                <WidgetState kind={loading ? 'loading' : 'empty'} title="No correlation data" />
              )}
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
    const b = Math.round(18 + (18 - 18) * t);
    return `rgb(${r},${g},${b})`;
  }
}
