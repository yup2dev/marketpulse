/**
 * Macro Sentiment Tab - CommonTable design
 * API: /macro/sentiment/composite
 */
import { useState, useEffect, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { API_BASE } from '../../config/api';
import CommonTable from '../common/CommonTable';

const SENTIMENT_BADGE = {
  greed:         { label: 'GREED',     cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  fear:          { label: 'FEAR',      cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  neutral:       { label: 'NEUTRAL',   cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  'extreme greed': { label: 'EXT GREED', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  'extreme fear':  { label: 'EXT FEAR',  cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  bullish:       { label: 'BULLISH',   cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  bearish:       { label: 'BEARISH',   cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

const SUB_TABS = [
  { id: 'overview',    name: 'Overview' },
  { id: 'components', name: 'F&G Components' },
  { id: 'aaii',       name: 'AAII Survey' },
];

function SignalBadge({ signal }) {
  if (!signal) return <span className="text-gray-500">-</span>;
  const badge = SENTIMENT_BADGE[signal] || { label: signal.toUpperCase(), cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
  return (
    <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${badge.cls}`}>
      {badge.label}
    </span>
  );
}

const OVERVIEW_COLS = [
  { key: 'metric',  header: 'Metric',  renderFn: (v) => <span className="text-white">{v}</span> },
  { key: 'display', header: 'Value',   align: 'right', renderFn: (v) => <span className="text-white tabular-nums font-medium">{v}</span> },
  { key: 'signal',  header: 'Signal',  align: 'right', renderFn: (v) => <SignalBadge signal={v} /> },
];

const COMP_COLS = [
  { key: 'label',   header: 'Component', renderFn: (v) => <span className="text-white">{v}</span> },
  { key: 'display', header: 'Value',     align: 'right', renderFn: (v) => <span className="text-white tabular-nums">{v}</span> },
  { key: 'signal',  header: 'Signal',    align: 'right', renderFn: (v) => <SignalBadge signal={v} /> },
];

const AAII_COLS = [
  {
    key: 'category', header: 'Category',
    renderFn: (v, row) => {
      const color = row.type === 'bullish' ? 'text-green-400' : row.type === 'bearish' ? 'text-red-400' : 'text-yellow-400';
      return <span className={`font-medium ${color}`}>{v}</span>;
    },
  },
  { key: 'display', header: 'Percentage', align: 'right', renderFn: (v) => <span className="text-white tabular-nums font-medium">{v}</span> },
  {
    key: 'rawValue', header: '',
    sortable: false,
    renderFn: (v, row) => {
      const color = row.type === 'bullish' ? 'bg-green-400' : row.type === 'bearish' ? 'bg-red-400' : 'bg-yellow-400';
      return (
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div className={`h-full ${color}`} style={{ width: `${Math.min(v || 0, 100)}%` }} />
        </div>
      );
    },
  },
];

const getSentimentLevel = (value) => {
  if (value == null) return 'neutral';
  if (value >= 80) return 'extreme greed';
  if (value >= 60) return 'greed';
  if (value >= 40) return 'neutral';
  if (value >= 20) return 'fear';
  return 'extreme fear';
};

export default function MacroSentimentTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/sentiment/composite`);
      if (res.ok) setData(await res.json());
    } catch (error) {
      console.error('Error loading sentiment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const compositeScore = data?.fear_greed_index?.value ?? data?.composite_score;
  const compositeLabel = data?.fear_greed_index?.label;
  const aaiiBulls   = data?.positioning?.aaii_sentiment?.bullish ?? data?.aaii_bulls;
  const aaiiBears   = data?.positioning?.aaii_sentiment?.bearish ?? data?.aaii_bears;
  const aaiiNeutral = data?.positioning?.aaii_sentiment?.neutral ?? data?.aaii_neutral;
  const putCall     = data?.fear_greed_index?.components?.put_call_ratio?.value ?? data?.put_call;
  const vixValue    = data?.volatility?.vix ?? data?.vix;
  const fgComponents = data?.fear_greed_index?.components;

  const level = compositeLabel?.toLowerCase() || getSentimentLevel(compositeScore);
  const headerBadge = SENTIMENT_BADGE[level] || SENTIMENT_BADGE.neutral;

  const overviewData = useMemo(() => {
    if (!data) return [];
    const rows = [];
    if (compositeScore != null) rows.push({ metric: 'Fear & Greed Index', display: compositeScore.toFixed(0), signal: getSentimentLevel(compositeScore) });
    if (aaiiBulls   != null) rows.push({ metric: 'AAII Bullish', display: `${aaiiBulls.toFixed(1)}%`, signal: aaiiBulls > 45 ? 'bullish' : aaiiBulls < 25 ? 'bearish' : 'neutral' });
    if (aaiiBears   != null) rows.push({ metric: 'AAII Bearish', display: `${aaiiBears.toFixed(1)}%`, signal: aaiiBears > 45 ? 'bearish' : aaiiBears < 25 ? 'bullish' : 'neutral' });
    if (aaiiNeutral != null) rows.push({ metric: 'AAII Neutral', display: `${aaiiNeutral.toFixed(1)}%` });
    if (aaiiBulls != null && aaiiBears != null) {
      const spread = aaiiBulls - aaiiBears;
      rows.push({ metric: 'Bull-Bear Spread', display: `${spread > 0 ? '+' : ''}${spread.toFixed(1)}%`, signal: spread > 20 ? 'bullish' : spread < -20 ? 'bearish' : 'neutral' });
    }
    if (putCall  != null) rows.push({ metric: 'Put/Call Ratio', display: putCall.toFixed(2), signal: putCall > 1 ? 'fear' : putCall < 0.7 ? 'greed' : 'neutral' });
    if (vixValue != null) rows.push({ metric: 'VIX', display: vixValue.toFixed(1), signal: vixValue > 25 ? 'fear' : vixValue < 15 ? 'greed' : 'neutral' });
    return rows;
  }, [data, compositeScore, aaiiBulls, aaiiBears, aaiiNeutral, putCall, vixValue]);

  const compData = useMemo(() => {
    if (!fgComponents || typeof fgComponents !== 'object') return [];
    return Object.entries(fgComponents).map(([key, comp]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      let display, signal;
      if (typeof comp === 'object' && comp !== null) {
        display = comp.value != null ? comp.value.toFixed(2) : '-';
        signal = comp.signal || null;
      } else if (typeof comp === 'number') {
        display = comp.toFixed(2);
      } else {
        display = String(comp);
      }
      return { label, display, signal };
    });
  }, [fgComponents]);

  const aaiiData = useMemo(() => {
    const rows = [];
    if (aaiiBulls   != null) rows.push({ category: 'Bullish', type: 'bullish', rawValue: aaiiBulls,   display: `${aaiiBulls.toFixed(1)}%` });
    if (aaiiNeutral != null) rows.push({ category: 'Neutral', type: 'neutral', rawValue: aaiiNeutral, display: `${aaiiNeutral.toFixed(1)}%` });
    if (aaiiBears   != null) rows.push({ category: 'Bearish', type: 'bearish', rawValue: aaiiBears,   display: `${aaiiBears.toFixed(1)}%` });
    return rows;
  }, [aaiiBulls, aaiiNeutral, aaiiBears]);

  const availableTabs = useMemo(() => {
    const tabs = [SUB_TABS[0]];
    if (compData.length > 0) tabs.push(SUB_TABS[1]);
    if (aaiiData.length > 0) tabs.push(SUB_TABS[2]);
    return tabs;
  }, [compData, aaiiData]);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-white">Market Sentiment</h3>
          {compositeScore != null && (
            <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${headerBadge.cls}`}>
              {compositeScore.toFixed(0)} - {headerBadge.label}
            </span>
          )}
        </div>
        <button onClick={loadData} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {availableTabs.length > 1 && (
        <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800 overflow-x-auto">
          {availableTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded transition-colors ${
                activeTab === tab.id ? 'text-cyan-400 bg-cyan-400/10' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={20} className="animate-spin text-cyan-400" />
          </div>
        ) : !data ? (
          <div className="flex items-center justify-center py-20 text-gray-500 text-sm">No data available</div>
        ) : activeTab === 'overview' ? (
          <CommonTable columns={OVERVIEW_COLS} data={overviewData} searchable={false} exportable={false} compact pageSize={20} />
        ) : activeTab === 'components' ? (
          <CommonTable columns={COMP_COLS} data={compData} searchable={false} exportable={false} compact pageSize={20} />
        ) : (
          <CommonTable columns={AAII_COLS} data={aaiiData} searchable={false} exportable={false} compact pageSize={10} />
        )}
      </div>
    </div>
  );
}
