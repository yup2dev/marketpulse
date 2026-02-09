/**
 * Macro Fed Policy Tab - Terminal/WidgetTable design
 * API: /macro/fed-policy/stance
 */
import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { API_BASE } from '../../config/api';
import WidgetTable from '../widgets/common/WidgetTable';

const STANCE_BADGE = {
  hawkish: { label: 'HAWKISH', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  dovish: { label: 'DOVISH', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  neutral: { label: 'NEUTRAL', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
};

export default function MacroFedPolicyTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/fed-policy/stance`);
      if (res.ok) setData(await res.json());
    } catch (error) {
      console.error('Error loading Fed policy data:', error);
    } finally {
      setLoading(false);
    }
  };

  const targetRange = data?.fed_funds_target_range || data?.target_range;
  const nextMeeting = data?.next_meeting;
  const probabilities = nextMeeting?.probabilities;
  const historicalCtx = data?.historical_context;
  const stanceBadge = STANCE_BADGE[data?.stance] || STANCE_BADGE.neutral;

  // Key factors table
  const factorsColumns = useMemo(() => [
    {
      key: 'factor',
      header: 'Factor',
      minWidth: '200px',
      render: (row) => <span className="text-white">{row.label}</span>,
    },
    {
      key: 'impact',
      header: 'Impact',
      align: 'right',
      minWidth: '100px',
      render: (row) => {
        if (!row.impact) return <span className="text-gray-500">-</span>;
        const color = row.impact === 'hawkish' || row.impact === 'tightening'
          ? 'text-red-400' : row.impact === 'dovish' || row.impact === 'easing'
          ? 'text-green-400' : 'text-yellow-400';
        return <span className={color}>{row.impact}</span>;
      },
    },
  ], []);

  const factorsData = useMemo(() => {
    if (!data?.key_factors) return [];
    return data.key_factors.map((f, idx) => ({
      _key: `factor-${idx}`,
      label: typeof f === 'string' ? f : f.name || f.factor || '-',
      impact: typeof f === 'object' ? (f.impact || f.direction || '') : '',
    }));
  }, [data?.key_factors]);

  // Signals table - build from available data
  const signalsColumns = useMemo(() => [
    {
      key: 'metric',
      header: 'Metric',
      minWidth: '180px',
      render: (row) => <span className="text-white">{row.metric}</span>,
    },
    {
      key: 'value',
      header: 'Value',
      align: 'right',
      minWidth: '100px',
      sortable: true,
      sortValue: (row) => row.rawValue,
      render: (row) => <span className="text-white tabular-nums">{row.display}</span>,
    },
    {
      key: 'signal',
      header: 'Signal',
      align: 'right',
      minWidth: '100px',
      render: (row) => {
        if (!row.signal) return <span className="text-gray-500">-</span>;
        const badge = STANCE_BADGE[row.signal] || { label: row.signal.toUpperCase(), cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
        return (
          <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${badge.cls}`}>
            {badge.label}
          </span>
        );
      },
    },
  ], []);

  const signalsData = useMemo(() => {
    if (!data) return [];
    const rows = [];
    if (data.fed_funds_rate != null) {
      rows.push({
        _key: 'ffr',
        metric: 'Fed Funds Rate',
        rawValue: data.fed_funds_rate,
        display: `${data.fed_funds_rate.toFixed(2)}%`,
      });
    }
    if (targetRange) {
      rows.push({
        _key: 'target',
        metric: 'Target Range',
        rawValue: targetRange.upper,
        display: `${targetRange.lower?.toFixed(2) || '-'}% - ${targetRange.upper?.toFixed(2) || '-'}%`,
      });
    }
    if (nextMeeting?.date) {
      rows.push({
        _key: 'meeting',
        metric: 'Next FOMC Meeting',
        rawValue: 0,
        display: nextMeeting.date,
      });
    }
    if (probabilities) {
      if (probabilities.hike != null) {
        rows.push({ _key: 'prob-hike', metric: 'Hike Probability', rawValue: probabilities.hike, display: `${(probabilities.hike * 100).toFixed(0)}%`, signal: 'hawkish' });
      }
      if (probabilities.hold != null) {
        rows.push({ _key: 'prob-hold', metric: 'Hold Probability', rawValue: probabilities.hold, display: `${(probabilities.hold * 100).toFixed(0)}%`, signal: 'neutral' });
      }
      if (probabilities.cut != null) {
        rows.push({ _key: 'prob-cut', metric: 'Cut Probability', rawValue: probabilities.cut, display: `${(probabilities.cut * 100).toFixed(0)}%`, signal: 'dovish' });
      }
    }
    if (historicalCtx) {
      if (historicalCtx.rate_changes_12m != null) {
        rows.push({ _key: 'rc12m', metric: 'Rate Changes (12M)', rawValue: historicalCtx.rate_changes_12m, display: String(historicalCtx.rate_changes_12m) });
      }
      if (historicalCtx.peak_rate != null) {
        rows.push({ _key: 'peak', metric: 'Peak Rate (Cycle)', rawValue: historicalCtx.peak_rate, display: `${Number(historicalCtx.peak_rate).toFixed(2)}%` });
      }
      if (historicalCtx.trough_rate != null) {
        rows.push({ _key: 'trough', metric: 'Trough Rate (Cycle)', rawValue: historicalCtx.trough_rate, display: `${Number(historicalCtx.trough_rate).toFixed(2)}%` });
      }
    }
    return rows;
  }, [data, targetRange, nextMeeting, probabilities, historicalCtx]);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-white">Federal Reserve Policy</h3>
          {data?.stance && (
            <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${stanceBadge.cls}`}>
              {stanceBadge.label}
            </span>
          )}
          {data?.fed_funds_rate != null && (
            <span className="text-xs text-gray-400">
              FFR: <span className="text-white font-medium">{data.fed_funds_rate.toFixed(2)}%</span>
            </span>
          )}
          {nextMeeting?.date && (
            <span className="text-xs text-gray-400">
              Next: <span className="text-white">{nextMeeting.date}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Forward Guidance */}
      {data?.forward_guidance && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/20 text-xs border-b border-gray-800/50">
          <span className="text-gray-400">Guidance:</span>
          <span className="text-gray-300">{data.forward_guidance}</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={20} className="animate-spin text-cyan-400" />
          </div>
        ) : !data ? (
          <div className="flex items-center justify-center py-20 text-gray-500 text-sm">No data available</div>
        ) : (
          <div>
            {/* Signals table */}
            {signalsData.length > 0 && (
              <WidgetTable
                columns={signalsColumns}
                data={signalsData}
                size="compact"
                emptyMessage="No signals data"
                stickyHeader
              />
            )}

            {/* Key Factors table */}
            {factorsData.length > 0 && (
              <div className="border-t border-gray-800">
                <div className="px-4 py-2 text-xs text-gray-400 border-b border-gray-800/50">Key Factors</div>
                <WidgetTable
                  columns={factorsColumns}
                  data={factorsData}
                  size="compact"
                  emptyMessage="No factors data"
                  stickyHeader={false}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
