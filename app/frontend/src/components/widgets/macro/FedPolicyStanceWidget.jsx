/**
 * Fed Policy Stance Widget - Shows Fed stance, probabilities, and key signals
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Landmark } from 'lucide-react';
import CommonChart from '../../common/CommonChart';
import BaseWidget from '../common/BaseWidget';
import CommonTable from '../../common/CommonTable';
import { API_BASE } from '../../../config/api';

const STANCE_BADGE = {
  hawkish: { label: 'HAWKISH', cls: 'bg-red-500/20 text-red-400 border-red-500/30'       },
  dovish:  { label: 'DOVISH',  cls: 'bg-green-500/20 text-green-400 border-green-500/30'  },
  neutral: { label: 'NEUTRAL', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
};

const PROB_COLORS = { Hike: '#ef4444', Hold: '#eab308', Cut: '#22c55e' };

const METRIC_COLUMNS = [
  {
    key: 'metric',
    header: 'Metric',
    sortable: true,
    renderFn: (value, row) => <span className="text-gray-300">{row.metric}</span>,
  },
  {
    key: 'value',
    header: 'Value',
    align: 'right',
    sortable: false,
    renderFn: (value, row) => <span className="text-white tabular-nums">{row.value}</span>,
  },
  {
    key: 'signal',
    header: 'Signal',
    align: 'right',
    sortable: false,
    renderFn: (value, row) => {
      if (!row.signal) return <span className="text-gray-500">-</span>;
      const badge = STANCE_BADGE[row.signal];
      return badge ? (
        <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${badge.cls}`}>
          {badge.label}
        </span>
      ) : <span className="text-gray-500">-</span>;
    },
  },
];

export default function FedPolicyStanceWidget({ onRemove }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('chart');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/fed-policy/stance`);
      if (res.ok) setData(await res.json());
    } catch (error) {
      console.error('Error loading Fed policy data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const metricsData = useMemo(() => {
    if (!data) return [];
    const targetRange = data.fed_funds_target_range || data.target_range;
    const probs = data.next_meeting?.probabilities;
    const hist  = data.historical_context;
    const rows  = [];

    if (data.fed_funds_rate != null)
      rows.push({ _key: 'ffr',    metric: 'Fed Funds Rate',      value: `${data.fed_funds_rate.toFixed(2)}%` });
    if (targetRange)
      rows.push({ _key: 'range',  metric: 'Target Range',        value: `${targetRange.lower?.toFixed(2)}% – ${targetRange.upper?.toFixed(2)}%` });
    if (data.next_meeting?.date)
      rows.push({ _key: 'next',   metric: 'Next FOMC Meeting',   value: data.next_meeting.date });
    if (probs?.hike != null)
      rows.push({ _key: 'hike',   metric: 'Hike Probability',    value: `${(probs.hike * 100).toFixed(0)}%`, signal: 'hawkish' });
    if (probs?.hold != null)
      rows.push({ _key: 'hold',   metric: 'Hold Probability',    value: `${(probs.hold * 100).toFixed(0)}%`, signal: 'neutral' });
    if (probs?.cut != null)
      rows.push({ _key: 'cut',    metric: 'Cut Probability',     value: `${(probs.cut * 100).toFixed(0)}%`, signal: 'dovish' });
    if (hist?.rate_changes_12m != null)
      rows.push({ _key: 'chg',    metric: 'Rate Changes (12M)',  value: String(hist.rate_changes_12m) });
    if (hist?.peak_rate != null)
      rows.push({ _key: 'peak',   metric: 'Peak Rate (Cycle)',   value: `${Number(hist.peak_rate).toFixed(2)}%` });
    if (hist?.trough_rate != null)
      rows.push({ _key: 'trough', metric: 'Trough Rate (Cycle)', value: `${Number(hist.trough_rate).toFixed(2)}%` });
    return rows;
  }, [data]);

  const factors = data?.key_factors || [];

  const renderChart = () => {
    if (!data) return null;
    const probs = data.next_meeting?.probabilities;
    if (!probs) return <div className="flex items-center justify-center h-full text-gray-500 text-sm">No probability data</div>;

    const chartData = [
      { name: 'Hike', value: (probs.hike || 0) * 100 },
      { name: 'Hold', value: (probs.hold || 0) * 100 },
      { name: 'Cut',  value: (probs.cut  || 0) * 100 },
    ];

    const stanceBadge = STANCE_BADGE[data.stance] || STANCE_BADGE.neutral;
    const targetRange  = data.fed_funds_target_range || data.target_range;

    const chartSeries = chartData.map(d => ({
      key: d.name,
      name: d.name,
      color: PROB_COLORS[d.name] || '#6b7280',
    }));
    // Pivot chartData into single object for CommonChart bar
    const pivotedData = [chartData.reduce((acc, d) => { acc[d.name] = d.value; return acc; }, {})];

    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-3 px-1 pb-2 flex-shrink-0">
          {data.stance && (
            <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${stanceBadge.cls}`}>
              {stanceBadge.label}
            </span>
          )}
          {data.fed_funds_rate != null && (
            <span className="text-xs text-gray-400">
              FFR: <span className="text-white font-medium">{data.fed_funds_rate.toFixed(2)}%</span>
            </span>
          )}
          {targetRange && (
            <span className="text-xs text-gray-400">
              Range: <span className="text-white">{targetRange.lower?.toFixed(2)}% – {targetRange.upper?.toFixed(2)}%</span>
            </span>
          )}
          {data.next_meeting?.date && (
            <span className="text-xs text-gray-400">
              Next: <span className="text-white">{data.next_meeting.date}</span>
            </span>
          )}
        </div>
        <div className="flex-1 min-h-0">
          <CommonChart
            data={chartData}
            series={[{ key: 'value', name: 'Probability', color: '#60a5fa' }]}
            xKey="name"
            type="bar"
            fillContainer={true}
            showTypeSelector={false}
            yFormatter={(v) => `${v}%`}
            tooltipFormatter={(v, name, item) => `${item?.payload?.name || name}: ${Number(v).toFixed(1)}%`}
          />
        </div>
      </div>
    );
  };

  const renderTable = () => {
    if (!data) return null;
    return (
      <div className="h-full flex flex-col overflow-auto">
        <CommonTable
          columns={METRIC_COLUMNS}
          data={metricsData}
          compact={true}
          searchable={false}
          exportable={false}
          pageSize={20}
        />
        {factors.length > 0 && (
          <div className="border-t border-gray-800 shrink-0">
            <div className="px-3 py-2 text-xs text-gray-400">Key Factors</div>
            <div className="px-3 pb-3 flex flex-col gap-1">
              {factors.map((f, idx) => {
                const label  = typeof f === 'string' ? f : f.name || f.factor || '-';
                const impact = typeof f === 'object' ? (f.impact || f.direction || '') : '';
                const color  = impact === 'hawkish' || impact === 'tightening' ? 'text-red-400'
                  : impact === 'dovish' || impact === 'easing' ? 'text-green-400' : 'text-yellow-400';
                return (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-white">{label}</span>
                    {impact ? <span className={color}>{impact}</span> : <span className="text-gray-500">-</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <BaseWidget
      title="Fed Policy Stance"
      icon={Landmark}
      iconColor="text-blue-400"
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      showPeriodSelector={false}
      source="Federal Reserve / CME FedWatch"
    >
      <div className="h-full p-3">
        {viewMode === 'chart' ? renderChart() : renderTable()}
      </div>
    </BaseWidget>
  );
}
