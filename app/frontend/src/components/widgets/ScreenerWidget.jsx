import { useState, useEffect, useCallback } from 'react';
import { Filter, Play, Save, Trash2, ChevronRight, SlidersHorizontal, X, Check } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import StockListTable from './common/StockListTable';
import { screenerAPI } from '../../config/api';

const inputCls =
  'flex-1 bg-[#0a0a0f] border border-gray-800 rounded px-2 py-1.5 text-[11px] text-gray-200 ' +
  'outline-none focus:border-cyan-700 tabular-nums placeholder-gray-600';

const FILTER_FIELDS = [
  { key: 'sector',            label: 'Sector',       kind: 'multi-select' },
  { key: 'market_cap_min',    label: 'Min Mkt Cap',  kind: 'number', placeholder: '1B' },
  { key: 'market_cap_max',    label: 'Max Mkt Cap',  kind: 'number', placeholder: '100B' },
  { key: 'pe_ratio_min',      label: 'Min P/E',      kind: 'number', placeholder: '5' },
  { key: 'pe_ratio_max',      label: 'Max P/E',      kind: 'number', placeholder: '30' },
  { key: 'price_min',         label: 'Min Price',     kind: 'number', placeholder: '10' },
  { key: 'price_max',         label: 'Max Price',     kind: 'number', placeholder: '500' },
  { key: 'roe_min',           label: 'Min ROE %',     kind: 'number', placeholder: '10' },
  { key: 'debt_to_equity_max', label: 'Max D/E',      kind: 'number', placeholder: '1.5' },
];

