/**
 * Ownership Overview Widget - Ownership breakdown & share statistics
 */
import { useState, useEffect, useCallback } from 'react';
import { Users, AlignJustify, PieChart } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import { API_BASE } from '../../../config/api';

const formatNumber = (value) => {
  if (value === null || value === undefined) return '-';
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toLocaleString();
};

export default function OwnershipOverviewWidget({ symbol: initialSymbol = 'AAPL', onRemove }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [ownershipData, setOwnershipData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('chart');
  const [chartStyle, setChartStyle] = useState('donut'); // 'bars' | 'donut'

  useEffect(() => { setSymbol(initialSymbol); }, [initialSymbol]);

  const loadData = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/holders/${symbol}`);
      if (res.ok) {
        const data = await res.json();
        setOwnershipData(data.summary || {});
      }
    } catch (error) {
      console.error('Error loading ownership overview:', error);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { loadData(); }, [loadData]);

  const instPct = ownershipData?.institutional_pct || 0;
  const insiderPct = ownershipData?.insider_pct || 0;
  const retailPct = Math.max(0, 100 - instPct - insiderPct);
  const shortPct = ownershipData?.short_interest || 0;

  const floatPct = ownershipData?.shares_outstanding && ownershipData?.float_shares
    ? ((ownershipData.float_shares / ownershipData.shares_outstanding) * 100).toFixed(1)
    : '0';

  const renderChart = () => {
    if (!ownershipData) return <div className="flex items-center justify-center h-full text-gray-500 text-xs">No data</div>;

    const bars = [
      { label: 'Institutional', value: instPct, color: '#3b82f6', textClass: 'text-blue-400' },
      { label: 'Insider',       value: insiderPct, color: '#22c55e', textClass: 'text-green-400' },
      { label: 'Retail / Other',value: retailPct, color: '#f59e0b', textClass: 'text-amber-400' },
      { label: 'Short Interest', value: shortPct, color: '#ef4444', textClass: 'text-red-400' },
    ].filter(b => b.value > 0);

    const stats = [
      { label: 'Float %',       value: `${floatPct}%` },
      { label: 'Short Interest',value: `${shortPct.toFixed(1)}%` },
      { label: 'Shares Out',    value: formatNumber(ownershipData.shares_outstanding) },
      { label: 'Avg Volume',    value: formatNumber(ownershipData.avg_volume) },
    ];

    // ── Donut (SVG) ──────────────────────────────────────────────────
    const renderDonut = () => {
      const r = 56;
      const cx = 80;
      const cy = 76;
      const circumference = 2 * Math.PI * r;
      const total = bars.reduce((s, b) => s + b.value, 0) || 1;
      let cumLen = 0;
      const slices = bars.map(b => {
        const dash = (b.value / total) * circumference;
        const slice = { ...b, dash, offset: circumference / 4 - cumLen };
        cumLen += dash;
        return slice;
      });

      return (
        <div className="h-full flex flex-col p-3">
          <div className="flex-1 flex items-center justify-center min-h-0">
            <svg width="160" height="152" viewBox="0 0 160 152">
              {slices.map((s, i) => (
                <circle
                  key={i}
                  cx={cx} cy={cy} r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="22"
                  strokeDasharray={`${s.dash} ${circumference - s.dash}`}
                  strokeDashoffset={s.offset}
                />
              ))}
              <circle cx={cx} cy={cy} r={45} fill="#0f1117" />
              <text x={cx} y={cy - 5} textAnchor="middle" fill="#9ca3af" fontSize="9">Institutional</text>
              <text x={cx} y={cy + 12} textAnchor="middle" fill="#3b82f6" fontSize="16" fontWeight="bold">{instPct.toFixed(1)}%</text>
            </svg>
          </div>
          <div className="flex-shrink-0 grid grid-cols-2 gap-x-4 gap-y-1 px-1">
            {bars.map(b => (
              <div key={b.label} className="flex items-center gap-1.5 text-[11px]">
                <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: b.color }} />
                <span className="text-gray-400 truncate">{b.label}</span>
                <span className={`ml-auto font-medium tabular-nums flex-shrink-0 ${b.textClass}`}>{b.value.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      );
    };

    // ── Bars ────────────────────────────────────────────────────────
    const renderBars = () => {
      const maxVal = Math.max(...bars.map(b => b.value), 1);
      return (
        <div className="overflow-auto h-full p-3 space-y-3">
          {bars.map(b => (
            <div key={b.label}>
              <div className="flex items-center justify-between mb-0.5 text-xs">
                <span className="text-gray-300">{b.label}</span>
                <span className={`font-medium tabular-nums ml-2 flex-shrink-0 ${b.textClass}`}>{b.value.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${(b.value / maxVal) * 100}%`, backgroundColor: b.color }} />
              </div>
            </div>
          ))}
          <div className="border-t border-gray-800 pt-2.5 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            {stats.map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium tabular-nums text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
      );
    };

    return (
      <div className="h-full flex flex-col">
        {/* Chart style toggle */}
        <div className="flex justify-end gap-1 px-3 pt-1.5 flex-shrink-0">
          {[
            { id: 'donut', Icon: PieChart },
            { id: 'bars',  Icon: AlignJustify },
          ].map(({ id, Icon }) => (
            <button
              key={id}
              onClick={() => setChartStyle(id)}
              className={`p-1 rounded transition-colors ${chartStyle === id ? 'text-blue-400' : 'text-gray-600 hover:text-gray-400'}`}
            >
              <Icon size={13} />
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0">
          {chartStyle === 'donut' ? renderDonut() : renderBars()}
        </div>
      </div>
    );
  };

  const renderTable = () => {
    if (!ownershipData) return <div className="flex items-center justify-center h-full text-gray-500 text-xs">No data</div>;
    const rows = [
      { label: 'Shares Outstanding', value: formatNumber(ownershipData.shares_outstanding) },
      { label: 'Float', value: formatNumber(ownershipData.float_shares) },
      { label: 'Float %', value: `${floatPct}%` },
      { label: 'Institutional Ownership', value: `${ownershipData.institutional_pct?.toFixed(1) || 0}%`, color: 'text-blue-400' },
      { label: 'Insider Ownership', value: `${ownershipData.insider_pct?.toFixed(1) || 0}%`, color: 'text-green-400' },
      { label: 'Short % of Float', value: `${ownershipData.short_interest?.toFixed(1) || 0}%`, color: 'text-red-400' },
      { label: 'Avg. Volume', value: formatNumber(ownershipData.avg_volume) },
    ];
    return (
      <table className="w-full text-xs">
        <tbody>
          {rows.map(({ label, value, color }) => (
            <tr key={label} className="border-b border-gray-800 hover:bg-gray-800/20">
              <td className="py-2.5 px-4 text-gray-400">{label}</td>
              <td className={`py-2.5 px-4 text-right font-medium tabular-nums ${color || 'text-white'}`}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <BaseWidget
      title="Ownership Overview"
      icon={Users}
      iconColor="text-blue-400"
      symbol={symbol}
      onSymbolChange={setSymbol}
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      showPeriodSelector={false}
    >
      {viewMode === 'chart' ? renderChart() : renderTable()}
    </BaseWidget>
  );
}
