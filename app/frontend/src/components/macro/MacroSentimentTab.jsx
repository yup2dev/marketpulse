/**
 * Macro Sentiment Tab - Terminal/WidgetTable design
 * API: /macro/sentiment/composite (nested), /macro/sentiment/history
 */
import { useState, useEffect, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { API_BASE } from '../../config/api';
import WidgetTable from '../widgets/common/WidgetTable';

const SENTIMENT_BADGE = {
  greed: { label: 'GREED', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  fear: { label: 'FEAR', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  neutral: { label: 'NEUTRAL', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  'extreme greed': { label: 'EXT GREED', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  'extreme fear': { label: 'EXT FEAR', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  bullish: { label: 'BULLISH', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  bearish: { label: 'BEARISH', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

const SUB_TABS = [
  { id: 'overview', name: 'Overview' },
  { id: 'components', name: 'F&G Components' },
  { id: 'aaii', name: 'AAII Survey' },
];

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

  // Extract nested values with fallbacks
  const compositeScore = data?.fear_greed_index?.value ?? data?.composite_score;
  const compositeLabel = data?.fear_greed_index?.label;
  const aaiiBulls = data?.positioning?.aaii_sentiment?.bullish ?? data?.aaii_bulls;
  const aaiiBears = data?.positioning?.aaii_sentiment?.bearish ?? data?.aaii_bears;
  const aaiiNeutral = data?.positioning?.aaii_sentiment?.neutral ?? data?.aaii_neutral;
  const putCall = data?.fear_greed_index?.components?.put_call_ratio?.value ?? data?.put_call;
  const vixValue = data?.volatility?.vix ?? data?.vix;
  const fgComponents = data?.fear_greed_index?.components;

  const getSentimentLevel = (value) => {
    if (value == null) return 'neutral';
    if (value >= 80) return 'extreme greed';
    if (value >= 60) return 'greed';
    if (value >= 40) return 'neutral';
    if (value >= 20) return 'fear';
    return 'extreme fear';
  };

  const level = compositeLabel?.toLowerCase() || getSentimentLevel(compositeScore);
  const headerBadge = SENTIMENT_BADGE[level] || SENTIMENT_BADGE.neutral;

  // Overview table
  const overviewColumns = useMemo(() => [
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
      render: (row) => <span className="text-white tabular-nums font-medium">{row.display}</span>,
    },
    {
      key: 'signal',
      header: 'Signal',
      align: 'right',
      minWidth: '80px',
      render: (row) => {
        if (!row.signal) return <span className="text-gray-500">-</span>;
        const badge = SENTIMENT_BADGE[row.signal] || { label: row.signal.toUpperCase(), cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
        return (
          <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${badge.cls}`}>
            {badge.label}
          </span>
        );
      },
    },
  ], []);

  const overviewData = useMemo(() => {
    if (!data) return [];
    const rows = [];
    if (compositeScore != null) {
      rows.push({
        _key: 'fg', metric: 'Fear & Greed Index', rawValue: compositeScore,
        display: compositeScore.toFixed(0), signal: getSentimentLevel(compositeScore),
      });
    }
    if (aaiiBulls != null) {
      rows.push({
        _key: 'bulls', metric: 'AAII Bullish', rawValue: aaiiBulls,
        display: `${aaiiBulls.toFixed(1)}%`, signal: aaiiBulls > 45 ? 'bullish' : aaiiBulls < 25 ? 'bearish' : 'neutral',
      });
    }
    if (aaiiBears != null) {
      rows.push({
        _key: 'bears', metric: 'AAII Bearish', rawValue: aaiiBears,
        display: `${aaiiBears.toFixed(1)}%`, signal: aaiiBears > 45 ? 'bearish' : aaiiBears < 25 ? 'bullish' : 'neutral',
      });
    }
    if (aaiiNeutral != null) {
      rows.push({ _key: 'neut', metric: 'AAII Neutral', rawValue: aaiiNeutral, display: `${aaiiNeutral.toFixed(1)}%` });
    }
    if (aaiiBulls != null && aaiiBears != null) {
      const spread = aaiiBulls - aaiiBears;
      rows.push({
        _key: 'spread', metric: 'Bull-Bear Spread', rawValue: spread,
        display: `${spread > 0 ? '+' : ''}${spread.toFixed(1)}%`,
        signal: spread > 20 ? 'bullish' : spread < -20 ? 'bearish' : 'neutral',
      });
    }
    if (putCall != null) {
      rows.push({
        _key: 'pc', metric: 'Put/Call Ratio', rawValue: putCall,
        display: putCall.toFixed(2), signal: putCall > 1 ? 'fear' : putCall < 0.7 ? 'greed' : 'neutral',
      });
    }
    if (vixValue != null) {
      rows.push({
        _key: 'vix', metric: 'VIX', rawValue: vixValue,
        display: vixValue.toFixed(1), signal: vixValue > 25 ? 'fear' : vixValue < 15 ? 'greed' : 'neutral',
      });
    }
    return rows;
  }, [data, compositeScore, aaiiBulls, aaiiBears, aaiiNeutral, putCall, vixValue]);

  // F&G Components table
  const compColumns = useMemo(() => [
    {
      key: 'component',
      header: 'Component',
      minWidth: '180px',
      sortable: true,
      sortValue: (row) => row.label,
      render: (row) => <span className="text-white">{row.label}</span>,
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
      minWidth: '80px',
      render: (row) => {
        if (!row.signal) return <span className="text-gray-500">-</span>;
        const badge = SENTIMENT_BADGE[row.signal] || { label: row.signal.toUpperCase(), cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
        return (
          <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${badge.cls}`}>
            {badge.label}
          </span>
        );
      },
    },
  ], []);

  const compData = useMemo(() => {
    if (!fgComponents || typeof fgComponents !== 'object') return [];
    return Object.entries(fgComponents).map(([key, comp]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      let display, rawValue, signal;
      if (typeof comp === 'object' && comp !== null) {
        rawValue = comp.value ?? 0;
        display = comp.value != null ? comp.value.toFixed(2) : '-';
        signal = comp.signal || null;
      } else if (typeof comp === 'number') {
        rawValue = comp;
        display = comp.toFixed(2);
      } else {
        rawValue = 0;
        display = String(comp);
      }
      return { _key: key, label, rawValue, display, signal };
    });
  }, [fgComponents]);

  // AAII table
  const aaiiColumns = useMemo(() => [
    {
      key: 'category',
      header: 'Category',
      minWidth: '120px',
      render: (row) => {
        const color = row.type === 'bullish' ? 'text-green-400' : row.type === 'bearish' ? 'text-red-400' : 'text-yellow-400';
        return <span className={`font-medium ${color}`}>{row.category}</span>;
      },
    },
    {
      key: 'pct',
      header: 'Percentage',
      align: 'right',
      minWidth: '120px',
      sortable: true,
      sortValue: (row) => row.rawValue,
      render: (row) => <span className="text-white tabular-nums font-medium">{row.display}</span>,
    },
    {
      key: 'bar',
      header: '',
      minWidth: '200px',
      render: (row) => {
        const color = row.type === 'bullish' ? 'bg-green-400' : row.type === 'bearish' ? 'bg-red-400' : 'bg-yellow-400';
        return (
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div className={`h-full ${color}`} style={{ width: `${Math.min(row.rawValue || 0, 100)}%` }} />
          </div>
        );
      },
    },
  ], []);

  const aaiiData = useMemo(() => {
    const rows = [];
    if (aaiiBulls != null) rows.push({ _key: 'bull', category: 'Bullish', type: 'bullish', rawValue: aaiiBulls, display: `${aaiiBulls.toFixed(1)}%` });
    if (aaiiNeutral != null) rows.push({ _key: 'neut', category: 'Neutral', type: 'neutral', rawValue: aaiiNeutral, display: `${aaiiNeutral.toFixed(1)}%` });
    if (aaiiBears != null) rows.push({ _key: 'bear', category: 'Bearish', type: 'bearish', rawValue: aaiiBears, display: `${aaiiBears.toFixed(1)}%` });
    return rows;
  }, [aaiiBulls, aaiiNeutral, aaiiBears]);

  // Determine available tabs
  const availableTabs = useMemo(() => {
    const tabs = [SUB_TABS[0]]; // overview always
    if (compData.length > 0) tabs.push(SUB_TABS[1]);
    if (aaiiData.length > 0) tabs.push(SUB_TABS[2]);
    return tabs;
  }, [compData, aaiiData]);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-white">Market Sentiment</h3>
          {compositeScore != null && (
            <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${headerBadge.cls}`}>
              {compositeScore.toFixed(0)} - {headerBadge.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      {availableTabs.length > 1 && (
        <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800 overflow-x-auto">
          {availableTabs.map(tab => (
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
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={20} className="animate-spin text-cyan-400" />
          </div>
        ) : !data ? (
          <div className="flex items-center justify-center py-20 text-gray-500 text-sm">No data available</div>
        ) : activeTab === 'overview' ? (
          <WidgetTable
            columns={overviewColumns}
            data={overviewData}
            size="compact"
            emptyMessage="No sentiment data"
            stickyHeader
            resizable
          />
        ) : activeTab === 'components' ? (
          <WidgetTable
            columns={compColumns}
            data={compData}
            size="compact"
            emptyMessage="No component data"
            stickyHeader
            resizable
            defaultSortKey="value"
            defaultSortDirection="desc"
          />
        ) : activeTab === 'aaii' ? (
          <WidgetTable
            columns={aaiiColumns}
            data={aaiiData}
            size="compact"
            emptyMessage="No AAII data"
            stickyHeader
          />
        ) : null}
      </div>
    </div>
  );
}
