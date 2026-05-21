/**
 * ScreenerWidget — Stock screener with preset sidebar + filter form + results.
 *
 * Inspired by Toss Securities left-sidebar category layout.
 * Reuses StockListTable for results display.
 */
import { useState, useEffect, useCallback } from 'react';
import { Filter, Play, Save, Trash2, ChevronRight, SlidersHorizontal } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import StockListTable from './common/StockListTable';
import { screenerAPI } from '../../config/api';

const FILTER_FIELDS = [
  { key: 'sector',            label: 'Sector',       kind: 'multi-select' },
  { key: 'market_cap_min',    label: 'Min Mkt Cap',  kind: 'number', placeholder: '1B', parse: v => Number(v) },
  { key: 'market_cap_max',    label: 'Max Mkt Cap',  kind: 'number', placeholder: '100B', parse: v => Number(v) },
  { key: 'pe_ratio_min',      label: 'Min P/E',      kind: 'number', placeholder: '5' },
  { key: 'pe_ratio_max',      label: 'Max P/E',      kind: 'number', placeholder: '30' },
  { key: 'price_min',         label: 'Min Price',     kind: 'number', placeholder: '10' },
  { key: 'price_max',         label: 'Max Price',     kind: 'number', placeholder: '500' },
  { key: 'roe_min',           label: 'Min ROE %',     kind: 'number', placeholder: '10' },
  { key: 'debt_to_equity_max', label: 'Max D/E',      kind: 'number', placeholder: '1.5' },
];

function FilterForm({ filters, onChange, onRun, sectors, loading }) {
  const setFilter = (key, val) => onChange({ ...filters, [key]: val });

  return (
    <div className="px-3 py-2 space-y-2">
      {FILTER_FIELDS.map(f => {
        if (f.kind === 'multi-select') {
          return (
            <div key={f.key}>
              <label className="text-[10px] text-gray-500 font-medium block mb-1">{f.label}</label>
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
                          : 'bg-gray-800/50 text-gray-500 border-gray-700 hover:text-gray-300'
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
            <label className="text-[10px] text-gray-500 font-medium w-20 flex-shrink-0">{f.label}</label>
            <input
              type="number"
              value={filters[f.key] ?? ''}
              onChange={e => {
                const v = e.target.value;
                setFilter(f.key, v === '' ? undefined : Number(v));
              }}
              placeholder={f.placeholder}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[11px] text-white outline-none focus:border-cyan-500 tabular-nums placeholder-gray-600"
            />
          </div>
        );
      })}
      <button
        onClick={onRun}
        disabled={loading}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 text-white text-xs font-medium rounded transition-colors mt-2"
      >
        <Play size={11} />
        {loading ? 'Screening...' : 'Run Screener'}
      </button>
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
  const [view, setView] = useState('presets'); // 'presets' | 'custom' | 'saved'

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

  const handleSave = async () => {
    const name = prompt('Screener name:');
    if (!name) return;
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

  return (
    <BaseWidget
      title="Screener"
      icon={SlidersHorizontal}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
    >
      <div className="flex h-full min-h-0">
        {/* Sidebar */}
        <div className="w-44 flex-shrink-0 border-r border-gray-800 overflow-y-auto bg-[#0a0a0f]">
          {/* Sidebar tabs */}
          <div className="flex border-b border-gray-800">
            {[
              { id: 'presets', label: 'Presets' },
              { id: 'custom',  label: 'Custom' },
              { id: 'saved',   label: 'Saved' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                className={`flex-1 py-1.5 text-[10px] font-medium transition-colors ${
                  view === t.id ? 'text-cyan-400 border-b border-cyan-400' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {view === 'presets' && (
            <div className="py-1">
              {presets.map(p => (
                <button
                  key={p.preset_id}
                  onClick={() => runPreset(p.preset_id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                    activePreset === p.preset_id
                      ? 'bg-gray-800/80 text-white'
                      : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-medium truncate">{p.name}</div>
                    <div className="text-[10px] text-gray-600 truncate">{p.description}</div>
                  </div>
                  <ChevronRight size={10} className="text-gray-600 flex-shrink-0" />
                </button>
              ))}
              {!presets.length && (
                <div className="px-3 py-4 text-[10px] text-gray-600 text-center">No presets</div>
              )}
            </div>
          )}

          {view === 'custom' && (
            <div>
              <FilterForm
                filters={filters}
                onChange={setFilters}
                onRun={runCustom}
                sectors={sectors}
                loading={loading}
              />
              <div className="px-3 pb-2">
                <button
                  onClick={handleSave}
                  className="w-full flex items-center justify-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-cyan-400 border border-gray-700 hover:border-cyan-500/40 rounded transition-colors"
                >
                  <Save size={10} /> Save Filter
                </button>
              </div>
            </div>
          )}

          {view === 'saved' && (
            <div className="py-1">
              {savedScreeners.map(s => (
                <div
                  key={s.screener_id}
                  className={`flex items-center gap-1 px-3 py-2 transition-colors group ${
                    activePreset === s.screener_id ? 'bg-gray-800/80' : 'hover:bg-gray-800/50'
                  }`}
                >
                  <button
                    onClick={() => runSaved(s.screener_id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="text-[11px] font-medium text-gray-300 truncate">{s.name}</div>
                    <div className="text-[10px] text-gray-600 truncate">{s.description || 'Custom filter'}</div>
                  </button>
                  <button
                    onClick={() => handleDeleteSaved(s.screener_id)}
                    className="p-0.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
              {!savedScreeners.length && (
                <div className="px-3 py-4 text-[10px] text-gray-600 text-center">No saved screeners</div>
              )}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 flex flex-col min-w-0">
          {resultCount > 0 && (
            <div className="px-3 py-1.5 border-b border-gray-800/50 flex-shrink-0">
              <span className="text-[10px] text-gray-500">{resultCount} result{resultCount !== 1 ? 's' : ''}</span>
            </div>
          )}
          <div className="flex-1 overflow-auto min-h-0">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : results.length > 0 ? (
              <StockListTable
                items={results}
                showMarketCap={true}
                showSector={true}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs gap-1 px-4">
                <Filter size={20} className="text-gray-700 mb-1" />
                <p>Select a preset or set custom filters</p>
                <p className="text-[10px] text-gray-600">Results will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
