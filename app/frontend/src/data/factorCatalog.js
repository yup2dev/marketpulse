/**
 * Factor Catalog Store — DB-backed factor definitions.
 *
 * Source of truth: GET /api/quant/factor-catalog (seeded from
 * scripts/init_quant_factor_catalog.py).
 *
 * Static STRATEGY_FACTORS (data/strategyFactors.js) serves as a synchronous
 * bootstrap fallback so non-React callers (e.g. helpers.js) never see undefined
 * data during the first render before the API resolves.
 *
 *   useFactorCatalog()     — React hook, re-renders on load
 *   getFactors()           — sync snapshot (for pure helpers)
 *   getBackendExpansions() — sync {factorId → [{back,label}]} map
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { quantAPI } from '../config/api';
import { STRATEGY_FACTORS as STATIC_FACTORS } from './strategyFactors';
import { FACTOR_BACKEND_EXPANSIONS as STATIC_BACKENDS } from '../components/strategy/constants';

// ── Mutable module state (seeded from static defaults) ───────────────────────
let _factors  = STATIC_FACTORS;
let _backends = STATIC_BACKENDS;
let _loaded   = false;
let _loading  = false;
let _promise  = null;

const listeners = new Set();
const notify = () => { listeners.forEach(fn => fn()); };

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

// ── Snapshot accessors (stable reference unless data changed) ────────────────
let _snapshot = { factors: _factors, backends: _backends, loaded: false };
const getSnapshot = () => _snapshot;

function refreshSnapshot() {
  _snapshot = { factors: _factors, backends: _backends, loaded: _loaded };
  notify();
}

// ── Fetch ────────────────────────────────────────────────────────────────────
async function fetchCatalog() {
  const resp = await quantAPI.factorCatalog();
  const rows = Array.isArray(resp?.data) ? resp.data : [];
  if (rows.length === 0) return;

  const factors = rows.map(r => ({
    id:           r.id,
    name:         r.name,
    nameKo:       r.nameKo,
    category:     r.category,
    sub:          r.sub,
    desc:         r.desc,
    examples:     r.examples,
    strategic:    r.strategic,
    params:       r.params || [],
    availability: r.availability,
  }));

  const backends = {};
  for (const r of rows) {
    if (Array.isArray(r.backends) && r.backends.length > 0) {
      backends[r.id] = r.backends;
    }
  }

  _factors  = factors;
  _backends = backends;
  _loaded   = true;
  refreshSnapshot();
}

export function loadFactorCatalog() {
  if (_loaded) return Promise.resolve();
  if (_promise) return _promise;
  _loading = true;
  _promise = fetchCatalog()
    .catch(err => {
      console.warn('[factorCatalog] fetch failed, using static fallback:', err);
    })
    .finally(() => {
      _loading = false;
    });
  return _promise;
}

// ── Sync accessors (for non-React consumers like helpers.js) ─────────────────
export const getFactors           = () => _factors;
export const getBackendExpansions = () => _backends;
export const getFactorById        = (id) => _factors.find(f => f.id === id);

// ── React hook ───────────────────────────────────────────────────────────────
export function useFactorCatalog() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => { loadFactorCatalog(); }, []);
  return {
    factors:  snap.factors,
    backends: snap.backends,
    loaded:   snap.loaded,
    loading:  _loading,
  };
}
