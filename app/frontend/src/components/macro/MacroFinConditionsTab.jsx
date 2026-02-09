/**
 * Macro Financial Conditions Tab - Terminal/WidgetTable design
 * API: /macro/financial-conditions (nested), /macro/financial-conditions/history
 */
import { useState, useEffect, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { API_BASE } from '../../config/api';
import WidgetTable from '../widgets/common/WidgetTable';

const CONDITION_BADGE = {
  tight: { label: 'TIGHT', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  loose: { label: 'LOOSE', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  neutral: { label: 'NEUTRAL', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
};

const SUB_TABS = [
  { id: 'overview', name: 'Overview' },
  { id: 'consumer', name: 'Consumer Health' },
  { id: 'corporate', name: 'Corporate Health' },
];

export default function MacroFinConditionsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/financial-conditions`);
      if (res.ok) setData(await res.json());
    } catch (error) {
      console.error('Error loading financial conditions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Extract nested values with fallbacks
  const fciValue = data?.fci_composite?.value ?? data?.fci_index;
  const fciChange = data?.fci_composite?.change ?? data?.fci_change;
  const igSpread = data?.credit_spreads?.investment_grade?.spread ?? data?.ig_spread;
  const igChange = data?.credit_spreads?.investment_grade?.change ?? data?.ig_spread_change;
  const hySpread = data?.credit_spreads?.high_yield?.spread ?? data?.hy_spread;
  const hyChange = data?.credit_spreads?.high_yield?.change ?? data?.hy_spread_change;
  const tedSpread = data?.liquidity?.ted_spread ?? data?.ted_spread;
  const vixValue = data?.volatility?.vix ?? data?.vix;

  const getConditionLabel = (value) => {
    if (value == null) return 'neutral';
    if (value > 0.5) return 'tight';
    if (value < -0.5) return 'loose';
    return 'neutral';
  };

  const condBadge = CONDITION_BADGE[getConditionLabel(fciValue)] || CONDITION_BADGE.neutral;

  // Overview columns
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
      key: 'change',
      header: 'Change',
      align: 'right',
      minWidth: '100px',
      sortable: true,
      sortValue: (row) => row.changeValue,
      render: (row) => {
        if (row.changeValue == null) return <span className="text-gray-500">-</span>;
        const color = row.changeValue > 0 ? 'text-red-400' : row.changeValue < 0 ? 'text-green-400' : 'text-gray-400';
        return <span className={`tabular-nums ${color}`}>{row.changeValue > 0 ? '+' : ''}{row.changeDisplay}</span>;
      },
    },
    {
      key: 'signal',
      header: 'Signal',
      align: 'right',
      minWidth: '80px',
      render: (row) => {
        if (!row.signal) return <span className="text-gray-500">-</span>;
        const badge = CONDITION_BADGE[row.signal] || CONDITION_BADGE.neutral;
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
    if (fciValue != null) {
      rows.push({
        _key: 'fci', metric: 'FCI Composite', rawValue: fciValue, display: fciValue.toFixed(2),
        changeValue: fciChange, changeDisplay: fciChange?.toFixed(2) || '-',
        signal: getConditionLabel(fciValue),
      });
    }
    if (igSpread != null) {
      rows.push({
        _key: 'ig', metric: 'IG Spread', rawValue: igSpread, display: `${igSpread.toFixed(0)} bps`,
        changeValue: igChange, changeDisplay: igChange != null ? `${igChange.toFixed(0)} bps` : '-',
        signal: igSpread > 150 ? 'tight' : igSpread < 80 ? 'loose' : 'neutral',
      });
    }
    if (hySpread != null) {
      rows.push({
        _key: 'hy', metric: 'HY Spread', rawValue: hySpread, display: `${hySpread.toFixed(0)} bps`,
        changeValue: hyChange, changeDisplay: hyChange != null ? `${hyChange.toFixed(0)} bps` : '-',
        signal: hySpread > 400 ? 'tight' : hySpread < 300 ? 'loose' : 'neutral',
      });
    }
    if (tedSpread != null) {
      rows.push({
        _key: 'ted', metric: 'TED Spread', rawValue: tedSpread, display: `${tedSpread.toFixed(0)} bps`,
        changeValue: null, changeDisplay: '-',
        signal: tedSpread > 50 ? 'tight' : tedSpread < 20 ? 'loose' : 'neutral',
      });
    }
    if (vixValue != null) {
      rows.push({
        _key: 'vix', metric: 'VIX', rawValue: vixValue, display: vixValue.toFixed(1),
        changeValue: null, changeDisplay: '-',
        signal: vixValue > 25 ? 'tight' : vixValue < 15 ? 'loose' : 'neutral',
      });
    }
    return rows;
  }, [data, fciValue, fciChange, igSpread, igChange, hySpread, hyChange, tedSpread, vixValue]);

  // Generic key-value table columns for health sections
  const healthColumns = useMemo(() => [
    {
      key: 'metric',
      header: 'Metric',
      minWidth: '200px',
      sortable: true,
      sortValue: (row) => row.metric,
      render: (row) => <span className="text-white">{row.metric}</span>,
    },
    {
      key: 'value',
      header: 'Value',
      align: 'right',
      minWidth: '120px',
      sortable: true,
      sortValue: (row) => row.rawValue,
      render: (row) => <span className="text-white tabular-nums">{row.display}</span>,
    },
  ], []);

  const buildHealthData = (healthObj) => {
    if (!healthObj || typeof healthObj !== 'object') return [];
    return Object.entries(healthObj).map(([key, val]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      let display, rawValue;
      if (typeof val === 'object' && val !== null) {
        rawValue = val.value ?? 0;
        display = val.value != null ? val.value.toFixed(2) : JSON.stringify(val);
      } else if (typeof val === 'number') {
        rawValue = val;
        display = val.toFixed(2);
      } else {
        rawValue = 0;
        display = String(val);
      }
      return { _key: key, metric: label, rawValue, display };
    });
  };

  const consumerData = useMemo(() => buildHealthData(data?.consumer_health), [data?.consumer_health]);
  const corporateData = useMemo(() => buildHealthData(data?.corporate_health), [data?.corporate_health]);

  // Filter tabs that have data
  const availableTabs = useMemo(() => {
    const tabs = [SUB_TABS[0]]; // overview always shown
    if (consumerData.length > 0) tabs.push(SUB_TABS[1]);
    if (corporateData.length > 0) tabs.push(SUB_TABS[2]);
    return tabs;
  }, [consumerData, corporateData]);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-white">Financial Conditions</h3>
          {fciValue != null && (
            <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${condBadge.cls}`}>
              FCI {fciValue.toFixed(2)} - {condBadge.label}
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
            emptyMessage="No financial conditions data"
            stickyHeader
            resizable
          />
        ) : activeTab === 'consumer' ? (
          <WidgetTable
            columns={healthColumns}
            data={consumerData}
            size="compact"
            emptyMessage="No consumer health data"
            stickyHeader
            resizable
            defaultSortKey="value"
            defaultSortDirection="desc"
          />
        ) : activeTab === 'corporate' ? (
          <WidgetTable
            columns={healthColumns}
            data={corporateData}
            size="compact"
            emptyMessage="No corporate health data"
            stickyHeader
            resizable
            defaultSortKey="value"
            defaultSortDirection="desc"
          />
        ) : null}
      </div>
    </div>
  );
}
