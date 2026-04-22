/**
 * OptionPricingWidget — QuantLib option pricing & Greeks calculator.
 *
 * Unlike data-driven widgets, this one takes user inputs (spot/strike/etc.)
 * and calls /api/quantlib/pricing/option to compute results locally via
 * QuantLib-Python. Results: NPV + 5 Greeks + intrinsic/time value breakdown.
 */
import { useState, useCallback, useMemo } from 'react';
import { Calculator, Play, TrendingUp, TrendingDown } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import { apiClient, API_BASE } from '../../config/api';

// ── Date helpers ──────────────────────────────────────────────────────────────
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function todayISO() {
  return isoDate(new Date());
}
function defaultExpiryISO() {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return isoDate(d);
}

// ── Formatters ────────────────────────────────────────────────────────────────
function fmt(v, digits = 4) {
  if (v == null || Number.isNaN(v)) return '—';
  return Number(v).toFixed(digits);
}
function fmtUSD(v) {
  if (v == null) return '—';
  return `$${Number(v).toFixed(2)}`;
}

// ── Input Row ────────────────────────────────────────────────────────────────
function Field({ label, children, hint }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wide text-gray-500">{label}</label>
      {children}
      {hint && <span className="text-[10px] text-gray-600">{hint}</span>}
    </div>
  );
}

const inputCls =
  'bg-[#0a0a0f] border border-gray-800 rounded px-2 py-1.5 text-xs text-gray-200 ' +
  'outline-none focus:border-cyan-700 tabular-nums';

// ── Greek Card ────────────────────────────────────────────────────────────────
function GreekCard({ label, value, hint, accent }) {
  const colorCls =
    accent === 'primary' ? 'text-cyan-400'
    : accent === 'positive' ? 'text-emerald-400'
    : accent === 'negative' ? 'text-red-400'
    : 'text-gray-200';
  return (
    <div className="bg-[#111118] rounded-lg p-2.5 border border-gray-800/60">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">{label}</div>
      <div className={`text-sm font-bold tabular-nums ${colorCls}`}>{value}</div>
      {hint && <div className="text-[10px] text-gray-600 mt-0.5">{hint}</div>}
    </div>
  );
}