function FilterForm({ filters, onChange, onRun, onSave, sectors, loading }) {
  const setFilter = (key, val) => onChange({ ...filters, [key]: val });
  const [saveName, setSaveName] = useState('');
  const [showSave, setShowSave] = useState(false);

  const handleSave = () => {
    const name = saveName.trim();
    if (!name) return;
    onSave(name);
    setSaveName('');
    setShowSave(false);
  };

  return (
    <div className="px-3 py-3 space-y-2.5 border-b border-gray-800/60">
      {FILTER_FIELDS.map(f => {
        if (f.kind === 'multi-select') {
          return (
            <div key={f.key}>
              <label className="text-[10px] uppercase tracking-wide text-gray-500 font-medium block mb-1.5">{f.label}</label>
              <div className="flex flex-wrap gap-1">
                {(sectors || []).slice(0, 12).map(s => {
                  const active = (filters.sector || []).includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => {
                        const arr = filters.sector || [];
                        setFilter('sector', active ? arr.filter(x => x !== s) : [...arr, s]);
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                        active
                          ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                          : 'bg-[#0a0a0f] text-gray-500 border-gray-800 hover:text-gray-300 hover:border-gray-700'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }
        return (
          <div key={f.key} className="flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-wide text-gray-500 font-medium w-20 flex-shrink-0">{f.label}</label>
            <input
              type="number"
              value={filters[f.key] ?? ''}
              onChange={e => {
                const v = e.target.value;
                setFilter(f.key, v === '' ? undefined : Number(v));
              }}
              placeholder={f.placeholder}
              className={inputCls}
            />
          </div>
        );
      })}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onRun}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-medium rounded transition-colors"
        >
          <Play size={11} />
          {loading ? 'Screening...' : 'Run Screener'}
        </button>

        {showSave ? (
          <div className="flex items-center gap-1">
            <input
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Name..."
              autoFocus
              className="w-28 bg-[#0a0a0f] border border-gray-800 rounded px-2 py-1.5 text-[11px] text-gray-200 outline-none focus:border-cyan-700"
            />
            <button onClick={handleSave} className="p-1 text-cyan-400 hover:text-cyan-300 transition-colors" title="Save">
              <Check size={12} />
            </button>
            <button onClick={() => { setShowSave(false); setSaveName(''); }} className="p-1 text-gray-500 hover:text-gray-300 transition-colors">
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowSave(true)}
            className="flex items-center gap-1 px-3 py-2 text-[11px] text-gray-400 hover:text-cyan-400 border border-gray-800 hover:border-cyan-500/40 rounded transition-colors"
            title="Save filter"
          >
            <Save size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function ScreenerWidget({ onRemove }) {
  const [presets, setPresets] = useState([]);
  const [savedScreeners, setSavedScreeners] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [filters, setFilters] = useState({});
  const [results, setResults] = useState([]);
  const [resultCount, setResultCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activePreset, setActivePreset] = useState(null);
  const [view, setView] = useState('presets');

  useEffect(() => {
    screenerAPI.getPresets().then(r => setPresets(r.presets || [])).catch(() => {});
    screenerAPI.getSectors().then(r => setSectors(r.sectors || [])).catch(() => {});
    screenerAPI.getSaved().then(r => setSavedScreeners(r || [])).catch(() => {});
  }, []);

  const runPreset = useCallback(async (presetId) => {
    setLoading(true);
    setActivePreset(presetId);
    try {
      const res = await screenerAPI.runPreset(presetId);
      setResults(res.results || []);
      setResultCount(res.count || 0);
    } catch {
      setResults([]);
      setResultCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const runCustom = useCallback(async () => {
    const clean = {};
    for (const [k, v] of Object.entries(filters)) {
      if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) clean[k] = v;
    }
    setLoading(true);
    setActivePreset(null);
    try {
      const res = await screenerAPI.screen(clean);
      setResults(res.results || []);
      setResultCount(res.count || 0);
    } catch {
      setResults([]);
      setResultCount(0);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const runSaved = useCallback(async (id) => {
    setLoading(true);
    setActivePreset(id);
    try {
      const res = await screenerAPI.runSaved(id);
      setResults(res.results || []);
      setResultCount(res.count || 0);
    } catch {
      setResults([]);
      setResultCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSave = async (name) => {
    const clean = {};
    for (const [k, v] of Object.entries(filters)) {
      if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) clean[k] = v;
    }
    try {
      const saved = await screenerAPI.save({ name, filters: clean });
      setSavedScreeners(prev => [...prev, saved]);
    } catch { /* ignore */ }
  };

  const handleDeleteSaved = async (id) => {
    try {
      await screenerAPI.deleteSaved(id);
      setSavedScreeners(prev => prev.filter(s => s.screener_id !== id));
    } catch { /* ignore */ }
  };

  const TABS = [
    { id: 'presets', label: 'Presets', count: presets.length },
    { id: 'custom',  label: 'Custom' },
    { id: 'saved',   label: 'Saved', count: savedScreeners.length },
  ];

  return (
    <BaseWidget
      title="Screener"
      subtitle={resultCount > 0 ? `${resultCount} results` : undefined}
      icon={SlidersHorizontal}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
    >
      <div className="flex flex-col h-full min-h-0">
        {/* Top tabs */}
        <div className="flex items-center px-3 py-1.5 border-b border-gray-800 bg-[#0a0a0f] flex-shrink-0">
          <div className="flex gap-3 flex-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                className={`text-[11px] font-medium pb-1 transition-colors ${
                  view === t.id
                    ? 'text-white border-b border-cyan-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span className="ml-1 text-[9px] text-gray-600">({t.count})</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-auto min-h-0">
          {view === 'presets' && (
            <>
              <div className="border-b border-gray-800/60">
                {presets.map(p => (
                  <button
                    key={p.preset_id}
                    onClick={() => runPreset(p.preset_id)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors border-b border-gray-800/30 last:border-b-0 ${
                      activePreset === p.preset_id
                        ? 'bg-gray-800/60 text-white'
                        : 'text-gray-400 hover:bg-gray-800/30 hover:text-gray-200'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium truncate">{p.name}</div>
                      {p.description && <div className="text-[10px] text-gray-600 truncate mt-0.5">{p.description}</div>}
                    </div>
                    <ChevronRight size={10} className="text-gray-600 flex-shrink-0" />
                  </button>
                ))}
                {!presets.length && (
                  <div className="px-3 py-6 text-[10px] text-gray-600 text-center">No presets available</div>
                )}
              </div>
              {results.length > 0 && (
                <StockListTable items={results} showMarketCap={true} showSector={true} />
              )}
            </>
          )}

          {view === 'custom' && (
            <>
              <FilterForm
                filters={filters}
                onChange={setFilters}
                onRun={runCustom}
                onSave={handleSave}
                sectors={sectors}
                loading={loading}
              />
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : results.length > 0 ? (
                <StockListTable items={results} showMarketCap={true} showSector={true} />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500 text-xs gap-1 px-4">
                  <Filter size={20} className="text-gray-700 mb-1" />
                  <p>Set filters above and run screener</p>
                </div>
              )}
            </>
          )}

          {view === 'saved' && (
            <>
              <div className="border-b border-gray-800/60">
                {savedScreeners.map(s => (
                  <div
                    key={s.screener_id}
                    className={`flex items-center gap-1 px-3 py-2.5 transition-colors group border-b border-gray-800/30 last:border-b-0 ${
                      activePreset === s.screener_id ? 'bg-gray-800/60' : 'hover:bg-gray-800/30'
                    }`}
                  >
                    <button
                      onClick={() => runSaved(s.screener_id)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="text-[11px] font-medium text-gray-300 truncate">{s.name}</div>
                      {(s.description || '') && (
                        <div className="text-[10px] text-gray-600 truncate mt-0.5">{s.description}</div>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteSaved(s.screener_id)}
                      className="p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
                {!savedScreeners.length && (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-500 text-xs gap-1 px-4">
                    <Save size={20} className="text-gray-700 mb-1" />
                    <p>No saved screeners</p>
                    <p className="text-[10px] text-gray-600">Use Custom tab to create and save filters</p>
                  </div>
                )}
              </div>
              {results.length > 0 && (
                <StockListTable items={results} showMarketCap={true} showSector={true} />
              )}
            </>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
