/**
 * Revenue Segments Widget
 *
 * Annual  (FMP):     Product segment + Geographic breakdown — chart (pie/donut/bar/stacked) / table
 * Quarterly (yfinance): P&L decomposition per quarter — P&L Chart / table
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { PieChart as PieIcon } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import CommonChart from '../common/CommonChart';
import { API_BASE } from '../../config/api';

// ─── Colour palette ───────────────────────────────────────────────────────────
const PALETTE = [
  '#06b6d4', '#22c55e', '#f59e0b', '#a78bfa', '#f87171',
  '#34d399', '#60a5fa', '#fb923c', '#e879f9', '#facc15',
  '#4ade80', '#38bdf8', '#f472b6', '#c084fc', '#2dd4bf',
];
const segColor = (i) => PALETTE[i % PALETTE.length];

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtB   = (v) => (v == null ? '–' : `$${v.toFixed(1)}B`);
const fmtPct = (v) => (v == null ? '–' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`);
const fmtMrg = (v) => (v == null ? '–' : `${v.toFixed(1)}%`);
const fmtDate = (s) => s ? s.slice(0, 7) : s;
const fmtQtr  = (s) => {
  if (!s) return s;
  const d = new Date(s);
  const q = Math.ceil((d.getMonth() + 1) / 3);
  return `Q${q}'${String(d.getFullYear()).slice(2)}`;
};


// ─── Main Widget ──────────────────────────────────────────────────────────────
export default function RevenueSegmentsWidget({ symbol: initialSymbol, onRemove }) {
  const [symbol,  setSymbol]  = useState(initialSymbol || 'AAPL');
  const [freq,    setFreq]    = useState('annual');     // 'annual' | 'quarterly'
  const [segType, setSegType] = useState('product');    // 'product' | 'geo'
  const [view,    setView]    = useState('chart');      // 'chart' | 'table' (annual); 'pnl' | 'table' (quarterly)
  const [annualChartType, setAnnualChartType] = useState('donut'); // pie | donut | bar | stackedBar

  const [annualData,    setAnnualData]    = useState(null);
  const [quarterlyData, setQuarterlyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // ── Fetch helpers ─────────────────────────────────────────────────────────
  const fetchAnnual = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API_BASE}/stock/revenue-segments/${symbol}?limit=8`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setAnnualData(await r.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [symbol]);

  const fetchQuarterly = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API_BASE}/stock/quarterly-pnl/${symbol}?limit=12`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setQuarterlyData(await r.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [symbol]);

  useEffect(() => {
    if (freq === 'annual') {
      if (!annualData || annualData.symbol !== symbol) fetchAnnual();
    } else {
      if (!quarterlyData || quarterlyData.symbol !== symbol) fetchQuarterly();
    }
  }, [symbol, freq]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setAnnualData(null);
    setQuarterlyData(null);
  }, [symbol]);

  const handleFreqChange = (f) => {
    setFreq(f);
    setView(f === 'annual' ? 'chart' : 'pnl');
  };

  // ── Annual derived data ───────────────────────────────────────────────────
  const seg = annualData?.[segType];

  // Latest-period data for pie/donut slices
  const latestSlices = useMemo(() => {
    if (!seg) return [];
    return seg.segments
      .filter(s => seg.latest[s] != null && seg.latest[s] > 0)
      .map(s => ({ name: s, value: seg.latest[s] }));
  }, [seg]);

  // CommonChart data + series depend on the chosen chart type
  const annualChartData = useMemo(() => {
    if (annualChartType === 'pie' || annualChartType === 'donut') {
      return latestSlices;
    }
    return seg?.history || [];
  }, [annualChartType, latestSlices, seg]);

  const annualChartSeries = useMemo(() => {
    if (annualChartType === 'pie' || annualChartType === 'donut') {
      return [{ key: 'value', name: 'Revenue' }];
    }
    return (seg?.segments || []).map((s, i) => ({ key: s, name: s, color: segColor(i) }));
  }, [annualChartType, seg]);

  const annualChartXKey = (annualChartType === 'pie' || annualChartType === 'donut') ? 'name' : 'date';

  // ── Quarterly derived data ────────────────────────────────────────────────
  const qHistory = quarterlyData?.history || [];

  const qPnlData = qHistory.map(row => {
    const rev   = row.revenue   ?? 0;
    const cogs  = row.cogs      ?? 0;
    const sga   = row.sga       ?? 0;
    const rd    = row.rd        ?? 0;
    const opinc = row.op_income ?? 0;
    const other = Math.max(0, rev - cogs - sga - rd - opinc);
    return {
      date:   fmtQtr(row.date),
      rawDate: row.date,
      revenue: rev,
      cogs, sga, rd,
      op_income: opinc,
      other,
      gross_margin: row.gross_margin,
      op_margin:    row.op_margin,
      net_margin:   row.net_margin,
      net:          row.net,
    };
  });

  // ── Renderers: Annual ─────────────────────────────────────────────────────
  const renderAnnualChart = () => {
    if (!seg?.segments?.length || !annualChartData.length) {
      return <NoData msg="No segment data for this symbol" />;
    }
    return (
      <CommonChart
        data={annualChartData}
        series={annualChartSeries}
        xKey={annualChartXKey}
        type={annualChartType}
        onTypeChange={setAnnualChartType}
        fillContainer={true}
        showTypeSelector={true}
        allowedTypes={['pie', 'donut', 'bar', 'stackedBar']}
        xFormatter={annualChartXKey === 'date' ? (s => s?.slice(0, 4)) : undefined}
        tooltipFormatter={(v) => [fmtB(v)]}
      />
    );
  };

  const renderAnnualTable = () => {
    if (!seg?.segments?.length) return <NoData />;
    const rows = [...(seg.history || [])].reverse();
    return (
      <div className="overflow-auto h-full">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0d0d12] z-10">
            <tr className="border-b border-gray-800">
              <th className="text-left py-2 px-3 text-gray-400 font-medium">Date</th>
              <th className="text-right py-2 px-3 text-gray-400 font-medium">Total</th>
              {seg.segments.map(s => (
                <th key={s} className="text-right py-2 px-2 text-gray-400 font-medium whitespace-nowrap">{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const prevRow = rows[ri + 1];
              return (
                <tr key={row.date} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="py-1.5 px-3 text-gray-300 tabular-nums">{row.date?.slice(0, 10)}</td>
                  <td className="py-1.5 px-3 text-right text-white tabular-nums font-medium">{fmtB(row.total)}</td>
                  {seg.segments.map((s, si) => {
                    const val = row[s], prv = prevRow?.[s];
                    const yoy = val != null && prv != null && prv !== 0
                      ? ((val - prv) / Math.abs(prv) * 100) : null;
                    const pct = row.total ? (val / row.total * 100) : null;
                    return (
                      <td key={s} className="py-1.5 px-2 text-right tabular-nums">
                        <span style={{ color: segColor(si) }}>{fmtB(val)}</span>
                        {pct != null && <span className="text-gray-600 text-[9px] ml-0.5">{pct.toFixed(0)}%</span>}
                        {yoy != null && (
                          <span className={`text-[9px] ml-1 ${yoy >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {fmtPct(yoy)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // ── Renderers: Quarterly ──────────────────────────────────────────────────
  const renderPnlChart = () => {
    if (!qPnlData.length) return <NoData msg="No quarterly data" />;
    return (
      <CommonChart
        data={qPnlData}
        series={[
          { key: 'cogs',      name: 'Cost of Revenue', color: '#ef4444' },
          { key: 'sga',       name: 'SG&A',            color: '#f97316' },
          { key: 'rd',        name: 'R&D',             color: '#eab308' },
          { key: 'op_income', name: 'Op. Income',      color: '#22c55e' },
        ]}
        xKey="date"
        type="stackedBar"
        fillContainer={true}
        showTypeSelector={false}
        yFormatter={(v) => `$${Number(v).toFixed(0)}B`}
        tooltipFormatter={(v) => fmtB(v)}
      />
    );
  };

  const renderQtrTable = () => {
    if (!qHistory.length) return <NoData msg="No quarterly data" />;
    const rows = [...qHistory].reverse();
    const yoyMap = quarterlyData?.yoy_revenue || {};
    return (
      <div className="overflow-auto h-full">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0d0d12] z-10">
            <tr className="border-b border-gray-800">
              <th className="text-left py-2 px-3 text-gray-400 font-medium">Quarter</th>
              <th className="text-right py-2 px-2 text-gray-400 font-medium">Revenue</th>
              <th className="text-right py-2 px-2 text-gray-400 font-medium">YoY</th>
              <th className="text-right py-2 px-2 text-gray-400 font-medium">COGS</th>
              <th className="text-right py-2 px-2 text-gray-400 font-medium">Gross Profit</th>
              <th className="text-right py-2 px-2 text-gray-400 font-medium">Gross %</th>
              <th className="text-right py-2 px-2 text-gray-400 font-medium">R&D</th>
              <th className="text-right py-2 px-2 text-gray-400 font-medium">SG&A</th>
              <th className="text-right py-2 px-2 text-gray-400 font-medium">Op. Income</th>
              <th className="text-right py-2 px-2 text-gray-400 font-medium">Op. %</th>
              <th className="text-right py-2 px-2 text-gray-400 font-medium">Net Income</th>
              <th className="text-right py-2 px-2 text-gray-400 font-medium">Net %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const yoy = yoyMap[row.date];
              return (
                <tr key={row.date} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="py-1.5 px-3 text-gray-300 tabular-nums whitespace-nowrap">{fmtQtr(row.date)}</td>
                  <td className="py-1.5 px-2 text-right text-white tabular-nums font-medium">{fmtB(row.revenue)}</td>
                  <td className={`py-1.5 px-2 text-right tabular-nums text-[10px] ${yoy == null ? 'text-gray-600' : yoy >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {fmtPct(yoy)}
                  </td>
                  <td className="py-1.5 px-2 text-right text-red-400/80 tabular-nums">{fmtB(row.cogs)}</td>
                  <td className="py-1.5 px-2 text-right text-cyan-400 tabular-nums">{fmtB(row.gross)}</td>
                  <td className="py-1.5 px-2 text-right text-cyan-500/80 tabular-nums text-[10px]">{fmtMrg(row.gross_margin)}</td>
                  <td className="py-1.5 px-2 text-right text-yellow-400/80 tabular-nums">{fmtB(row.rd)}</td>
                  <td className="py-1.5 px-2 text-right text-orange-400/80 tabular-nums">{fmtB(row.sga)}</td>
                  <td className="py-1.5 px-2 text-right text-green-400 tabular-nums font-medium">{fmtB(row.op_income)}</td>
                  <td className="py-1.5 px-2 text-right text-green-500/80 tabular-nums text-[10px]">{fmtMrg(row.op_margin)}</td>
                  <td className="py-1.5 px-2 text-right text-violet-400 tabular-nums">{fmtB(row.net)}</td>
                  <td className="py-1.5 px-2 text-right text-violet-500/80 tabular-nums text-[10px]">{fmtMrg(row.net_margin)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // ── Subtitle ──────────────────────────────────────────────────────────────
  const subtitle = freq === 'annual'
    ? (annualData?.has_product || annualData?.has_geo
        ? `${annualData[segType]?.latest?.date?.slice(0, 10) || ''} · ${fmtB(annualData[segType]?.latest?.total)} · ${annualData[segType]?.segments?.length} segments`
        : 'No segment data')
    : (quarterlyData?.latest?.date
        ? `${fmtQtr(quarterlyData.latest.date)} · Revenue ${fmtB(quarterlyData.latest.revenue)}`
        : undefined);

  // ── View options per freq ─────────────────────────────────────────────────
  const viewOptions = freq === 'annual'
    ? [{ id: 'chart', label: 'Chart' }, { id: 'table', label: 'Table' }]
    : [{ id: 'pnl',   label: 'P&L Chart' }, { id: 'table', label: 'Table' }];

  return (
    <BaseWidget
      title={`Revenue Breakdown — ${symbol}`}
      subtitle={subtitle}
      icon={PieIcon}
      iconColor="text-cyan-400"
      loading={loading}
      onRefresh={freq === 'annual' ? fetchAnnual : fetchQuarterly}
      onRemove={onRemove}
      symbol={symbol}
      onSymbolChange={(s) => { setSymbol(s); }}
      source={freq === 'annual' ? 'Financial Modeling Prep' : 'Yahoo Finance'}
    >
      <div className="h-full flex flex-col">

        {/* ── Controls bar ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-800/50 flex-wrap">

          {/* Freq toggle */}
          <div className="flex rounded overflow-hidden border border-gray-700 text-[10px]">
            {[{ id: 'annual', label: 'Annual' }, { id: 'quarterly', label: 'Quarterly' }].map(({ id, label }) => (
              <button key={id} onClick={() => handleFreqChange(id)}
                className={`px-2.5 py-0.5 transition-colors ${
                  freq === id ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-gray-200'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* Segment type toggle — only in annual mode */}
          {freq === 'annual' && (
            <div className="flex rounded overflow-hidden border border-gray-700 text-[10px]">
              {[
                { id: 'product', label: 'Product',    disabled: !annualData?.has_product },
                { id: 'geo',     label: 'Geographic', disabled: !annualData?.has_geo },
              ].map(({ id, label, disabled }) => (
                <button key={id} onClick={() => !disabled && setSegType(id)} disabled={disabled}
                  className={`px-2 py-0.5 transition-colors ${
                    segType === id ? 'bg-gray-600 text-white'
                    : disabled ? 'text-gray-700 cursor-not-allowed'
                    : 'text-gray-400 hover:text-gray-200'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* View toggle */}
          <div className="flex rounded overflow-hidden border border-gray-700 text-[10px] ml-auto">
            {viewOptions.map(({ id, label }) => (
              <button key={id} onClick={() => setView(id)}
                className={`px-2 py-0.5 transition-colors ${
                  view === id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Quarterly note */}
        {freq === 'quarterly' && (
          <div className="px-3 py-1 text-[9px] text-gray-600 border-b border-gray-800/30">
            분기별 P&L 구성 · Revenue = COGS + SG&A + R&D + Operating Income · 우측 y축: 마진율
          </div>
        )}

        {/* ── Content area ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden p-2">
          {error ? (
            <div className="flex items-center justify-center h-full text-red-400 text-xs">{error}</div>
          ) : freq === 'annual' ? (
            !annualData || (!annualData.has_product && !annualData.has_geo)
              ? <NoData msg="No segment data available for this symbol" />
              : view === 'chart' ? renderAnnualChart()
              : renderAnnualTable()
          ) : (
            view === 'pnl' ? renderPnlChart() : renderQtrTable()
          )}
        </div>
      </div>
    </BaseWidget>
  );
}

function NoData({ msg = 'No data' }) {
  return (
    <div className="flex items-center justify-center h-full text-gray-600 text-xs">{msg}</div>
  );
}
