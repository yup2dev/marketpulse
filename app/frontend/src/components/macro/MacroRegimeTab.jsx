/**
 * Macro Economic Regime Tab - Terminal/WidgetTable design
 * API: /macro/regime/current, /macro/regime/history
 */
import { useState, useEffect, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { API_BASE } from '../../config/api';
import WidgetTable from '../widgets/common/WidgetTable';

const REGIME_BADGE = {
  goldilocks: { label: 'GOLDILOCKS', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  reflation: { label: 'REFLATION', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  stagflation: { label: 'STAGFLATION', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  deflation: { label: 'DEFLATION', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
};

const SUB_TABS = [
  { id: 'overview', name: 'Overview' },
  { id: 'components', name: 'Components' },
  { id: 'history', name: 'History' },
];

export default function MacroRegimeTab() {
  const [regime, setRegime] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [regimeRes, historyRes] = await Promise.all([
        fetch(`${API_BASE}/macro/regime/current`),
        fetch(`${API_BASE}/macro/regime/history`).catch(() => null)
      ]);
      if (regimeRes.ok) setRegime(await regimeRes.json());
      if (historyRes?.ok) {
        const data = await historyRes.json();
        setHistory(data.regime_history || data.history || []);
      }
    } catch (error) {
      console.error('Error loading regime data:', error);
    } finally {
      setLoading(false);
    }
  };

  const regimeBadge = REGIME_BADGE[regime?.regime] || { label: (regime?.regime || 'UNKNOWN').toUpperCase(), cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };

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
      minWidth: '120px',
      sortable: true,
      sortValue: (row) => row.rawValue,
      render: (row) => <span className="text-white tabular-nums font-medium">{row.display}</span>,
    },
    {
      key: 'signal',
      header: 'Signal',
      align: 'right',
      minWidth: '100px',
      render: (row) => {
        if (!row.signal) return <span className="text-gray-500">-</span>;
        const badge = REGIME_BADGE[row.signal] || { label: row.signal.toUpperCase(), cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
        return (
          <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${badge.cls}`}>
            {badge.label}
          </span>
        );
      },
    },
  ], []);

  const overviewData = useMemo(() => {
    if (!regime) return [];
    const rows = [];
    rows.push({
      _key: 'regime', metric: 'Current Regime', rawValue: 0,
      display: (regime.regime || 'Unknown').charAt(0).toUpperCase() + (regime.regime || 'unknown').slice(1),
      signal: regime.regime,
    });
    if (regime.growth_score != null) {
      rows.push({
        _key: 'growth', metric: 'Growth Score', rawValue: regime.growth_score,
        display: regime.growth_score.toFixed(0),
        signal: regime.growth_score >= 50 ? 'goldilocks' : 'stagflation',
      });
    }
    if (regime.inflation_score != null) {
      rows.push({
        _key: 'inflation', metric: 'Inflation Score', rawValue: regime.inflation_score,
        display: regime.inflation_score.toFixed(0),
        signal: regime.inflation_score >= 50 ? 'reflation' : 'deflation',
      });
    }
    return rows;
  }, [regime]);

  // Components table (regime.components is an object, not array)
  const compColumns = useMemo(() => [
    {
      key: 'component',
      header: 'Component',
      minWidth: '200px',
      sortable: true,
      sortValue: (row) => row.label,
      render: (row) => <span className="text-white">{row.label}</span>,
    },
    {
      key: 'value',
      header: 'Value',
      align: 'right',
      minWidth: '120px',
      sortable: true,
      sortValue: (row) => row.rawValue,
      render: (row) => {
        const color = row.rawValue > 0 ? 'text-green-400' : row.rawValue < 0 ? 'text-red-400' : 'text-gray-400';
        return <span className={`tabular-nums font-medium ${color}`}>{row.display}</span>;
      },
    },
  ], []);

  const compData = useMemo(() => {
    // API returns components as object (key-value), not drivers array
    const components = regime?.components || regime?.drivers;
    if (!components) return [];

    if (Array.isArray(components)) {
      // drivers array format: [{name, value, impact}]
      return components.map((d, idx) => ({
        _key: `driver-${idx}`,
        label: d.name || `Driver ${idx + 1}`,
        rawValue: d.value ?? d.impact ?? 0,
        display: (d.value ?? d.impact)?.toFixed(2) || '-',
      }));
    }

    // Object format: {key: value}
    return Object.entries(components).map(([key, val]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      let rawValue, display;
      if (typeof val === 'number') {
        rawValue = val;
        display = val.toFixed(2);
      } else if (typeof val === 'object' && val !== null) {
        rawValue = val.value ?? val.score ?? 0;
        display = rawValue.toFixed(2);
      } else {
        rawValue = 0;
        display = String(val);
      }
      return { _key: key, label, rawValue, display };
    });
  }, [regime?.components, regime?.drivers]);

  // Determine available tabs
  const availableTabs = useMemo(() => {
    const tabs = [SUB_TABS[0]];
    if (compData.length > 0) tabs.push(SUB_TABS[1]);
    if (history.length > 0) tabs.push(SUB_TABS[2]);
    return tabs;
  }, [compData, history]);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-white">Economic Regime</h3>
          {regime?.regime && (
            <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${regimeBadge.cls}`}>
              {regimeBadge.label}
            </span>
          )}
          {regime?.growth_score != null && (
            <span className="text-xs text-gray-400">
              Growth: <span className={`font-medium ${regime.growth_score >= 50 ? 'text-green-400' : 'text-red-400'}`}>{regime.growth_score.toFixed(0)}</span>
            </span>
          )}
          {regime?.inflation_score != null && (
            <span className="text-xs text-gray-400">
              Inflation: <span className={`font-medium ${regime.inflation_score >= 50 ? 'text-red-400' : 'text-green-400'}`}>{regime.inflation_score.toFixed(0)}</span>
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
        ) : !regime ? (
          <div className="flex items-center justify-center py-20 text-gray-500 text-sm">No data available</div>
        ) : activeTab === 'overview' ? (
          <div>
            <WidgetTable
              columns={overviewColumns}
              data={overviewData}
              size="compact"
              emptyMessage="No regime data"
              stickyHeader
            />
            {/* Regime Quadrant */}
            <div className="border-t border-gray-800 px-4 py-3">
              <div className="text-xs text-gray-400 mb-2">Regime Quadrant</div>
              <div className="grid grid-cols-2 gap-1 h-[160px]">
                <div className={`rounded-tl-lg p-3 ${regime.regime === 'reflation' ? 'bg-yellow-900/50 border-2 border-yellow-400' : 'bg-gray-800/50'}`}>
                  <div className="text-yellow-400 text-xs font-medium">Reflation</div>
                  <div className="text-gray-500 text-[10px] mt-1">Growth + Inflation</div>
                </div>
                <div className={`rounded-tr-lg p-3 ${regime.regime === 'goldilocks' ? 'bg-green-900/50 border-2 border-green-400' : 'bg-gray-800/50'}`}>
                  <div className="text-green-400 text-xs font-medium">Goldilocks</div>
                  <div className="text-gray-500 text-[10px] mt-1">Growth + Low Inflation</div>
                </div>
                <div className={`rounded-bl-lg p-3 ${regime.regime === 'stagflation' ? 'bg-red-900/50 border-2 border-red-400' : 'bg-gray-800/50'}`}>
                  <div className="text-red-400 text-xs font-medium">Stagflation</div>
                  <div className="text-gray-500 text-[10px] mt-1">Weak Growth + Inflation</div>
                </div>
                <div className={`rounded-br-lg p-3 ${regime.regime === 'deflation' ? 'bg-blue-900/50 border-2 border-blue-400' : 'bg-gray-800/50'}`}>
                  <div className="text-blue-400 text-xs font-medium">Deflation</div>
                  <div className="text-gray-500 text-[10px] mt-1">Weak Growth + Falling Prices</div>
                </div>
              </div>
            </div>
          </div>
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
        ) : activeTab === 'history' ? (
          <div className="p-4">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" stroke="#666" fontSize={10} />
                  <YAxis stroke="#666" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Line type="monotone" dataKey="growth_score" name="Growth" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="inflation_score" name="Inflation" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
