/**
 * Macro Financial Conditions Tab - CommonTable design
 * API: /macro/financial-conditions
 */
import { useState, useEffect, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { API_BASE } from '../../config/api';
import CommonTable from '../common/CommonTable';

const CONDITION_BADGE = {
  tight:   { label: 'TIGHT',   cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  loose:   { label: 'LOOSE',   cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  neutral: { label: 'NEUTRAL', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
};

const SUB_TABS = [
  { id: 'overview',  name: 'Overview' },
  { id: 'consumer',  name: 'Consumer Health' },
  { id: 'corporate', name: 'Corporate Health' },
];

function CondBadge({ signal }) {
  if (!signal) return <span className="text-gray-500">-</span>;
  const badge = CONDITION_BADGE[signal] || CONDITION_BADGE.neutral;
  return (
    <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${badge.cls}`}>
      {badge.label}
    </span>
  );
}

const OVERVIEW_COLS = [
  { key: 'metric',       header: 'Metric', renderFn: (v) => <span className="text-white">{v}</span> },
  { key: 'display',      header: 'Value',  align: 'right', renderFn: (v) => <span className="text-white tabular-nums font-medium">{v}</span> },
  {
    key: 'changeDisplay', header: 'Change', align: 'right',
    renderFn: (v, row) => {
      if (row.changeValue == null) return <span className="text-gray-500">-</span>;
      const color = row.changeValue > 0 ? 'text-red-400' : row.changeValue < 0 ? 'text-green-400' : 'text-gray-400';
      return <span className={`tabular-nums ${color}`}>{row.changeValue > 0 ? '+' : ''}{v}</span>;
    },
  },
  { key: 'signal', header: 'Signal', align: 'right', renderFn: (v) => <CondBadge signal={v} /> },
];

const HEALTH_COLS = [
  { key: 'metric',  header: 'Metric', renderFn: (v) => <span className="text-white">{v}</span> },
  { key: 'display', header: 'Value',  align: 'right', renderFn: (v) => <span className="text-white tabular-nums">{v}</span> },
];

const getConditionLabel = (value) => {
  if (value == null) return 'neutral';
  if (value > 0.5) return 'tight';
  if (value < -0.5) return 'loose';
  return 'neutral';
};

function buildHealthData(healthObj) {
  if (!healthObj || typeof healthObj !== 'object') return [];
  return Object.entries(healthObj).map(([key, val]) => {
    const metric = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    let display;
    if (typeof val === 'object' && val !== null) {
      display = val.value != null ? val.value.toFixed(2) : JSON.stringify(val);
    } else if (typeof val === 'number') {
      display = val.toFixed(2);
    } else {
      display = String(val);
    }
    return { metric, display };
  });
}

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

  const fciValue = data?.fci_composite?.value ?? data?.fci_index;
  const fciChange = data?.fci_composite?.change ?? data?.fci_change;
  const igSpread  = data?.credit_spreads?.investment_grade?.spread ?? data?.ig_spread;
  const igChange  = data?.credit_spreads?.investment_grade?.change ?? data?.ig_spread_change;
  const hySpread  = data?.credit_spreads?.high_yield?.spread ?? data?.hy_spread;
  const hyChange  = data?.credit_spreads?.high_yield?.change ?? data?.hy_spread_change;
  const tedSpread = data?.liquidity?.ted_spread ?? data?.ted_spread;
  const vixValue  = data?.volatility?.vix ?? data?.vix;

  const condBadge = CONDITION_BADGE[getConditionLabel(fciValue)] || CONDITION_BADGE.neutral;

  const overviewData = useMemo(() => {
    if (!data) return [];
    const rows = [];
    if (fciValue != null) rows.push({ metric: 'FCI Composite', display: fciValue.toFixed(2), changeValue: fciChange, changeDisplay: fciChange?.toFixed(2) || '-', signal: getConditionLabel(fciValue) });
    if (igSpread != null) rows.push({ metric: 'IG Spread', display: `${igSpread.toFixed(0)} bps`, changeValue: igChange, changeDisplay: igChange != null ? `${igChange.toFixed(0)} bps` : '-', signal: igSpread > 150 ? 'tight' : igSpread < 80 ? 'loose' : 'neutral' });
    if (hySpread != null) rows.push({ metric: 'HY Spread', display: `${hySpread.toFixed(0)} bps`, changeValue: hyChange, changeDisplay: hyChange != null ? `${hyChange.toFixed(0)} bps` : '-', signal: hySpread > 400 ? 'tight' : hySpread < 300 ? 'loose' : 'neutral' });
    if (tedSpread != null) rows.push({ metric: 'TED Spread', display: `${tedSpread.toFixed(0)} bps`, changeValue: null, changeDisplay: '-', signal: tedSpread > 50 ? 'tight' : tedSpread < 20 ? 'loose' : 'neutral' });
    if (vixValue != null)  rows.push({ metric: 'VIX', display: vixValue.toFixed(1), changeValue: null, changeDisplay: '-', signal: vixValue > 25 ? 'tight' : vixValue < 15 ? 'loose' : 'neutral' });
    return rows;
  }, [data, fciValue, fciChange, igSpread, igChange, hySpread, hyChange, tedSpread, vixValue]);

  const consumerData  = useMemo(() => buildHealthData(data?.consumer_health),  [data?.consumer_health]);
  const corporateData = useMemo(() => buildHealthData(data?.corporate_health), [data?.corporate_health]);

  const availableTabs = useMemo(() => {
    const tabs = [SUB_TABS[0]];
    if (consumerData.length > 0)  tabs.push(SUB_TABS[1]);
    if (corporateData.length > 0) tabs.push(SUB_TABS[2]);
    return tabs;
  }, [consumerData, corporateData]);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-white">Financial Conditions</h3>
          {fciValue != null && (
            <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${condBadge.cls}`}>
              FCI {fciValue.toFixed(2)} - {condBadge.label}
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
        ) : activeTab === 'consumer' ? (
          <CommonTable columns={HEALTH_COLS} data={consumerData}  searchable={false} exportable={false} compact pageSize={20} />
        ) : (
          <CommonTable columns={HEALTH_COLS} data={corporateData} searchable={false} exportable={false} compact pageSize={20} />
        )}
      </div>
    </div>
  );
}