// ── Widget ────────────────────────────────────────────────────────────────────
export default function OptionPricingWidget({ onRemove }) {
  const [form, setForm] = useState({
    option_type: 'call',
    exercise_style: 'european',
    engine: 'analytic',
    spot: 100,
    strike: 100,
    expiry: defaultExpiryISO(),
    evaluation_date: todayISO(),
    volatility: 0.20,
    risk_free_rate: 0.04,
    dividend_yield: 0.0,
  });
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const set = (k) => (e) => {
    const v = e?.target?.value ?? e;
    setForm(f => ({ ...f, [k]: v }));
  };

  const setNum = (k) => (e) => {
    const v = e.target.value;
    setForm(f => ({ ...f, [k]: v === '' ? '' : Number(v) }));
  };

  // analytic + american is invalid, auto-swap to binomial if user picks it
  const effectiveEngine = useMemo(() => {
    if (form.exercise_style === 'american' && form.engine === 'analytic') return 'binomial';
    return form.engine;
  }, [form.exercise_style, form.engine]);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        option_type:     form.option_type,
        exercise_style:  form.exercise_style,
        engine:          effectiveEngine,
        spot:            String(form.spot),
        strike:          String(form.strike),
        expiry:          form.expiry,
        evaluation_date: form.evaluation_date,
        volatility:      String(form.volatility),
        risk_free_rate:  String(form.risk_free_rate),
        dividend_yield:  String(form.dividend_yield),
      });
      const res = await apiClient.get(`${API_BASE}/quantlib/pricing/option?${qs}`);
      setResult(res?.result ?? null);
    } catch (e) {
      setError(e.detail || e.message || 'Computation failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [form, effectiveEngine]);

  const moneyness = useMemo(() => {
    const { spot, strike, option_type } = form;
    if (!spot || !strike) return null;
    const call = option_type === 'call';
    const itm = call ? spot > strike : spot < strike;
    const atm = Math.abs(spot - strike) / strike < 0.005;
    return atm ? 'ATM' : itm ? 'ITM' : 'OTM';
  }, [form]);

  return (
    <BaseWidget
      title="Option Pricing"
      subtitle="QuantLib · Black-Scholes / Binomial / MC"
      icon={Calculator}
      iconColor="text-cyan-400"
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
      source="QuantLib 1.42 (local computation)"
    >
      <div className="p-3 space-y-3">
        {/* ── Input Form ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Option Type">
            <select className={inputCls} value={form.option_type} onChange={set('option_type')}>
              <option value="call">Call</option>
              <option value="put">Put</option>
            </select>
          </Field>
          <Field label="Exercise">
            <select className={inputCls} value={form.exercise_style} onChange={set('exercise_style')}>
              <option value="european">European</option>
              <option value="american">American</option>
            </select>
          </Field>
          <Field label="Engine" hint={effectiveEngine !== form.engine ? `auto → ${effectiveEngine}` : null}>
            <select className={inputCls} value={form.engine} onChange={set('engine')}>
              <option value="analytic">Analytic (Black-Scholes)</option>
              <option value="binomial">Binomial (CRR)</option>
              <option value="mc">Monte Carlo</option>
            </select>
          </Field>
          <Field label="Moneyness" hint="S vs K">
            <div className={`${inputCls} flex items-center justify-between`}>
              <span className="text-gray-200">{moneyness ?? '—'}</span>
              <span className="text-[10px] text-gray-500">
                {form.spot && form.strike ? `S/K = ${(form.spot / form.strike).toFixed(3)}` : ''}
              </span>
            </div>
          </Field>
          <Field label="Spot Price (S)">
            <input type="number" step="0.01" className={inputCls} value={form.spot} onChange={setNum('spot')} />
          </Field>
          <Field label="Strike Price (K)">
            <input type="number" step="0.01" className={inputCls} value={form.strike} onChange={setNum('strike')} />
          </Field>
          <Field label="Evaluation Date">
            <input type="date" className={inputCls} value={form.evaluation_date} onChange={set('evaluation_date')} />
          </Field>
          <Field label="Expiry Date">
            <input type="date" className={inputCls} value={form.expiry} onChange={set('expiry')} />
          </Field>
          <Field label="Volatility (σ)" hint="annual, 0.20 = 20%">
            <input type="number" step="0.01" className={inputCls} value={form.volatility} onChange={setNum('volatility')} />
          </Field>
          <Field label="Risk-Free Rate (r)" hint="annual, 0.04 = 4%">
            <input type="number" step="0.001" className={inputCls} value={form.risk_free_rate} onChange={setNum('risk_free_rate')} />
          </Field>
          <Field label="Dividend Yield (q)">
            <input type="number" step="0.001" className={inputCls} value={form.dividend_yield} onChange={setNum('dividend_yield')} />
          </Field>
        </div>

        {/* ── Execute ─────────────────────────────────────────────────────── */}
        <button
          onClick={execute}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold text-xs py-2 rounded transition-colors"
        >
          <Play size={12} />
          {loading ? 'Computing…' : 'Compute'}
        </button>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* ── Results ─────────────────────────────────────────────────────── */}
        {result && (
          <div className="space-y-3 pt-2 border-t border-gray-800">
            {/* Big NPV card */}
            <div className="bg-gradient-to-br from-cyan-900/20 to-[#0a0a0f] border border-cyan-900/40 rounded-lg p-4">
              <div className="text-[10px] uppercase tracking-wider text-cyan-500 mb-1">
                {result.option_type.toUpperCase()} · {result.exercise_style} · {result.engine}
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-bold text-cyan-300 tabular-nums">{fmtUSD(result.npv)}</span>
                <span className="text-[11px] text-gray-500">
                  intrinsic {fmtUSD(result.intrinsic_value)} + time {fmtUSD(result.time_value)}
                </span>
              </div>
              <div className="mt-1 text-[10px] text-gray-600 tabular-nums">
                T = {fmt(result.time_to_expiry, 3)}y · {result.days_to_expiry} days
              </div>
            </div>

            {/* Greeks grid */}
            <div className="grid grid-cols-5 gap-2">
              <GreekCard
                label="Δ Delta"
                value={fmt(result.delta, 4)}
                hint="∂V/∂S"
                accent={result.delta > 0 ? 'positive' : result.delta < 0 ? 'negative' : null}
              />
              <GreekCard label="Γ Gamma"  value={fmt(result.gamma, 4)}  hint="∂²V/∂S²" />
              <GreekCard label="ν Vega"   value={fmt(result.vega, 4)}   hint="per 1%σ" accent="primary" />
              <GreekCard label="Θ Theta"  value={fmt(result.theta, 3)}  hint="per year" accent="negative" />
              <GreekCard label="ρ Rho"    value={fmt(result.rho, 4)}    hint="per 1%r" />
            </div>

            {/* Inputs echo (collapsible-lite) */}
            <details className="text-[11px] text-gray-500">
              <summary className="cursor-pointer hover:text-gray-300 select-none">Show inputs echo</summary>
              <div className="mt-2 grid grid-cols-3 gap-2 p-2 bg-[#0a0a0f] rounded border border-gray-800">
                <div>Spot: <span className="tabular-nums text-gray-300">{result.spot}</span></div>
                <div>Strike: <span className="tabular-nums text-gray-300">{result.strike}</span></div>
                <div>σ: <span className="tabular-nums text-gray-300">{result.volatility}</span></div>
                <div>r: <span className="tabular-nums text-gray-300">{result.risk_free_rate}</span></div>
                <div>q: <span className="tabular-nums text-gray-300">{result.dividend_yield}</span></div>
                <div>Expiry: <span className="tabular-nums text-gray-300">{result.expiry}</span></div>
              </div>
            </details>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
