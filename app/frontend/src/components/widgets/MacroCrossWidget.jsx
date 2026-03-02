/**
 * MacroCrossWidget - Macro impact on individual stock based on sector
 */
import { useState, useEffect, useCallback } from 'react';
import { Globe } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import WidgetTable from './common/WidgetTable';
import { API_BASE } from './constants';

// Sector → relevant macro indicators
const SECTOR_MACRO_MAP = {
  Technology:           ['FED_FUNDS_RATE', 'CPI', 'INDUSTRIAL_PRODUCTION'],
  'Financial Services': ['FED_FUNDS_RATE', 'CPI', 'UNEMPLOYMENT'],
  Financials:           ['FED_FUNDS_RATE', 'CPI', 'UNEMPLOYMENT'],
  Energy:               ['CPI', 'INDUSTRIAL_PRODUCTION', 'GDP'],
  Healthcare:           ['CPI', 'UNEMPLOYMENT', 'GDP'],
  'Consumer Cyclical':  ['RETAIL_SALES', 'CONSUMER_SENTIMENT', 'UNEMPLOYMENT'],
  'Consumer Defensive': ['CPI', 'RETAIL_SALES', 'UNEMPLOYMENT'],
  Industrials:          ['INDUSTRIAL_PRODUCTION', 'GDP', 'NONFARM_PAYROLL'],
  'Basic Materials':    ['CPI', 'INDUSTRIAL_PRODUCTION', 'GDP'],
  'Real Estate':        ['FED_FUNDS_RATE', 'HOUSING_STARTS', 'CPI'],
  Utilities:            ['FED_FUNDS_RATE', 'CPI', 'INDUSTRIAL_PRODUCTION'],
  'Communication Services': ['CPI', 'CONSUMER_SENTIMENT', 'GDP'],
};

const INDICATOR_META = {
  FED_FUNDS_RATE:       { label: 'Fed Funds Rate',       unit: '%',    impact: { Technology: 'Negative', Financials: 'Positive', 'Real Estate': 'Negative' } },
  CPI:                  { label: 'Inflation (CPI)',       unit: 'Index', impact: { Energy: 'Positive', 'Consumer Cyclical': 'Negative' } },
  GDP:                  { label: 'GDP',                   unit: 'B$',   impact: {} },
  UNEMPLOYMENT:         { label: 'Unemployment Rate',    unit: '%',    impact: { 'Consumer Cyclical': 'Negative', Financials: 'Negative' } },
  RETAIL_SALES:         { label: 'Retail Sales',          unit: 'B$',   impact: { 'Consumer Cyclical': 'Positive', 'Consumer Defensive': 'Positive' } },
  CONSUMER_SENTIMENT:   { label: 'Consumer Sentiment',   unit: 'Index', impact: { 'Consumer Cyclical': 'Positive' } },
  NONFARM_PAYROLL:      { label: 'Nonfarm Payroll',       unit: 'K',    impact: { Industrials: 'Positive' } },
  HOUSING_STARTS:       { label: 'Housing Starts',        unit: 'K',    impact: { 'Real Estate': 'Positive' } },
  INDUSTRIAL_PRODUCTION:{ label: 'Industrial Production',unit: 'Index', impact: { Industrials: 'Positive', Energy: 'Positive' } },
};

const IMPACT_TEXT = {
  Positive: 'text-green-400',
  Negative: 'text-red-400',
  Neutral:  'text-gray-400',
};

const TABLE_COLS = [
  { key: 'label', header: 'Indicator', sortable: true },
  { key: 'value', header: 'Latest', align: 'right', sortable: true },
  { key: 'unit',  header: 'Unit',   align: 'center' },
  {
    key: 'impact', header: 'Impact', align: 'center',
    render: r => (
      <span className={`text-[9px] font-medium ${IMPACT_TEXT[r.impact] || IMPACT_TEXT.Neutral}`}>
        {r.impact}
      </span>
    )
  },
];

