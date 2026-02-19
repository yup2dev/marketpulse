/**
 * Estimates Tab - Analyst estimates with category tabs
 * Matches ComparisonAnalysisTab layout: header bar, category tabs, chart + table
 */
import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { RefreshCw } from 'lucide-react';
import { API_BASE } from '../../config/api';
import { formatCurrency } from '../../utils/widgetUtils';
import ChartWidget from '../widgets/ChartWidget';

const TABS = [
  { id: 'overview', name: 'Overview' },
  { id: 'eps', name: 'EPS' },
  { id: 'revenue', name: 'Revenue' },
  { id: 'revisions', name: 'Revisions' },
];

const PERIOD_ORDER = ['Current Quarter', 'Next Quarter', 'Current Year', 'Next Year'];

const getRatingColor = (rating) => {
  const r = (rating || '').toLowerCase();
  if (r.includes('buy') || r.includes('overweight')) return 'text-green-400';
  if (r.includes('sell') || r.includes('underweight')) return 'text-red-400';
  return 'text-yellow-400';
};

const fmtEps = (v) => v != null ? `$${v.toFixed(2)}` : '—';
const fmtGrowth = (v) => v != null ? `${(v * 100).toFixed(1)}%` : '—';

// Custom tooltip for bar charts
function ChartTooltip({ active, payload, label, isCurrency }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1f] border border-gray-700 rounded-lg px-3 py-2 text-xs">
      <div className="text-gray-400 mb-1">{label}</div>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-300">{entry.name}:</span>
          <span className="text-white font-medium tabular-nums">
            {isCurrency ? formatCurrency(entry.value) : fmtEps(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// Builds chart data array from estimates keyed by period
function buildChartData(estimates) {
  if (!estimates) return [];
  return PERIOD_ORDER
    .filter(p => estimates[p])
    .map(p => ({
      period: p.replace('Current ', 'Cur ').replace('Next ', 'Next '),
      estimate: estimates[p].estimate,
      yearAgo: estimates[p].year_ago,
    }));
}

// ── Overview Tab ─────────────────────────────────────────────
function OverviewContent({ analystData, symbol }) {
  const pt = analystData?.price_target || {};
  const targetPrice = pt.mean || pt.average;

  const priceTargetLines = useMemo(() => {
    if (!pt.low && !targetPrice && !pt.high) return null;
    const lines = [];
    if (pt.low) lines.push({ y: pt.low, color: '#ef4444', label: `Low $${pt.low.toFixed(0)}`, dashed: true });
    if (targetPrice) lines.push({ y: targetPrice, color: '#22d3ee', label: `Target $${targetPrice.toFixed(0)}`, dashed: false });
    if (pt.high) lines.push({ y: pt.high, color: '#22c55e', label: `High $${pt.high.toFixed(0)}`, dashed: true });
    return lines;
  }, [pt.low, targetPrice, pt.high]);

  const analystPoints = useMemo(() => {
    const analysts = analystData?.analysts;
    if (!analysts || analysts.length === 0) return null;
    const ratingColor = (rating) => {
      const r = (rating || '').toLowerCase();
      if (r.includes('buy') || r.includes('outperform') || r.includes('overweight')) return '#22c55e';
      if (r.includes('sell') || r.includes('underweight') || r.includes('underperform')) return '#ef4444';
      return '#eab308';
    };
    const actionLabel = (action) => {
      if (action === 'upgrade') return '\u2191';
      if (action === 'downgrade') return '\u2193';
      return '\u2022';
    };
    return analysts
      .filter(a => a.date)
      .map(a => {
        const lines = [a.name];
        if (a.firm) lines.push(a.firm);
        lines.push(`${a.rating || 'N/A'}${a.prev_rating ? ` ← ${a.prev_rating}` : ''}`);
        if (a.target_price) lines.push(`PT: $${a.target_price}`);
        lines.push(a.date);
        return {
          x: a.date,
          y: null,
          color: ratingColor(a.rating),
          tooltip: lines.join('\n'),
          label: `${actionLabel(a.action)} ${a.name}`,
        };
      });
  }, [analystData?.analysts]);

  if (!symbol) return null;

  return (
    <ChartWidget
      widgetId={`estimates-overview-${symbol}`}
      initialSymbols={[symbol]}
      showAddStock={false}
      showPairAnalysis={false}
      showNormalize={false}
      showVolume={false}
      showTechnicalIndicators={false}
      showChartTypeSelector={false}
      referenceLines={priceTargetLines}
      referencePoints={analystPoints}
    />
  );
}

// ── EPS Tab ──────────────────────────────────────────────────
function EPSContent({ estimatesData }) {
  const epsData = buildChartData(estimatesData?.eps);
  const eps = estimatesData?.eps || {};

  return (
    <div className="flex flex-col">
      {/* Chart */}
      <div className="p-4">
        {epsData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={epsData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={50} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="estimate" name="Estimate" fill="#34d399" radius={[3, 3, 0, 0]} />
              <Bar dataKey="yearAgo" name="Year Ago" fill="#6b7280" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-gray-500 text-xs">No EPS data</div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0d0d12] z-10">
            <tr className="border-b border-gray-800">
              <th className="text-left py-2.5 px-4 text-gray-400 font-medium">Period</th>
              <th className="text-right py-2.5 px-4 text-gray-400 font-medium">Estimate</th>
              <th className="text-right py-2.5 px-4 text-gray-400 font-medium">Low</th>
              <th className="text-right py-2.5 px-4 text-gray-400 font-medium">High</th>
              <th className="text-right py-2.5 px-4 text-gray-400 font-medium">Year Ago</th>
              <th className="text-right py-2.5 px-4 text-gray-400 font-medium">Growth</th>
              <th className="text-right py-2.5 px-4 text-gray-400 font-medium">Analysts</th>
            </tr>
          </thead>
          <tbody>
            {PERIOD_ORDER.filter(p => eps[p]).map(period => {
              const d = eps[period];
              return (
                <tr key={period} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="py-2.5 px-4 text-white">{period}</td>
                  <td className="py-2.5 px-4 text-right text-white tabular-nums">{fmtEps(d.estimate)}</td>
                  <td className="py-2.5 px-4 text-right text-gray-400 tabular-nums">{fmtEps(d.low)}</td>
                  <td className="py-2.5 px-4 text-right text-gray-400 tabular-nums">{fmtEps(d.high)}</td>
                  <td className="py-2.5 px-4 text-right text-gray-400 tabular-nums">{fmtEps(d.year_ago)}</td>
                  <td className={`py-2.5 px-4 text-right tabular-nums ${d.growth != null ? (d.growth >= 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-500'}`}>
                    {fmtGrowth(d.growth)}
                  </td>
                  <td className="py-2.5 px-4 text-right text-gray-400 tabular-nums">{d.num_analysts ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {Object.keys(eps).length === 0 && (
          <div className="text-center py-8 text-gray-500 text-xs">No EPS estimates available</div>
        )}
      </div>
    </div>
  );
}

// ── Revenue Tab ──────────────────────────────────────────────
function RevenueContent({ estimatesData }) {
  const revData = buildChartData(estimatesData?.revenue);
  const rev = estimatesData?.revenue || {};

  return (
    <div className="flex flex-col">
      {/* Chart */}
      <div className="p-4">
        {revData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={55}
                tickFormatter={(v) => v >= 1e9 ? `${(v/1e9).toFixed(0)}B` : v >= 1e6 ? `${(v/1e6).toFixed(0)}M` : v} />
              <Tooltip content={<ChartTooltip isCurrency />} />
              <Bar dataKey="estimate" name="Estimate" fill="#60a5fa" radius={[3, 3, 0, 0]} />
              <Bar dataKey="yearAgo" name="Year Ago" fill="#6b7280" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-gray-500 text-xs">No revenue data</div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0d0d12] z-10">
            <tr className="border-b border-gray-800">
              <th className="text-left py-2.5 px-4 text-gray-400 font-medium">Period</th>
              <th className="text-right py-2.5 px-4 text-gray-400 font-medium">Estimate</th>
              <th className="text-right py-2.5 px-4 text-gray-400 font-medium">Low</th>
              <th className="text-right py-2.5 px-4 text-gray-400 font-medium">High</th>
              <th className="text-right py-2.5 px-4 text-gray-400 font-medium">Year Ago</th>
              <th className="text-right py-2.5 px-4 text-gray-400 font-medium">Growth</th>
              <th className="text-right py-2.5 px-4 text-gray-400 font-medium">Analysts</th>
            </tr>
          </thead>
          <tbody>
            {PERIOD_ORDER.filter(p => rev[p]).map(period => {
              const d = rev[period];
              return (
                <tr key={period} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="py-2.5 px-4 text-white">{period}</td>
                  <td className="py-2.5 px-4 text-right text-white tabular-nums">{formatCurrency(d.estimate)}</td>
                  <td className="py-2.5 px-4 text-right text-gray-400 tabular-nums">{formatCurrency(d.low)}</td>
                  <td className="py-2.5 px-4 text-right text-gray-400 tabular-nums">{formatCurrency(d.high)}</td>
                  <td className="py-2.5 px-4 text-right text-gray-400 tabular-nums">{formatCurrency(d.year_ago)}</td>
                  <td className={`py-2.5 px-4 text-right tabular-nums ${d.growth != null ? (d.growth >= 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-500'}`}>
                    {fmtGrowth(d.growth)}
                  </td>
                  <td className="py-2.5 px-4 text-right text-gray-400 tabular-nums">{d.num_analysts ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {Object.keys(rev).length === 0 && (
          <div className="text-center py-8 text-gray-500 text-xs">No revenue estimates available</div>
        )}
      </div>
    </div>
  );
}

// ── Revisions Tab ────────────────────────────────────────────
function RevisionsContent({ estimatesData }) {
  const revisions = estimatesData?.revisions || {};

  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-[#0d0d12] z-10">
          <tr className="border-b border-gray-800">
            <th className="text-left py-2.5 px-4 text-gray-400 font-medium">Period</th>
            <th className="text-right py-2.5 px-4 text-green-400/70 font-medium">Up (7d)</th>
            <th className="text-right py-2.5 px-4 text-green-400/70 font-medium">Up (30d)</th>
            <th className="text-right py-2.5 px-4 text-red-400/70 font-medium">Down (7d)</th>
            <th className="text-right py-2.5 px-4 text-red-400/70 font-medium">Down (30d)</th>
          </tr>
        </thead>
        <tbody>
          {PERIOD_ORDER.filter(p => revisions[p]).map(period => {
            const d = revisions[period];
            return (
              <tr key={period} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="py-2.5 px-4 text-white">{period}</td>
                <td className="py-2.5 px-4 text-right text-green-400 tabular-nums">{d.up_last_7_days ?? '—'}</td>
                <td className="py-2.5 px-4 text-right text-green-400 tabular-nums">{d.up_last_30_days ?? '—'}</td>
                <td className="py-2.5 px-4 text-right text-red-400 tabular-nums">{d.down_last_7_days ?? '—'}</td>
                <td className="py-2.5 px-4 text-right text-red-400 tabular-nums">{d.down_last_30_days ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {Object.keys(revisions).length === 0 && (
        <div className="text-center py-8 text-gray-500 text-xs">No revision data available</div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────
const EstimatesTab = ({ symbol: initialSymbol }) => {
  const [symbol] = useState(initialSymbol || 'AAPL');
  const [activeTab, setActiveTab] = useState('overview');
  const [estimatesData, setEstimatesData] = useState(null);
  const [analystData, setAnalystData] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (symbol) loadData();
  }, [symbol]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [estimatesRes, analystRes, quoteRes] = await Promise.all([
        fetch(`${API_BASE}/stock/estimates/${symbol}`),
        fetch(`${API_BASE}/stock/analyst/${symbol}`),
        fetch(`${API_BASE}/stock/quote/${symbol}`)
      ]);
      if (estimatesRes.ok) setEstimatesData(await estimatesRes.json());
      if (analystRes.ok) setAnalystData(await analystRes.json());
      if (quoteRes.ok) {
        const data = await quoteRes.json();
        setCurrentPrice(data.price);
      }
    } catch (error) {
      console.error('Error loading estimates data:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return <OverviewContent analystData={analystData} symbol={symbol} />;
      case 'eps':
        return <EPSContent estimatesData={estimatesData} />;
      case 'revenue':
        return <RevenueContent estimatesData={estimatesData} />;
      case 'revisions':
        return <RevisionsContent estimatesData={estimatesData} />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-white">Analyst Estimates</h3>
          <span className="px-2 py-0.5 bg-gray-800 rounded text-xs text-cyan-400 font-medium">{symbol}</span>
        </div>
        <button
          onClick={loadData}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded transition-colors ${
              activeTab === tab.id
                ? 'text-cyan-400 bg-cyan-400/10'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
};

export default EstimatesTab;
export { EstimatesTab as EstimatesTabWidget };
