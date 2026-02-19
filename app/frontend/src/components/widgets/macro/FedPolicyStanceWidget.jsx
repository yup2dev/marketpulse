/**
 * Fed Policy Stance Widget - Shows Fed stance, probabilities, and key signals
 * Uses BaseWidget for common functionality
 */
import { useState, useEffect, useCallback } from 'react';
import { Landmark } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import BaseWidget from '../common/BaseWidget';
import { API_BASE } from '../../../config/api';

const STANCE_BADGE = {
  hawkish: { label: 'HAWKISH', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  dovish: { label: 'DOVISH', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  neutral: { label: 'NEUTRAL', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
};

const PROB_COLORS = { Hike: '#ef4444', Hold: '#eab308', Cut: '#22c55e' };

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-[#1a1a1f] border border-gray-700 rounded px-3 py-2 shadow-lg">
        <p className="text-sm" style={{ color: PROB_COLORS[d.name] || '#fff' }}>
          {d.name}: {d.value.toFixed(1)}%
        </p>
      </div>
    );
  }
  return null;
};

export default function FedPolicyStanceWidget({ onRemove }) {
  const [data, setData] = useState(null);
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

  const renderChart = () => {
    if (!data) return null;
    const probs = data.next_meeting?.probabilities;
    if (!probs) return <div className="flex items-center justify-center h-full text-gray-500 text-sm">No probability data</div>;

    const chartData = [
      { name: 'Hike', value: (probs.hike || 0) * 100 },
      { name: 'Hold', value: (probs.hold || 0) * 100 },
      { name: 'Cut', value: (probs.cut || 0) * 100 },
    ];

    const stanceBadge = STANCE_BADGE[data.stance] || STANCE_BADGE.neutral;
    const targetRange = data.fed_funds_target_range || data.target_range;

    return (
      <div className="h-full flex flex-col">
        {/* Header strip */}
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
        {/* Chart */}
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={{ stroke: '#374151' }} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={PROB_COLORS[entry.name]} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderTable = () => {
    if (!data) return null;
    const targetRange = data.fed_funds_target_range || data.target_range;
    const probs = data.next_meeting?.probabilities;
    const hist = data.historical_context;

    const rows = [];
    if (data.fed_funds_rate != null)
      rows.push({ metric: 'Fed Funds Rate', value: `${data.fed_funds_rate.toFixed(2)}%` });
    if (targetRange)
      rows.push({ metric: 'Target Range', value: `${targetRange.lower?.toFixed(2)}% – ${targetRange.upper?.toFixed(2)}%` });
    if (data.next_meeting?.date)
      rows.push({ metric: 'Next FOMC Meeting', value: data.next_meeting.date });
    if (probs?.hike != null)
      rows.push({ metric: 'Hike Probability', value: `${(probs.hike * 100).toFixed(0)}%`, signal: 'hawkish' });
    if (probs?.hold != null)
      rows.push({ metric: 'Hold Probability', value: `${(probs.hold * 100).toFixed(0)}%`, signal: 'neutral' });
    if (probs?.cut != null)
      rows.push({ metric: 'Cut Probability', value: `${(probs.cut * 100).toFixed(0)}%`, signal: 'dovish' });
    if (hist?.rate_changes_12m != null)
      rows.push({ metric: 'Rate Changes (12M)', value: String(hist.rate_changes_12m) });
    if (hist?.peak_rate != null)
      rows.push({ metric: 'Peak Rate (Cycle)', value: `${Number(hist.peak_rate).toFixed(2)}%` });
    if (hist?.trough_rate != null)
      rows.push({ metric: 'Trough Rate (Cycle)', value: `${Number(hist.trough_rate).toFixed(2)}%` });

    const factors = data.key_factors || [];

    return (
      <div className="overflow-auto h-full">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0d0d12]">
            <tr className="border-b border-gray-800">
              <th className="text-left py-2 px-3 text-gray-400 font-medium">Metric</th>
              <th className="text-right py-2 px-3 text-gray-400 font-medium">Value</th>
              <th className="text-right py-2 px-3 text-gray-400 font-medium">Signal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const badge = row.signal ? STANCE_BADGE[row.signal] : null;
              return (
                <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 px-3 text-gray-300">{row.metric}</td>
                  <td className="py-2 px-3 text-right text-white tabular-nums">{row.value}</td>
                  <td className="py-2 px-3 text-right">
                    {badge ? (
                      <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${badge.cls}`}>
                        {badge.label}
                      </span>
                    ) : <span className="text-gray-500">-</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {factors.length > 0 && (
          <>
            <div className="px-3 py-2 text-xs text-gray-400 border-t border-gray-800">Key Factors</div>
            <table className="w-full text-xs">
              <tbody>
                {factors.map((f, idx) => {
                  const label = typeof f === 'string' ? f : f.name || f.factor || '-';
                  const impact = typeof f === 'object' ? (f.impact || f.direction || '') : '';
                  const color = impact === 'hawkish' || impact === 'tightening' ? 'text-red-400'
                    : impact === 'dovish' || impact === 'easing' ? 'text-green-400' : 'text-yellow-400';
                  return (
                    <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-2 px-3 text-white">{label}</td>
                      <td className="py-2 px-3 text-right">
                        {impact ? <span className={color}>{impact}</span> : <span className="text-gray-500">-</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
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