export default function MacroCrossWidget({ symbol, onRemove }) {
  const [info, setInfo] = useState(null);
  const [indicators, setIndicators] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('table');
  const [selectedIndicator, setSelectedIndicator] = useState(null);

  const load = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      // Get sector from company info
      const infoRes = await fetch(`${API_BASE}/stock/info/${symbol}`);
      const infoData = infoRes.ok ? await infoRes.json() : {};
      setInfo(infoData);

      const sector = infoData.sector || 'Technology';
      const macroKeys = SECTOR_MACRO_MAP[sector] || SECTOR_MACRO_MAP.Technology;

      // Fetch latest value for each indicator
      const results = await Promise.allSettled(
        macroKeys.map(key =>
          fetch(`${API_BASE}/stock/indicator/${key}?period=1y`).then(r => r.json()).then(d => ({ key, data: d }))
        )
      );

      const rows = [];
      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        const { key, data } = r.value;
        const meta = INDICATOR_META[key] || { label: key, unit: '', impact: {} };
        const history = data?.data || [];
        const latest = history.length > 0 ? history[history.length - 1] : null;

        rows.push({
          key,
          label: meta.label,
          value: latest ? Number(latest.value).toFixed(2) : 'N/A',
          unit: meta.unit,
          impact: meta.impact[sector] || 'Neutral',
          history,
        });
      }

      setIndicators(rows);
      if (rows.length > 0 && !selectedIndicator) {
        setSelectedIndicator(rows[0].key);
      }
    } catch (e) {
      console.error('MacroCrossWidget error:', e);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { load(); }, [load]);

  // Build chart data when selected indicator changes
  useEffect(() => {
    const ind = indicators.find(i => i.key === selectedIndicator);
    if (ind) setChartData(ind.history || []);
  }, [selectedIndicator, indicators]);

  const sector = info?.sector || '—';

  return (
    <BaseWidget
      title="Macro Cross Analysis"
      icon={Globe}
      iconColor="text-orange-400"
      loading={loading}
      onRefresh={load}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
      source="FRED"
    >
      <div className="px-3 py-1.5 border-b border-gray-800 flex items-center gap-2">
        <span className="text-[10px] text-gray-500">Sector:</span>
        <span className="text-[11px] text-cyan-400 font-medium">{sector}</span>
      </div>

      <div className="flex border-b border-gray-800 px-3 pt-1">
        {[{ id: 'table', label: 'Impact Table' }, { id: 'chart', label: 'Chart' }].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-[11px] font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-orange-400 text-orange-400' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-3">
        {tab === 'table' && (
          indicators.length > 0
            ? <WidgetTable columns={TABLE_COLS} rows={indicators} resizable />
            : <div className="text-center text-gray-500 text-xs py-8">No macro data available</div>
        )}

        {tab === 'chart' && (
          <div className="h-full flex flex-col space-y-2">
            {/* Indicator selector */}
            <div className="flex flex-wrap gap-1.5 flex-shrink-0">
              {indicators.map(ind => (
                <button
                  key={ind.key}
                  onClick={() => setSelectedIndicator(ind.key)}
                  className={`px-2 py-0.5 text-[10px] transition-colors ${
                    selectedIndicator === ind.key ? 'text-orange-400' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {ind.label}
                </button>
              ))}
            </div>
            {(() => {
              const bars = chartData.slice(-15);
              if (bars.length === 0) return <div className="text-center text-gray-500 text-xs py-8">Select an indicator</div>;
              const vals = bars.map(b => Math.abs(Number(b.value) || 0));
              const maxVal = Math.max(...vals, 1);
              return (
                <div className="flex flex-col flex-1 min-h-0">
                  <div className="flex justify-around mb-1">
                    {bars.map((b, i) => (
                      <span key={i} className="text-[7px] font-medium tabular-nums flex-1 text-center text-orange-400 leading-tight">
                        {Number(b.value || 0).toFixed(1)}
                      </span>
                    ))}
                  </div>
                  <div className="flex-1 flex items-end justify-around gap-0.5 min-h-0">
                    {bars.map((b, i) => {
                      const pct = Math.abs(Number(b.value) || 0) / maxVal * 100;
                      return (
                        <div key={i} className="flex-1 flex justify-center items-end h-full">
                          <div
                            className="w-full rounded-t transition-all duration-700"
                            style={{ height: `${pct}%`, backgroundColor: '#f97316', minHeight: '2px', maxWidth: '14px' }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-around border-t border-gray-800 pt-1.5 mt-1">
                    {bars.map((b, i) => (
                      <span key={i} className="text-[6px] text-gray-600 text-center flex-1 leading-tight truncate">
                        {b.date ? b.date.slice(2, 7) : ''}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
