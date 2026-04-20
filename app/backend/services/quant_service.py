"""
Quant Strategy Service
Single-stock strategy backtesting with signal generation and performance metrics.

Technical presets (EMA Cross / RSI / MACD / BB) are now expressed as templates
stored in quant_strategy_types.template and executed through _run_custom.
Heston (FFT-based) and macro engines keep their native implementations.
"""
import ast
import sys
import json
import logging
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Any, Dict, List, Optional

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from data_fetcher.query_executor import QueryExecutor

log = logging.getLogger(__name__)


# ─── Indicator Calculators ─────────────────────────────────────────────────────

def _ema(prices: np.ndarray, period: int) -> np.ndarray:
    """Exponential Moving Average"""
    period = int(period)
    result = np.full(len(prices), np.nan)
    if len(prices) < period:
        return result
    result[period - 1] = np.mean(prices[:period])
    k = 2.0 / (period + 1)
    for i in range(period, len(prices)):
        result[i] = prices[i] * k + result[i - 1] * (1 - k)
    return result


def _sma(prices: np.ndarray, period: int) -> np.ndarray:
    """Simple Moving Average"""
    period = int(period)
    result = np.full(len(prices), np.nan)
    for i in range(period - 1, len(prices)):
        result[i] = np.mean(prices[i - period + 1 : i + 1])
    return result


def _rsi(prices: np.ndarray, period: int = 14) -> np.ndarray:
    """Relative Strength Index"""
    period = int(period)
    result = np.full(len(prices), np.nan)
    if len(prices) <= period:
        return result
    deltas = np.diff(prices)
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)
    avg_gain = np.mean(gains[:period])
    avg_loss = np.mean(losses[:period])
    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        rs = avg_gain / avg_loss if avg_loss != 0 else 1e9
        result[i + 1] = 100 - (100 / (1 + rs))
    return result


def _macd(prices: np.ndarray, fast: int = 12, slow: int = 26, signal: int = 9):
    """MACD line, Signal line, Histogram"""
    fast   = int(fast   or 12)
    slow   = int(slow   or 26)
    signal = int(signal or 9)
    ema_fast = _ema(prices, fast)
    ema_slow = _ema(prices, slow)
    macd_line = ema_fast - ema_slow
    valid = ~np.isnan(macd_line)
    signal_line = np.full(len(prices), np.nan)
    if valid.sum() >= signal:
        idx = np.where(valid)[0]
        sig = _ema(macd_line[idx], signal)
        signal_line[idx] = sig
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def _bollinger(prices: np.ndarray, period: int = 20, std_dev: float = 2.0):
    """Upper band, Middle (SMA), Lower band"""
    period = int(period)
    mid = _sma(prices, period)
    upper = np.full(len(prices), np.nan)
    lower = np.full(len(prices), np.nan)
    for i in range(period - 1, len(prices)):
        std = np.std(prices[i - period + 1 : i + 1], ddof=0)
        upper[i] = mid[i] + std_dev * std
        lower[i] = mid[i] - std_dev * std
    return upper, mid, lower


# ─── Strategy Engines ──────────────────────────────────────────────────────────

# ─── Additional Indicators ────────────────────────────────────────────────────

def _atr(high: np.ndarray, low: np.ndarray, close: np.ndarray, period: int = 14) -> np.ndarray:
    """Average True Range (Wilder smoothing)"""
    period = int(period)
    n = len(close)
    result = np.full(n, np.nan)
    if n < 2:
        return result
    tr = np.zeros(n)
    tr[0] = high[0] - low[0]
    for i in range(1, n):
        tr[i] = max(high[i] - low[i], abs(high[i] - close[i - 1]), abs(low[i] - close[i - 1]))
    if n < period:
        return result
    result[period - 1] = np.mean(tr[:period])
    for i in range(period, n):
        result[i] = (result[i - 1] * (period - 1) + tr[i]) / period
    return result


def _stochastic(high: np.ndarray, low: np.ndarray, close: np.ndarray,
                k_period: int = 14, d_period: int = 3):
    """Stochastic Oscillator %K and %D"""
    k_period, d_period = int(k_period), int(d_period)
    n = len(close)
    k = np.full(n, np.nan)
    for i in range(k_period - 1, n):
        hh = np.max(high[i - k_period + 1 : i + 1])
        ll = np.min(low[i - k_period + 1 : i + 1])
        k[i] = (close[i] - ll) / (hh - ll) * 100 if hh != ll else 50.0
    d = _sma(k, d_period)
    return k, d


def _zscore(prices: np.ndarray, window: int = 20) -> np.ndarray:
    """Rolling Z-score: (price - SMA) / std"""
    window = int(window)
    result = np.full(len(prices), np.nan)
    for i in range(window - 1, len(prices)):
        window_data = prices[i - window + 1 : i + 1]
        std = np.std(window_data, ddof=0)
        if std > 0:
            result[i] = (prices[i] - np.mean(window_data)) / std
    return result


def _percentile(prices: np.ndarray, window: int = 60) -> np.ndarray:
    """Rolling percentile rank (0~100): how current price ranks within window"""
    window = int(window)
    result = np.full(len(prices), np.nan)
    for i in range(window - 1, len(prices)):
        window_data = prices[i - window + 1 : i + 1]
        result[i] = (np.sum(window_data <= prices[i]) / window) * 100
    return result


def _vwap(high: np.ndarray, low: np.ndarray, close: np.ndarray, volume: np.ndarray) -> np.ndarray:
    """Cumulative VWAP using typical price"""
    tp = (high + low + close) / 3.0
    safe_vol = np.where(volume == 0, 1, volume)
    return np.cumsum(tp * safe_vol) / np.cumsum(safe_vol)


# ─── Chart: Market Structure Factors ──────────────────────────────────────────

def _volume_profile(
    high: np.ndarray,
    low: np.ndarray,
    close: np.ndarray,
    volume: np.ndarray,
    lookback: int = 30,
    bins: int = 20,
) -> tuple:
    """Rolling volume profile. Returns (poc, vah, val) price-level series."""
    n = len(close)
    poc = np.full(n, np.nan)
    vah = np.full(n, np.nan)
    val = np.full(n, np.nan)
    if lookback < 2 or bins < 2:
        return poc, vah, val

    typical = (high + low + close) / 3.0
    for i in range(lookback, n):
        lo = i - lookback + 1
        hi_p = float(np.max(high[lo:i + 1]))
        lo_p = float(np.min(low[lo:i + 1]))
        if hi_p <= lo_p:
            continue
        edges = np.linspace(lo_p, hi_p, bins + 1)
        hist, _ = np.histogram(typical[lo:i + 1], bins=edges, weights=volume[lo:i + 1])
        total = hist.sum()
        if total <= 0:
            continue
        poc_idx = int(np.argmax(hist))
        poc[i] = (edges[poc_idx] + edges[poc_idx + 1]) / 2.0

        # Value area: expand from POC until 70% volume covered
        target = 0.7 * total
        acc = hist[poc_idx]
        lo_idx, hi_idx = poc_idx, poc_idx
        while acc < target and (lo_idx > 0 or hi_idx < bins - 1):
            left  = hist[lo_idx - 1] if lo_idx > 0        else -1.0
            right = hist[hi_idx + 1] if hi_idx < bins - 1 else -1.0
            if right >= left:
                hi_idx += 1
                acc += hist[hi_idx]
            else:
                lo_idx -= 1
                acc += hist[lo_idx]
        val[i] = float(edges[lo_idx])
        vah[i] = float(edges[hi_idx + 1])
    return poc, vah, val


def _liquidity_sweep(
    high: np.ndarray,
    low: np.ndarray,
    close: np.ndarray,
    lookback: int = 20,
) -> tuple:
    """Detect liquidity sweep events. Returns (sweep_high, sweep_low) as 0/1 arrays.

    sweep_high[i] = 1  when bar i prints a high > max(high[i-lookback..i-1])
                        but close[i] retraces below that prior high.
    Symmetric for sweep_low.
    """
    n = len(close)
    sh = np.zeros(n)
    sl = np.zeros(n)
    if lookback < 1:
        return sh, sl
    for i in range(lookback, n):
        prev_hi = float(np.max(high[i - lookback:i]))
        prev_lo = float(np.min(low[i - lookback:i]))
        if high[i] > prev_hi and close[i] < prev_hi:
            sh[i] = 1.0
        if low[i] < prev_lo and close[i] > prev_lo:
            sl[i] = 1.0
    return sh, sl


def _hmm_regime(
    close: np.ndarray,
    n_states: int = 3,
    train_window: int = 252,
    refit_every: int = 20,
) -> tuple:
    """Rolling Gaussian-HMM regime detection.

    Returns (state, bull_prob) — state relabelled by ascending mean return so
    0=bear, n_states-1=bull. Returns NaN arrays if hmmlearn is not installed.
    """
    n = len(close)
    state = np.full(n, np.nan)
    bull_prob = np.full(n, np.nan)

    try:
        from hmmlearn.hmm import GaussianHMM
    except ImportError:
        log.warning("hmmlearn not installed — HMM regime factor returns NaN")
        return state, bull_prob

    if n < train_window + 5:
        return state, bull_prob

    log_c = np.log(np.maximum(close, 1e-12))
    rets = np.diff(log_c, prepend=log_c[0])
    vol_win = 10
    vol = np.zeros(n)
    for i in range(vol_win, n):
        vol[i] = float(np.std(rets[i - vol_win:i]))

    model = None
    relabel: np.ndarray = np.arange(n_states)
    bull_idx = n_states - 1

    for i in range(train_window, n):
        refit = (model is None) or ((i - train_window) % max(refit_every, 1) == 0)
        if refit:
            X = np.column_stack([
                rets[i - train_window:i + 1],
                vol[i - train_window:i + 1],
            ])
            try:
                model = GaussianHMM(
                    n_components=int(n_states),
                    covariance_type="diag",
                    n_iter=50,
                    random_state=42,
                )
                model.fit(X)
                state_means = model.means_[:, 0]
                order = np.argsort(state_means)        # ascending return → 0=bear
                relabel = np.empty_like(order)
                for rank, s in enumerate(order):
                    relabel[s] = rank
                bull_idx = int(order[-1])
            except Exception as e:
                log.warning(f"HMM refit failed at i={i}: {e}")
                continue

        X_now = np.column_stack([
            rets[i - train_window:i + 1],
            vol[i - train_window:i + 1],
        ])
        try:
            hidden = model.predict(X_now)
            post   = model.predict_proba(X_now)
            state[i]     = float(relabel[hidden[-1]])
            bull_prob[i] = float(post[-1, bull_idx])
        except Exception:
            pass
    return state, bull_prob


# ─── Shared Volatility Helper ─────────────────────────────────────────────────

def _rolling_realized_var(closes: np.ndarray, window: int) -> np.ndarray:
    """Annualised realised variance via log-return std².  Used by both the
    custom factor engine and the Heston strategy engines."""
    log_rets = np.log(closes[1:] / np.maximum(closes[:-1], 1e-12))
    rv = np.full(len(closes), np.nan)
    for i in range(window, len(closes)):
        rv[i] = np.var(log_rets[i - window: i], ddof=0) * 252
    return rv


# ─── Options Pricing: Carr-Madan FFT ──────────────────────────────────────────
#
# C(k) = (e^{-αk}/π) ∫₀^∞ Re[e^{-iuk} · e^{-rT}·φ(u−i(α+1)) / (α²+α−u²+i(2α+1)u)] du
# Reference: Carr & Madan (1999) "Option valuation using the fast Fourier transform"

def _ncdf(x: np.ndarray) -> np.ndarray:
    """Normal CDF via Abramowitz & Stegun approximation (max error 7.5e-8)."""
    z = np.abs(x)
    t = 1.0 / (1.0 + 0.2316419 * z)
    poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937
                + t * (-1.821255978 + t * 1.330274429))))
    cdf = 1.0 - np.exp(-0.5 * z * z) / np.sqrt(2.0 * np.pi) * poly
    return np.where(x >= 0.0, cdf, 1.0 - cdf)


def _npdf(x: np.ndarray) -> np.ndarray:
    return np.exp(-0.5 * x * x) / np.sqrt(2.0 * np.pi)


def _bs_cf_unit(u: np.ndarray, r: float, T: float, sigma: float) -> np.ndarray:
    """Black-Scholes characteristic function of log(S_T) at S=1 (log S=0)."""
    return np.exp(
        1j * u * (r - 0.5 * sigma ** 2) * T
        - 0.5 * sigma ** 2 * T * u ** 2
    )


def _heston_cf_unit(u: np.ndarray, r: float, T: float,
                    v0: float, kappa: float, theta: float,
                    xi: float, rho: float) -> np.ndarray:
    """
    Heston characteristic function at S=1.
    Albrecher et al. (2007) numerically stable formulation.
    """
    b       = kappa - rho * xi * 1j * u
    d       = np.sqrt(b ** 2 + xi ** 2 * (u ** 2 + 1j * u))
    g       = (b - d) / (b + d)
    exp_dT  = np.exp(-d * T)
    A = (kappa * theta / xi ** 2) * (
        (b - d) * T - 2.0 * np.log((1.0 - g * exp_dT) / (1.0 - g))
    )
    B = ((b - d) / xi ** 2) * (1.0 - exp_dT) / (1.0 - g * exp_dT)
    return np.exp(A + B * v0 + 1j * u * r * T)


def _fft_call_unit(K_rel: float, r: float, T: float, cf_unit,
                   alpha: float = 1.5, N: int = 512, eta: float = 0.25) -> float:
    """
    European call price for unit spot S=1, strike K=K_rel via Carr-Madan FFT.
    Actual series price: C(S_t, K_t = S_t*K_rel) = S_t * fft_call_unit(K_rel)
    thanks to model homogeneity.
    """
    if K_rel <= 0 or T <= 1e-10:
        return float(max(1.0 - K_rel * np.exp(-r * T), 0.0))

    lam    = 2.0 * np.pi / (N * eta)
    b      = N * lam / 2.0
    k_grid = -b + lam * np.arange(N, dtype=float)
    v      = eta * np.arange(N, dtype=float)

    phi   = cf_unit(v - 1j * (alpha + 1.0))
    denom = alpha ** 2 + alpha - v ** 2 + 1j * (2.0 * alpha + 1.0) * v
    psi   = np.exp(-r * T) * phi / denom

    # Modified Simpson weights
    w = np.ones(N, dtype=float)
    w[0] = w[-1] = 1.0 / 3.0
    w[1:-1:2] = 4.0 / 3.0
    w[2:-2:2] = 2.0 / 3.0
    w *= eta

    fft_out     = np.real(np.fft.fft(np.exp(1j * v * b) * psi * w))
    call_prices = np.exp(-alpha * k_grid) / np.pi * fft_out

    log_K = np.log(K_rel)
    if log_K < k_grid[0] or log_K > k_grid[-1]:
        return float(max(1.0 - K_rel * np.exp(-r * T), 0.0))
    return float(max(np.interp(log_K, k_grid, call_prices), 0.0))


def _fft_delta_unit(K_rel: float, r: float, T: float, cf_unit,
                    eps: float = 0.005) -> float:
    """Delta at S=1 via central finite difference in log S (2 extra FFT calls)."""
    def cf_bump(shift):
        return lambda u: cf_unit(u) * np.exp(1j * u * shift)

    p_up = _fft_call_unit(K_rel, r, T, cf_bump( eps))
    p_dn = _fft_call_unit(K_rel, r, T, cf_bump(-eps))
    return (p_up - p_dn) / (2.0 * eps)


def _bs_greeks_series(close: np.ndarray, r: float, T: float,
                      sigma: float, moneyness: float) -> dict:
    """
    Analytical Black-Scholes Greeks for a rolling fixed-moneyness call.
    K_t = close_t * (1 + moneyness)
    """
    T_s   = max(T, 1e-8)
    sig_s = max(sigma, 1e-6)
    K     = np.maximum(close * (1.0 + moneyness), 1e-8)
    sq_T  = np.sqrt(T_s)
    d1    = (np.log(close / K) + (r + 0.5 * sig_s ** 2) * T_s) / (sig_s * sq_T)
    d2    = d1 - sig_s * sq_T
    nd1   = _npdf(d1)
    Nd1   = _ncdf(d1)
    Nd2   = _ncdf(d2)
    delta = Nd1
    gamma = nd1 / np.maximum(close * sig_s * sq_T, 1e-12)
    theta = ((-close * nd1 * sig_s / (2.0 * sq_T))
             - r * K * np.exp(-r * T_s) * Nd2) / 365.0
    vega  = close * nd1 * sq_T / 100.0
    return {'delta': delta, 'gamma': gamma, 'theta': theta, 'vega': vega}


# ─── Safe Formula Evaluator ───────────────────────────────────────────────────
#
# Expression → numpy array. Allowed: numbers, variable names, + - * / % **,
# unary -, parentheses, abs(), min(), max(), log(), exp(), sqrt().
# Comparison/logical ops are not supported here — a Formula is a SCALAR series;
# comparisons happen in _eval_cond once the resulting array is plugged into a
# condition's left/right side.

_FORMULA_FUNCS = {
    "abs":  np.abs,
    "min":  np.minimum,
    "max":  np.maximum,
    "log":  np.log,
    "exp":  np.exp,
    "sqrt": np.sqrt,
}

_BIN_OPS = {
    ast.Add:      np.add,
    ast.Sub:      np.subtract,
    ast.Mult:     np.multiply,
    ast.Div:      np.divide,
    ast.Mod:      np.mod,
    ast.Pow:      np.power,
    ast.FloorDiv: np.floor_divide,
}


def _eval_formula_node(node: ast.AST, resolved: Dict[str, np.ndarray], length: int) -> np.ndarray:
    if isinstance(node, ast.Expression):
        return _eval_formula_node(node.body, resolved, length)
    if isinstance(node, ast.Constant):
        if not isinstance(node.value, (int, float)):
            raise ValueError(f"Formula: unsupported constant {node.value!r}")
        return np.full(length, float(node.value))
    if isinstance(node, ast.Num):  # py<3.8 fallback
        return np.full(length, float(node.n))
    if isinstance(node, ast.Name):
        if node.id not in resolved:
            raise ValueError(f"Formula: unknown variable '{node.id}'")
        return resolved[node.id]
    if isinstance(node, ast.UnaryOp):
        v = _eval_formula_node(node.operand, resolved, length)
        if isinstance(node.op, ast.USub): return -v
        if isinstance(node.op, ast.UAdd): return v
        raise ValueError("Formula: unsupported unary op")
    if isinstance(node, ast.BinOp):
        op_fn = _BIN_OPS.get(type(node.op))
        if not op_fn:
            raise ValueError(f"Formula: unsupported operator {type(node.op).__name__}")
        l = _eval_formula_node(node.left,  resolved, length)
        r = _eval_formula_node(node.right, resolved, length)
        return op_fn(l, r)
    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name) or node.func.id not in _FORMULA_FUNCS:
            raise ValueError(f"Formula: unknown function")
        fn   = _FORMULA_FUNCS[node.func.id]
        args = [_eval_formula_node(a, resolved, length) for a in node.args]
        return fn(*args)
    raise ValueError(f"Formula: unsupported syntax {type(node).__name__}")


def _eval_formula(series: Dict, expression: str, variables: Dict[str, Dict]) -> np.ndarray:
    """
    Evaluate a formula like 'ema1 * 0.95 + 10' into a numpy series.
    `variables` maps each free name in the expression to a factor_def which is
    computed with _compute_factor on the same OHLCV series.
    """
    if not expression or not expression.strip():
        return np.full(len(series["close"]), np.nan)
    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as e:
        raise ValueError(f"Formula syntax error: {e.msg}")
    resolved: Dict[str, np.ndarray] = {}
    length = len(series["close"])
    for name in {n.id for n in ast.walk(tree) if isinstance(n, ast.Name)}:
        if name in _FORMULA_FUNCS:  # function names, not vars
            continue
        var_def = variables.get(name)
        if not var_def:
            # Allow bare price references as a fallback
            upper = name.upper()
            if upper in ("CLOSE", "OPEN", "HIGH", "LOW", "VOLUME"):
                var_def = {"factor": upper, "params": {}}
            else:
                raise ValueError(f"Formula: variable '{name}' not defined")
        resolved[name] = _compute_factor(series, var_def)
    return _eval_formula_node(tree.body, resolved, length)


# ─── Custom Factor Engine ──────────────────────────────────────────────────────

def _compute_factor(series: Dict, factor_def: Dict) -> np.ndarray:
    """
    Compute an indicator series from OHLCV data.
    factor_def: {"factor": "EMA", "params": {"period": 20}}
               {"factor": "VALUE", "value": 30}
    """
    factor = factor_def.get("factor", "CLOSE")
    p = factor_def.get("params", {})
    c = series["close"]
    n = len(c)

    if factor == "EMA":
        return _ema(c, int(p.get("period", 20)))
    if factor == "SMA":
        return _sma(c, int(p.get("period", 50)))
    if factor == "RSI":
        return _rsi(c, int(p.get("period", 14)))
    if factor in ("MACD_LINE", "MACD_SIGNAL", "MACD_HIST"):
        ml, ms, mh = _macd(c, int(p.get("fast", 12)), int(p.get("slow", 26)), int(p.get("signal", 9)))
        return {"MACD_LINE": ml, "MACD_SIGNAL": ms, "MACD_HIST": mh}[factor]
    if factor == "BB_UPPER":
        u, _, _ = _bollinger(c, int(p.get("period", 20)), float(p.get("std_dev", p.get("std", 2.0))))
        return u
    if factor == "BB_LOWER":
        _, _, lo = _bollinger(c, int(p.get("period", 20)), float(p.get("std_dev", p.get("std", 2.0))))
        return lo
    if factor == "BB_MID":
        _, m, _ = _bollinger(c, int(p.get("period", 20)), float(p.get("std_dev", p.get("std", 2.0))))
        return m
    if factor == "ATR":
        return _atr(series["high"], series["low"], c, int(p.get("period", 14)))
    if factor == "STOCH_K":
        k, _ = _stochastic(series["high"], series["low"], c,
                            int(p.get("k_period", 14)), int(p.get("d_period", 3)))
        return k
    if factor == "STOCH_D":
        _, d = _stochastic(series["high"], series["low"], c,
                            int(p.get("k_period", 14)), int(p.get("d_period", 3)))
        return d
    if factor == "VWAP":
        return _vwap(series["high"], series["low"], c, series["volume"])
    # ── Chart: Volume Profile / Liquidity Sweep / HMM Regime ──────────────────
    if factor in ("CHART_VP_POC", "CHART_VP_VAH", "CHART_VP_VAL"):
        poc, vah, val = _volume_profile(
            series["high"], series["low"], c,
            series.get("volume", np.ones(n)),
            lookback=int(p.get("lookback", 30)),
            bins=int(p.get("bins", 20)),
        )
        return {"CHART_VP_POC": poc, "CHART_VP_VAH": vah, "CHART_VP_VAL": val}[factor]
    if factor in ("CHART_LIQ_SWEEP_HIGH", "CHART_LIQ_SWEEP_LOW"):
        sh, sl = _liquidity_sweep(
            series["high"], series["low"], c,
            lookback=int(p.get("lookback", 20)),
        )
        return {"CHART_LIQ_SWEEP_HIGH": sh, "CHART_LIQ_SWEEP_LOW": sl}[factor]
    if factor in ("CHART_HMM_STATE", "CHART_HMM_BULL_PROB"):
        state, bull_prob = _hmm_regime(
            c,
            n_states=int(p.get("n_states", 3)),
            train_window=int(p.get("train_window", 252)),
            refit_every=int(p.get("refit_every", 20)),
        )
        return {"CHART_HMM_STATE": state, "CHART_HMM_BULL_PROB": bull_prob}[factor]
    if factor == "ZSCORE":
        return _zscore(c, int(p.get("window", 20)))
    if factor == "PERCENTILE":
        return _percentile(c, int(p.get("window", 60)))
    # External-data factors — return neutral series until backend integration
    if factor in ("BETA", "CORR", "REL_STR"):
        return np.ones(n)           # neutral: 1.0
    if factor in ("NEWS_SENTIMENT", "NEWS_VOLUME", "SENTIMENT_DELTA"):
        return np.zeros(n)          # neutral: 0.0
    # Macro / Fund / etc — use pre-fetched series if available, else NaN
    if factor.startswith(("MACRO_", "MICRO_", "FUND_", "SUPPLY_", "ALT_")):
        if series is not None and factor in series:
            return series[factor]
        log.warning(f"External factor {factor} not pre-fetched — returning NaN")
        return np.full(n, np.nan)
    if factor == "CLOSE":
        return c
    if factor == "OPEN":
        return series.get("open", c)
    if factor == "HIGH":
        return series["high"]
    if factor == "LOW":
        return series["low"]
    if factor == "VOLUME":
        return series.get("volume", np.zeros(n))
    if factor == "VALUE":
        return np.full(n, float(factor_def.get("value", 0)))
    if factor == "FORMULA":
        return _eval_formula(
            series,
            factor_def.get("expression", ""),
            factor_def.get("variables", {}) or {},
        )

    # ── Options pricing (Carr-Madan FFT) ──────────────────────────────────────
    if factor.startswith("OPT_BS") or factor.startswith("OPT_HESTON"):
        r_pct     = float(p.get("r", 5.0)) / 100.0
        T_yr      = float(p.get("T", 0.25))
        mono      = float(p.get("moneyness", 0.0)) / 100.0  # e.g. 0.05 = 5% OTM
        K_rel     = 1.0 + mono                               # K = S * K_rel

        if factor.startswith("OPT_BS"):
            sig = float(p.get("sigma", 25.0)) / 100.0
            cf  = lambda u: _bs_cf_unit(u, r_pct, T_yr, sig)  # noqa: E731

            if factor == "OPT_BS_PRICE":
                unit = _fft_call_unit(K_rel, r_pct, T_yr, cf)
                return c * unit

            # Greeks (analytical)
            g = _bs_greeks_series(c, r_pct, T_yr, sig, mono)
            if factor == "OPT_BS_DELTA":
                return g["delta"]
            if factor == "OPT_BS_GAMMA":
                return g["gamma"]
            if factor == "OPT_BS_THETA":
                return g["theta"]
            if factor == "OPT_BS_VEGA":
                return g["vega"]

        if factor.startswith("OPT_HESTON"):
            kappa = float(p.get("kappa", 2.0))
            theta = float(p.get("theta", 4.0))  / 100.0
            xi    = float(p.get("xi",    0.5))
            rho   = float(p.get("rho",  -0.7))

            # OPT_HESTON_VOL: rolling realised annualised vol (no FFT needed)
            if factor == "OPT_HESTON_VOL":
                window = int(p.get("window", 30))
                return np.sqrt(np.maximum(_rolling_realized_var(c, window), 0))

            # For price/delta: use rolling realised variance as dynamic v0
            if factor in ("OPT_HESTON_PRICE", "OPT_HESTON_DELTA"):
                window   = int(p.get("window", 30))
                rv_series = _rolling_realized_var(c, window)
                out = np.full(n, np.nan)
                for i in range(window, n):
                    v0_i = float(np.clip(rv_series[i], 1e-6, 4.0))
                    cf_i = lambda u, _v=v0_i: _heston_cf_unit(
                        u, r_pct, T_yr, _v, kappa, theta, xi, rho
                    )
                    if factor == "OPT_HESTON_PRICE":
                        out[i] = c[i] * _fft_call_unit(K_rel, r_pct, T_yr, cf_i)
                    else:
                        out[i] = _fft_delta_unit(K_rel, r_pct, T_yr, cf_i)
                return out

            # Legacy: static v0 from params (backwards-compat)
            v0    = float(p.get("v0", 4.0)) / 100.0
            cf    = lambda u: _heston_cf_unit(u, r_pct, T_yr, v0, kappa, theta, xi, rho)  # noqa: E731
            if factor == "OPT_HESTON_PRICE":
                unit = _fft_call_unit(K_rel, r_pct, T_yr, cf)
                return c * unit
            if factor == "OPT_HESTON_DELTA":
                delta_unit = _fft_delta_unit(K_rel, r_pct, T_yr, cf)
                return np.full(n, delta_unit)

    return c  # fallback


def _eval_cond(ls: np.ndarray, op: str, rs: np.ndarray, i: int) -> bool:
    """Evaluate a single condition at bar i."""
    lv, rv = float(ls[i]), float(rs[i])
    if np.isnan(lv) or np.isnan(rv):
        return False
    if op == ">":
        return lv > rv
    if op == "<":
        return lv < rv
    if op == ">=":
        return lv >= rv
    if op == "<=":
        return lv <= rv
    if op == "==":
        return abs(lv - rv) < 1e-9
    if op in ("crosses_above", "crosses_below") and i > 0:
        lp, rp = float(ls[i - 1]), float(rs[i - 1])
        if np.isnan(lp) or np.isnan(rp):
            return False
        if op == "crosses_above":
            return lp <= rp and lv > rv
        return lp >= rp and lv < rv
    return False


def _factor_label(factor_def: Dict) -> str:
    f = factor_def.get("factor", "?")
    if f == "FORMULA":
        expr = factor_def.get("expression", "")
        return f"({expr})" if expr else "(formula)"
    if f == "VALUE":
        return str(factor_def.get("value", 0))
    p = factor_def.get("params", {})
    if not p:
        return f
    vals = ",".join(str(v) for v in p.values())
    return f"{f}({vals})"


def _run_custom(closes: np.ndarray, dates: List[str], cfg: Dict,
                series: Optional[Dict] = None) -> List[Dict]:
    """
    Custom block-based strategy engine.
    Reads buy_conditions / sell_conditions from cfg dict.
    buy_logic: "AND" | "OR"   sell_logic: "AND" | "OR"
    """
    buy_conds = cfg.get("buy_conditions", [])
    sell_conds = cfg.get("sell_conditions", [])
    buy_logic = cfg.get("buy_logic", "AND")
    sell_logic = cfg.get("sell_logic", "OR")

    if not buy_conds:
        return []

    if series is None:
        series = {"close": closes, "high": closes, "low": closes,
                  "open": closes, "volume": np.ones(len(closes))}

    # Pre-compute all factor series
    def build(cond_list):
        out = []
        for c in cond_list:
            ls = _compute_factor(series, c["left"])
            rs = _compute_factor(series, c["right"])
            out.append((ls, c["op"], rs, c))
        return out

    buy_pre = build(buy_conds)
    sell_pre = build(sell_conds)

    def check(pre, logic, i):
        results = [_eval_cond(ls, op, rs, i) for ls, op, rs, _ in pre]
        if not results:
            return False
        return all(results) if logic == "AND" else any(results)

    def make_reason(pre, sep):
        return sep.join(
            f"{_factor_label(c['left'])} {c['op']} {_factor_label(c['right'])}"
            for _, _, _, c in pre
        )

    signals = []
    in_pos = False
    for i in range(1, len(closes)):
        if not in_pos:
            if check(buy_pre, buy_logic, i):
                signals.append({"date": dates[i], "type": "buy", "price": closes[i],
                                 "reason": make_reason(buy_pre, " AND " if buy_logic == "AND" else " OR ")})
                in_pos = True
        else:
            if sell_pre and check(sell_pre, sell_logic, i):
                signals.append({"date": dates[i], "type": "sell", "price": closes[i],
                                 "reason": make_reason(sell_pre, " OR " if sell_logic == "OR" else " AND ")})
                in_pos = False
    return signals


# ─── Heston Model FFT Strategy Engines ───────────────────────────────────────

def _heston_vol_regime(closes: np.ndarray, dates: List[str], cfg: Dict) -> List[Dict]:
    """
    Heston Vol-Regime Strategy
    ──────────────────────────────────────────────────────────────────────
    Rationale  : Heston's mean-reverting variance implies that periods of
                 realised vol *below* θ (long-run variance) are quiet
                 regimes where breakouts are likely.  Vol spikes above a
                 multiple of √θ signal risk-off exits.

    Signal     :
      BUY   when  rv_t / √θ  <  entry_mult  (vol compressed → long entry)
      SELL  when  rv_t / √θ  >  exit_mult   (vol spike → risk-off exit)

    Parameters : theta (%), lookback, entry_mult, exit_mult
    """
    theta      = float(cfg.get("theta",      4.0)) / 100.0   # % → variance
    lookback   = int  (cfg.get("lookback",  30))
    entry_mult = float(cfg.get("entry_mult", 0.80))
    exit_mult  = float(cfg.get("exit_mult",  1.50))

    theta_vol = np.sqrt(theta)           # long-run annualised vol
    rv        = _rolling_realized_var(closes, lookback)
    rv_vol    = np.sqrt(np.maximum(rv, 0))   # annualised realised vol

    signals, in_pos = [], False
    for i in range(1, len(closes)):
        if np.isnan(rv_vol[i]):
            continue
        ratio = rv_vol[i] / max(theta_vol, 1e-9)
        if not in_pos and ratio < entry_mult:
            signals.append({
                "date": dates[i], "type": "buy", "price": closes[i],
                "reason": f"VolRatio={ratio:.2f} < θ_mult={entry_mult} — Low-Vol Regime Entry",
            })
            in_pos = True
        elif in_pos and ratio > exit_mult:
            signals.append({
                "date": dates[i], "type": "sell", "price": closes[i],
                "reason": f"VolRatio={ratio:.2f} > θ_mult={exit_mult} — Vol Spike Exit",
            })
            in_pos = False
    return signals


def _heston_delta_signal(closes: np.ndarray, dates: List[str], cfg: Dict) -> List[Dict]:
    """
    Heston Dynamic Delta Momentum
    ──────────────────────────────────────────────────────────────────────
    Rationale  : Use the Heston-model call delta as a directional indicator.
                 Delta is recalculated each bar using the 30-day rolling
                 realised variance as the instantaneous variance v₀ (instead
                 of a fixed parameter), making it a *live* signal.

                 A delta crossing above buy_thresh confirms bullish momentum
                 priced by the stochastic-vol model (ρ, ξ adjust the smile).
                 Delta crossing below sell_thresh signals bearish momentum.

    Signal     :
      BUY   when  delta_t-1 ≤ buy_thresh  AND  delta_t > buy_thresh
      SELL  when  delta_t-1 ≥ sell_thresh AND  delta_t < sell_thresh

    Parameters : r, T, moneyness, kappa, theta, xi, rho,
                 lookback, delta_buy, delta_sell
    """
    r_pct      = float(cfg.get("r",         5.0))  / 100.0
    T_yr       = float(cfg.get("T",         0.25))
    mono       = float(cfg.get("moneyness", 0.0))  / 100.0
    kappa      = float(cfg.get("kappa",     2.0))
    theta      = float(cfg.get("theta",     4.0))  / 100.0
    xi         = float(cfg.get("xi",        0.5))
    rho        = float(cfg.get("rho",      -0.7))
    lookback   = int  (cfg.get("lookback", 30))
    delta_buy  = float(cfg.get("delta_buy",  0.60))
    delta_sell = float(cfg.get("delta_sell", 0.40))

    K_rel = 1.0 + mono
    rv    = _rolling_realized_var(closes, lookback)

    # Compute delta for each bar using rolling v0
    delta_series = np.full(len(closes), np.nan)
    for i in range(lookback, len(closes)):
        v0_i = float(np.clip(rv[i], 1e-6, 4.0))   # cap at 400% variance
        cf_i = lambda u, _v0=v0_i: _heston_cf_unit(
            u, r_pct, T_yr, _v0, kappa, theta, xi, rho
        )
        delta_series[i] = _fft_delta_unit(K_rel, r_pct, T_yr, cf_i)

    signals, in_pos = [], False
    for i in range(1, len(closes)):
        if np.isnan(delta_series[i]) or np.isnan(delta_series[i - 1]):
            continue
        dp, dc = delta_series[i - 1], delta_series[i]
        if not in_pos and dp <= delta_buy and dc > delta_buy:
            signals.append({
                "date": dates[i], "type": "buy", "price": closes[i],
                "reason": f"Heston Δ={dc:.3f} crosses above {delta_buy} — Bullish Momentum",
            })
            in_pos = True
        elif in_pos and dp >= delta_sell and dc < delta_sell:
            signals.append({
                "date": dates[i], "type": "sell", "price": closes[i],
                "reason": f"Heston Δ={dc:.3f} crosses below {delta_sell} — Momentum Fading",
            })
            in_pos = False
    return signals


def _heston_price_ratio(closes: np.ndarray, dates: List[str], cfg: Dict) -> List[Dict]:
    """
    Heston Option Premium Mean-Reversion
    ──────────────────────────────────────────────────────────────────────
    Rationale  : The ratio  Heston_call_price / spot  is a normalised vol
                 premium.  When it deviates significantly from its rolling
                 mean (Bollinger-style), a mean-reversion opportunity arises
                 in the underlying:
                   • Premium very HIGH → fear/vol overpriced → contrarian BUY
                   • Premium very LOW  → complacency      → caution / SELL

    Signal     :
      BUY   when  z-score of premium_ratio > entry_z  (premium spike reversal)
      SELL  when  z-score of premium_ratio < -exit_z  (premium collapse)

    Parameters : r, T, moneyness, v0, kappa, theta, xi, rho,
                 lookback, premium_lookback, entry_z, exit_z
    """
    r_pct   = float(cfg.get("r",         5.0)) / 100.0
    T_yr    = float(cfg.get("T",         0.25))
    mono    = float(cfg.get("moneyness", 0.0)) / 100.0
    kappa   = float(cfg.get("kappa",     2.0))
    theta   = float(cfg.get("theta",     4.0)) / 100.0
    xi      = float(cfg.get("xi",        0.5))
    rho     = float(cfg.get("rho",      -0.7))
    lookback        = int  (cfg.get("lookback",         30))
    premium_lookback= int  (cfg.get("premium_lookback", 60))
    entry_z = float(cfg.get("entry_z",  1.5))
    exit_z  = float(cfg.get("exit_z",   0.5))

    K_rel = 1.0 + mono
    rv    = _rolling_realized_var(closes, lookback)

    # Build rolling Heston call price series
    price_ratio = np.full(len(closes), np.nan)
    for i in range(lookback, len(closes)):
        v0_i = float(np.clip(rv[i], 1e-6, 4.0))
        cf_i = lambda u, _v0=v0_i: _heston_cf_unit(
            u, r_pct, T_yr, _v0, kappa, theta, xi, rho
        )
        unit_price = _fft_call_unit(K_rel, r_pct, T_yr, cf_i)
        price_ratio[i] = unit_price   # already normalised: C(S=1, K=K_rel)

    # Z-score of price_ratio over rolling premium_lookback window
    zscore = np.full(len(closes), np.nan)
    for i in range(premium_lookback, len(closes)):
        window_data = price_ratio[i - premium_lookback: i]
        valid = window_data[~np.isnan(window_data)]
        if len(valid) < 10:
            continue
        mu, sigma = np.mean(valid), np.std(valid, ddof=0)
        if sigma > 1e-12 and not np.isnan(price_ratio[i]):
            zscore[i] = (price_ratio[i] - mu) / sigma

    signals, in_pos = [], False
    for i in range(1, len(closes)):
        if np.isnan(zscore[i]):
            continue
        z = zscore[i]
        # High premium → fear is priced in → contrarian long on underlying
        if not in_pos and z > entry_z:
            signals.append({
                "date": dates[i], "type": "buy", "price": closes[i],
                "reason": f"Heston Premium z={z:.2f} > {entry_z} — Fear Peak, Contrarian Entry",
            })
            in_pos = True
        elif in_pos and z < -exit_z:
            signals.append({
                "date": dates[i], "type": "sell", "price": closes[i],
                "reason": f"Heston Premium z={z:.2f} < {-exit_z} — Premium Collapsed, Exit",
            })
            in_pos = False
    return signals


def _heston_variance_gap(closes: np.ndarray, dates: List[str], cfg: Dict) -> List[Dict]:
    """
    Heston κ Mean-Reversion (Variance Gap)
    ──────────────────────────────────────────────────────────────────────
    Rationale  : The Heston SDE drives variance toward θ at speed κ.
                 The variance gap  g_t = v0_t − θ  decays exponentially
                 (EV[v_t] = θ + (v0−θ)·e^{−κt}).

                 A large positive gap (v0 >> θ) means vol will compress →
                 price uncertainty abates → BUY the underlying once the gap
                 starts *contracting*.
                 A negative gap (v0 << θ) means vol expansion is likely →
                 SELL before the spike arrives.

    Signal     :
      BUY   when  gap_t-1 ≥ spike_thresh  AND  gap_t < spike_thresh  (gap contracting from high)
      SELL  when  gap_t drops below -low_thresh  (variance below LR mean — spike imminent)

    Parameters : theta, kappa (for display / half-life), lookback,
                 spike_thresh_pct, low_thresh_pct
    """
    theta         = float(cfg.get("theta",         4.0)) / 100.0
    lookback      = int  (cfg.get("lookback",       30))
    spike_thresh  = float(cfg.get("spike_thresh",   1.5)) / 100.0  # % variance above theta
    low_thresh    = float(cfg.get("low_thresh",     0.5)) / 100.0  # % variance below theta

    rv  = _rolling_realized_var(closes, lookback)
    gap = rv - theta   # g_t = v0_t - theta

    signals, in_pos = [], False
    for i in range(1, len(closes)):
        if np.isnan(gap[i]) or np.isnan(gap[i - 1]):
            continue
        gp, gc = gap[i - 1], gap[i]
        # Gap contracts from above spike_thresh → volatility compression → BUY
        if not in_pos and gp >= spike_thresh and gc < spike_thresh:
            signals.append({
                "date": dates[i], "type": "buy", "price": closes[i],
                "reason": f"VarGap={gc*100:.2f}% contracting from spike — Vol Compression Entry",
            })
            in_pos = True
        # Gap falls deep below zero → variance below LR mean → vol spike risk → SELL
        elif in_pos and gc < -low_thresh:
            signals.append({
                "date": dates[i], "type": "sell", "price": closes[i],
                "reason": f"VarGap={gc*100:.2f}% < −{low_thresh*100:.1f}% — Vol Spike Risk, Exit",
            })
            in_pos = False
    return signals


# ─── Macro Helpers ─────────────────────────────────────────────────────────────

# yfinance proxy tickers for macro variables
_MACRO_TICKERS = {
    "dxy":       "DX-Y.NYB",   # US Dollar Index
    "vix":       "^VIX",        # CBOE Volatility Index
    "yield_10y": "^TNX",        # 10-Year Treasury Yield
    "yield_2y":  "^IRX",        # 13-Week T-Bill (proxy)
    "wti":       "CL=F",        # WTI Crude Oil
    "gold":      "GC=F",        # Gold Futures
    "spy":       "SPY",         # S&P 500 ETF (market regime)
}


def _fetch_macro_aligned(key: str, dates: List[str]) -> np.ndarray:
    """
    Fetch a macro proxy series via yfinance and align (forward-fill) to stock dates.
    Returns np.ndarray of float; NaN where unavailable.
    """
    import yfinance as yf

    ticker_sym = _MACRO_TICKERS.get(key)
    if not ticker_sym:
        return np.full(len(dates), np.nan)
    try:
        start = dates[0]
        # fetch a bit earlier to ensure enough history for forward-fill
        df = yf.download(ticker_sym, start=start, end=dates[-1],
                         progress=False, auto_adjust=True)
        if df.empty:
            return np.full(len(dates), np.nan)
        # yfinance may return MultiIndex columns — flatten to a 1-D Series
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = ['_'.join(str(c) for c in col).strip() for col in df.columns]
        close_col = next((c for c in df.columns if c.lower().startswith('close')), df.columns[0])
        s = df[close_col].dropna()
        date_to_val = {}
        for idx, v in s.items():
            try:
                key = idx.date().isoformat() if hasattr(idx, 'date') else str(idx)[:10]
            except Exception:
                key = str(idx)[:10]
            date_to_val[key] = float(v)
        out = np.full(len(dates), np.nan)
        last = np.nan
        for i, d in enumerate(dates):
            if d in date_to_val:
                last = date_to_val[d]
            out[i] = last
        return out
    except Exception as e:
        log.warning(f"Macro fetch failed for {key} ({ticker_sym}): {e}")
        return np.full(len(dates), np.nan)


# ─── External Factor Pre-fetch (MACRO / FUND) ─────────────────────────────────
#
# _compute_factor receives a `series` dict.  If a key like "MACRO_BASE_RATE"
# already exists in that dict, it is used directly — no fallback to zeros.
#
# The mapping below tells _prefetch_external_series *how* to populate each key:
#   ("fred",  model, params_fn)  → QueryExecutor.fetch("fred", model, params_fn(dates))
#   ("yahoo", symbol)            → QueryExecutor.fetch("yahoo", "stock_price", {symbol, ...})
#   ("computed", deps, fn)       → fn(*fetched_deps)  (e.g. yield_curve = 10y − 2y)
#   ("fred_raw", series_id)      → FredSeriesFetcher.fetch_series (for series without dedicated fetcher)

_MACRO_FACTOR_SOURCES: Dict[str, tuple] = {
    # ── Rates ───────────────────────────────────────────────────────────────
    "MACRO_BASE_RATE": ("fred", "interest_rate",
                        lambda d: {"rate_type": "federal_funds", "start_date": d[0], "end_date": d[-1]}),
    "MACRO_YIELD_2Y":  ("fred", "interest_rate",
                        lambda d: {"rate_type": "treasury_3m", "start_date": d[0], "end_date": d[-1]}),
    "MACRO_YIELD_10Y": ("fred", "interest_rate",
                        lambda d: {"rate_type": "treasury_10y", "start_date": d[0], "end_date": d[-1]}),
    "MACRO_YIELD_CURVE": ("computed", ("MACRO_YIELD_10Y", "MACRO_YIELD_2Y"),
                          lambda y10, y2: y10 - y2),
    # ── Inflation ───────────────────────────────────────────────────────────
    "MACRO_CPI":  ("fred", "cpi",
                   lambda d: {"start_date": d[0], "end_date": d[-1]}),
    "MACRO_PPI":  ("fred_raw", "PPIACO"),
    # ── FX & Commodities ────────────────────────────────────────────────────
    "MACRO_DXY":  ("yahoo", "DX-Y.NYB"),
    "MACRO_WTI":  ("yahoo", "CL=F"),
    "MACRO_GOLD": ("yahoo", "GC=F"),
}


def _align_to_dates(date_val_pairs: List[tuple], dates: List[str]) -> np.ndarray:
    """
    Forward-fill a sparse (date, value) list onto a dense stock-date array.
    Handles both daily and monthly source data uniformly.
    """
    n = len(dates)
    lookup = {d: v for d, v in date_val_pairs}
    out = np.full(n, np.nan)
    last = np.nan
    for i, d in enumerate(dates):
        if d in lookup:
            last = lookup[d]
        out[i] = last
    return out


def _extract_condition_factors(conditions: Optional[List]) -> set:
    """Extract unique factor names referenced in a condition list."""
    factors = set()
    for cond in (conditions or []):
        for side in ("left", "right"):
            fd = cond.get(side, {})
            f = fd.get("factor", "")
            if f and f != "VALUE" and f != "CLOSE":
                factors.add(f)
    return factors


async def _prefetch_external_series(
    dates: List[str],
    series: Dict[str, np.ndarray],
    factor_names: set,
) -> None:
    """
    Populate `series` dict with external (MACRO_ / FUND_) data fetched ONCE.
    Only fetches factors that are (a) referenced in the strategy and (b) have
    a known source in _MACRO_FACTOR_SOURCES.

    Called before the scan/analyze loop so every _compute_factor call is a
    simple dict lookup — no IO inside the hot loop.
    """
    # Resolve which factors we actually need (including computed deps)
    needed = set()
    for f in factor_names:
        if f in _MACRO_FACTOR_SOURCES:
            src = _MACRO_FACTOR_SOURCES[f]
            if src[0] == "computed":
                needed.update(src[1])   # add dependencies
            needed.add(f)

    # Fetch non-computed sources first
    for factor_key in list(needed):
        if factor_key in series:
            continue  # already populated (e.g. by a previous call)
        src = _MACRO_FACTOR_SOURCES.get(factor_key)
        if src is None or src[0] == "computed":
            continue

        try:
            if src[0] == "fred":
                _, model, params_fn = src
                models = await QueryExecutor.fetch("fred", model, params_fn(dates))
                pairs = []
                for m in models:
                    d = m.model_dump(mode="json")
                    date_str = str(d["date"])[:10]
                    val = d.get("value") if d.get("value") is not None else d.get("rate")
                    if val is not None:
                        pairs.append((date_str, float(val)))
                series[factor_key] = _align_to_dates(pairs, dates)

            elif src[0] == "yahoo":
                _, symbol = src
                models = await QueryExecutor.fetch("yahoo", "stock_price", {
                    "symbol": symbol,
                    "start_date": dates[0],
                    "end_date": dates[-1],
                    "interval": "1d",
                })
                pairs = []
                for m in models:
                    d = m.model_dump(mode="json")
                    pairs.append((str(d["date"])[:10], float(d["close"])))
                series[factor_key] = _align_to_dates(pairs, dates)

            elif src[0] == "fred_raw":
                _, series_id = src
                from data_fetcher.fetchers.fred.series import FredSeriesFetcher
                from data_fetcher.utils.api_keys import get_api_key
                from datetime import datetime as _dt
                api_key = get_api_key(credentials=None, api_name="FRED", env_var="FRED_API_KEY")
                obs = FredSeriesFetcher.fetch_series(
                    series_id=series_id,
                    api_key=api_key,
                    start_date=_dt.strptime(dates[0], "%Y-%m-%d").date(),
                    end_date=_dt.strptime(dates[-1], "%Y-%m-%d").date(),
                    sort_order="asc",
                    limit=5000,
                )
                pairs = [(o["date"], float(o["value"]))
                         for o in obs if o.get("value") not in (None, ".")]
                series[factor_key] = _align_to_dates(pairs, dates)

            log.info(f"Pre-fetched {factor_key}: "
                     f"{np.count_nonzero(~np.isnan(series[factor_key]))}/{len(dates)} non-NaN")

        except Exception as e:
            log.warning(f"Pre-fetch failed for {factor_key}: {e}")
            series[factor_key] = np.full(len(dates), np.nan)

    # Now resolve computed factors
    for factor_key in needed:
        if factor_key in series:
            continue
        src = _MACRO_FACTOR_SOURCES.get(factor_key)
        if src is None or src[0] != "computed":
            continue
        _, deps, fn = src
        dep_arrays = [series.get(dep, np.full(len(dates), np.nan)) for dep in deps]
        try:
            series[factor_key] = fn(*dep_arrays)
            log.info(f"Computed {factor_key} from {deps}")
        except Exception as e:
            log.warning(f"Computed factor {factor_key} failed: {e}")
            series[factor_key] = np.full(len(dates), np.nan)


# ─── Macro Strategy Engines ────────────────────────────────────────────────────

def _run_macro_dxy_trend(closes: np.ndarray, dates: List[str], cfg: Dict) -> List[Dict]:
    """
    Dollar Trend Filter: buy when DXY is falling (below EMA), sell when rising.
    Risk-on when dollar weakens, risk-off when dollar strengthens.
    """
    ema_period = int(cfg.get("ema_period") or 20)
    dxy = _fetch_macro_aligned("dxy", dates)
    dxy_ema = _ema(dxy, ema_period)

    signals, in_pos = [], False
    for i in range(1, len(closes)):
        if np.isnan(dxy[i]) or np.isnan(dxy_ema[i]):
            continue
        # BUY: DXY crosses below its EMA (dollar weakening → risk-on)
        if not in_pos and dxy[i - 1] >= dxy_ema[i - 1] and dxy[i] < dxy_ema[i]:
            signals.append({"date": dates[i], "type": "buy", "price": closes[i],
                             "reason": f"DXY({dxy[i]:.2f}) < EMA{ema_period}({dxy_ema[i]:.2f}) — Dollar weakening, Risk-ON"})
            in_pos = True
        # SELL: DXY crosses above its EMA (dollar strengthening → risk-off)
        elif in_pos and dxy[i - 1] <= dxy_ema[i - 1] and dxy[i] > dxy_ema[i]:
            signals.append({"date": dates[i], "type": "sell", "price": closes[i],
                             "reason": f"DXY({dxy[i]:.2f}) > EMA{ema_period}({dxy_ema[i]:.2f}) — Dollar strengthening, Risk-OFF"})
            in_pos = False
    return signals


def _run_macro_vix_regime(closes: np.ndarray, dates: List[str], cfg: Dict) -> List[Dict]:
    """
    VIX Regime: buy in low-fear environment, exit when fear spikes.
    """
    entry_vix = float(cfg.get("entry_vix") or 20.0)
    exit_vix  = float(cfg.get("exit_vix")  or 25.0)
    vix = _fetch_macro_aligned("vix", dates)

    signals, in_pos = [], False
    for i in range(1, len(closes)):
        if np.isnan(vix[i]) or np.isnan(vix[i - 1]):
            continue
        # BUY: VIX falls below entry threshold (complacency / uptrend)
        if not in_pos and vix[i - 1] >= entry_vix and vix[i] < entry_vix:
            signals.append({"date": dates[i], "type": "buy", "price": closes[i],
                             "reason": f"VIX({vix[i]:.1f}) < {entry_vix} — Low fear regime, Risk-ON"})
            in_pos = True
        # SELL: VIX spikes above exit threshold (fear rising)
        elif in_pos and vix[i - 1] <= exit_vix and vix[i] > exit_vix:
            signals.append({"date": dates[i], "type": "sell", "price": closes[i],
                             "reason": f"VIX({vix[i]:.1f}) > {exit_vix} — Fear spike, Risk-OFF"})
            in_pos = False
    return signals


def _run_macro_yield_curve(closes: np.ndarray, dates: List[str], cfg: Dict) -> List[Dict]:
    """
    Yield Curve Regime: buy when curve is steepening (spread rising), exit when inverting.
    Uses 10Y (^TNX) vs proxy short rate (^IRX).
    """
    sma_period  = int(cfg.get("sma_period")  or 20)
    min_spread  = float(cfg.get("min_spread") or 0.0)   # min spread to enter (bps: 0 = non-inverted)

    y10 = _fetch_macro_aligned("yield_10y", dates)
    y2  = _fetch_macro_aligned("yield_2y",  dates)
    spread = y10 - y2                                    # positive = normal curve
    spread_sma = _sma(spread, sma_period)

    signals, in_pos = [], False
    for i in range(1, len(closes)):
        if np.isnan(spread[i]) or np.isnan(spread_sma[i]):
            continue
        # BUY: spread crosses above SMA and > min_spread (curve normalising / steepening)
        if not in_pos and spread[i - 1] <= spread_sma[i - 1] and spread[i] > spread_sma[i] and spread[i] > min_spread:
            signals.append({"date": dates[i], "type": "buy", "price": closes[i],
                             "reason": f"10Y-2Y spread({spread[i]:.2f}%) steepening above SMA — Curve normal"})
            in_pos = True
        # SELL: spread inverts (goes negative) or drops below SMA sharply
        elif in_pos and spread[i] < min_spread:
            signals.append({"date": dates[i], "type": "sell", "price": closes[i],
                             "reason": f"10Y-2Y spread({spread[i]:.2f}%) < {min_spread}% — Curve inverted/flat, EXIT"})
            in_pos = False
    return signals


# Native (non-template) engines. Templated presets (ema_cross, rsi, macd_cross,
# bb_breakout) are resolved through _load_template → _run_custom and do not
# need an entry here.
STRATEGY_ENGINES = {
    "custom":                 _run_custom,
    "heston_vol_regime":      _heston_vol_regime,
    "heston_delta_signal":    _heston_delta_signal,
    "heston_price_ratio":     _heston_price_ratio,
    "heston_variance_gap":    _heston_variance_gap,
    "macro_dxy_trend":        _run_macro_dxy_trend,
    "macro_vix_regime":       _run_macro_vix_regime,
    "macro_yield_curve":      _run_macro_yield_curve,
}


# ─── Risk Management ───────────────────────────────────────────────────────────

def _fix_lookahead(signals: List[Dict], series: Dict, dates: List[str]) -> List[Dict]:
    """
    Eliminate look-ahead bias: signal detected at close[i] → entry at open[i+1].
    This prevents using the close price of the signal bar as entry.
    """
    date_to_idx = {d: i for i, d in enumerate(dates)}
    opens = series.get("open", series["close"])
    fixed = []
    for sig in signals:
        sig = dict(sig)
        if sig["type"] == "buy":
            idx = date_to_idx.get(sig["date"], -1)
            next_idx = idx + 1
            if 0 <= idx < len(dates) - 1 and not np.isnan(opens[next_idx]):
                sig["price"] = float(opens[next_idx])
        fixed.append(sig)
    return fixed


def _build_equity_curve(
    trades: List[Dict],
    initial_capital: float,
    closes: np.ndarray,
    dates: List[str],
    commission_pct: float = 0.0,
) -> Dict[str, List]:
    """
    Build day-by-day portfolio equity curve, drawdown series, and B&H benchmark.
    """
    date_to_idx = {d: i for i, d in enumerate(dates)}
    commission_drag = 2.0 * commission_pct / 100.0  # round-trip

    equity_vals: List[float] = []
    capital = initial_capital
    trade_ptr = 0
    in_pos = False
    entry_price: float = 0.0
    pos_start_cap = capital

    for i, date in enumerate(dates):
        # Enter position
        if not in_pos and trade_ptr < len(trades):
            t = trades[trade_ptr]
            if date == t["entry_date"]:
                in_pos = True
                entry_price = t["entry_price"]
                pos_start_cap = capital

        # Current portfolio value
        if in_pos and entry_price > 0:
            cur_val = pos_start_cap * (closes[i] / entry_price) * (1.0 - commission_drag)
        else:
            cur_val = capital
        equity_vals.append(round(float(cur_val), 2))

        # Exit position
        if in_pos and trade_ptr < len(trades):
            t = trades[trade_ptr]
            if date == t["exit_date"]:
                pnl_ratio = t["exit_price"] / t["entry_price"] if t["entry_price"] > 0 else 1.0
                capital = pos_start_cap * pnl_ratio * (1.0 - commission_drag)
                equity_vals[-1] = round(float(capital), 2)
                in_pos = False
                trade_ptr += 1

    # Drawdown from equity curve
    peak = equity_vals[0] if equity_vals else initial_capital
    drawdown_vals: List[float] = []
    for val in equity_vals:
        if val > peak:
            peak = val
        dd = (val - peak) / peak * 100 if peak > 0 else 0.0
        drawdown_vals.append(round(dd, 2))

    # Buy-and-hold benchmark
    bh_vals = []
    if len(closes) > 0 and closes[0] > 0:
        bh_vals = [round(initial_capital * float(closes[i] / closes[0]), 2) for i in range(len(closes))]

    return {
        "dates": dates,
        "equity": equity_vals,
        "drawdown": drawdown_vals,
        "benchmark": bh_vals,
    }


def _apply_risk(raw_signals: List[Dict], closes: np.ndarray, dates: List[str],
                stop_loss_pct: float, take_profit_pct: float) -> List[Dict]:
    """
    Walk through raw buy/sell signals; inject SL/TP exits when triggered
    between the signal dates.
    """
    date_to_idx = {d: i for i, d in enumerate(dates)}
    result = []
    i = 0
    while i < len(raw_signals):
        sig = raw_signals[i]
        if sig["type"] != "buy":
            i += 1
            continue
        result.append(sig)
        entry_price = sig["price"]
        entry_idx = date_to_idx.get(sig["date"], -1)

        # Find next sell signal from raw list
        next_sell = None
        for j in range(i + 1, len(raw_signals)):
            if raw_signals[j]["type"] == "sell":
                next_sell = raw_signals[j]
                next_sell_idx = date_to_idx.get(next_sell["date"], len(dates))
                break
        else:
            next_sell_idx = len(dates)

        # Check SL/TP day-by-day between entry and next sell
        exited = False
        if entry_idx >= 0 and (stop_loss_pct > 0 or take_profit_pct > 0):
            for k in range(entry_idx + 1, next_sell_idx):
                p = closes[k]
                pnl_pct = (p - entry_price) / entry_price * 100
                if stop_loss_pct > 0 and pnl_pct <= -stop_loss_pct:
                    result.append({"date": dates[k], "type": "sell", "price": p,
                                   "reason": f"Stop Loss -{stop_loss_pct:.1f}%"})
                    exited = True
                    break
                if take_profit_pct > 0 and pnl_pct >= take_profit_pct:
                    result.append({"date": dates[k], "type": "sell", "price": p,
                                   "reason": f"Take Profit +{take_profit_pct:.1f}%"})
                    exited = True
                    break

        if not exited and next_sell is not None:
            result.append(next_sell)
            i = raw_signals.index(next_sell) + 1
            continue
        i += 1

    return result


# ─── Trade Builder & Performance ──────────────────────────────────────────────

def _build_trades(signals: List[Dict], initial_capital: float) -> List[Dict]:
    """Pair buy/sell signals into completed trades."""
    trades = []
    capital = initial_capital
    buy_sig = None
    for s in signals:
        if s["type"] == "buy" and buy_sig is None:
            buy_sig = s
        elif s["type"] == "sell" and buy_sig is not None:
            entry = buy_sig["price"]
            exit_p = s["price"]
            shares = capital / entry
            pnl = (exit_p - entry) * shares
            pnl_pct = (exit_p - entry) / entry * 100
            capital += pnl
            trades.append({
                "entry_date": buy_sig["date"],
                "exit_date": s["date"],
                "entry_price": round(entry, 4),
                "exit_price": round(exit_p, 4),
                "pnl": round(pnl, 2),
                "pnl_pct": round(pnl_pct, 2),
                "reason": s["reason"],
            })
            buy_sig = None
    return trades


def _calc_performance(
    trades: List[Dict],
    initial_capital: float,
    closes: np.ndarray,
    dates: List[str],
    commission_pct: float = 0.0,
) -> Dict[str, Any]:
    """Calculate aggregate performance metrics with full quant analytics."""
    commission_drag = 2.0 * commission_pct / 100.0

    if not trades:
        return {
            "total_return": 0.0, "annualized_return": 0.0,
            "max_drawdown": 0.0, "sharpe": 0.0, "sortino": 0.0,
            "calmar": 0.0, "profit_factor": 0.0, "expectancy": 0.0,
            "recovery_factor": 0.0, "win_rate": 0.0, "trade_count": 0,
            "avg_hold_days": 0, "max_consec_losses": 0,
            "initial_capital": initial_capital, "final_capital": initial_capital,
            "trades": [],
        }

    # Final capital (with commission applied per trade)
    final_capital = initial_capital
    for t in trades:
        ratio = t["exit_price"] / t["entry_price"] if t["entry_price"] > 0 else 1.0
        final_capital *= ratio * (1.0 - commission_drag)

    total_return = (final_capital - initial_capital) / initial_capital * 100.0

    # Annualized return
    try:
        start_dt = _parse_date(trades[0]["entry_date"])
        end_dt   = _parse_date(trades[-1]["exit_date"])
        years    = max((end_dt - start_dt).days / 365.25, 1.0 / 12.0)
    except Exception:
        years = 1.0
    annualized_return = ((final_capital / initial_capital) ** (1.0 / years) - 1.0) * 100.0

    # Build strategy daily returns (0 when out of market)
    date_to_idx = {d: i for i, d in enumerate(dates)}
    n = len(closes)
    strat_returns = np.zeros(n - 1)
    for t in trades:
        ei = date_to_idx.get(t["entry_date"], -1)
        xi = date_to_idx.get(t["exit_date"], -1)
        if ei >= 0 and xi > ei:
            for k in range(ei, min(xi, n - 1)):
                if closes[k] > 0:
                    strat_returns[k] = (closes[k + 1] - closes[k]) / closes[k]

    rf_daily = 0.02 / 252.0
    excess   = strat_returns - rf_daily
    std_exc  = np.std(excess)
    sharpe   = float(np.mean(excess) / std_exc * np.sqrt(252.0)) if std_exc > 0 else 0.0

    # Sortino (penalise downside only)
    downside = excess[excess < 0]
    std_dn   = np.std(downside) if len(downside) > 0 else 0.0
    sortino  = float(np.mean(excess) / std_dn * np.sqrt(252.0)) if std_dn > 0 else 0.0

    # Max drawdown on strategy equity (trade-by-trade)
    cap   = initial_capital
    peak  = cap
    max_dd = 0.0
    for t in trades:
        ratio = t["exit_price"] / t["entry_price"] if t["entry_price"] > 0 else 1.0
        cap  *= ratio * (1.0 - commission_drag)
        if cap > peak:
            peak = cap
        dd = (cap - peak) / peak * 100.0
        if dd < max_dd:
            max_dd = dd

    calmar          = annualized_return / abs(max_dd) if max_dd != 0 else 0.0
    recovery_factor = total_return / abs(max_dd)      if max_dd != 0 else 0.0

    # Win/loss stats
    wins_list   = [t for t in trades if t["pnl_pct"] > 0]
    losses_list = [t for t in trades if t["pnl_pct"] <= 0]
    wins        = len(wins_list)
    win_rate    = wins / len(trades) * 100.0

    gross_profit = sum(t["pnl"] for t in wins_list)
    gross_loss   = abs(sum(t["pnl"] for t in losses_list))
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else 999.0

    avg_win  = gross_profit / wins            if wins               > 0 else 0.0
    avg_loss = gross_loss / len(losses_list)  if len(losses_list)   > 0 else 0.0
    wr_dec   = wins / len(trades)
    expectancy = wr_dec * avg_win - (1.0 - wr_dec) * avg_loss

    # Average holding period
    hold_days = []
    for t in trades:
        try:
            d0 = _parse_date(t["entry_date"])
            d1 = _parse_date(t["exit_date"])
            hold_days.append((d1 - d0).days)
        except Exception:
            pass
    avg_hold_days = round(sum(hold_days) / len(hold_days), 1) if hold_days else 0

    # Max consecutive losses
    max_consec = curr_loss = 0
    for t in trades:
        if t["pnl_pct"] <= 0:
            curr_loss += 1
            max_consec = max(max_consec, curr_loss)
        else:
            curr_loss = 0

    return {
        "total_return":      round(total_return, 2),
        "annualized_return": round(annualized_return, 2),
        "max_drawdown":      round(max_dd, 2),
        "sharpe":            round(sharpe, 2),
        "sortino":           round(sortino, 2),
        "calmar":            round(calmar, 2),
        "profit_factor":     round(min(profit_factor, 999.0), 2),
        "expectancy":        round(expectancy, 2),
        "recovery_factor":   round(recovery_factor, 2),
        "win_rate":          round(win_rate, 2),
        "trade_count":       len(trades),
        "avg_hold_days":     avg_hold_days,
        "max_consec_losses": max_consec,
        "initial_capital":   round(initial_capital, 2),
        "final_capital":     round(final_capital, 2),
        "trades": trades,
    }


def _parse_date(d: str):
    from datetime import date, datetime
    try:
        return datetime.strptime(d[:10], "%Y-%m-%d").date()
    except Exception:
        return date.today()


# ─── Public API ───────────────────────────────────────────────────────────────

def _substitute_template(obj: Any, params: Dict[str, Any]) -> Any:
    """
    Deep-substitute '##name##' placeholders in a condition tree with values from params.
    Works on dicts, lists, and strings. Numeric values pass through unchanged.
    """
    if isinstance(obj, str):
        if obj.startswith("##") and obj.endswith("##"):
            key = obj[2:-2]
            return params.get(key, obj)
        return obj
    if isinstance(obj, dict):
        return {k: _substitute_template(v, params) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_substitute_template(item, params) for item in obj]
    return obj


_TEMPLATE_CACHE: Dict[str, Optional[Dict]] = {}


def _load_template(strategy_type: str) -> Optional[Dict]:
    """
    Load the template JSON for a built-in strategy type. Returns None for
    native engines (heston_*, macro_*, custom). Cached in-process.
    """
    if strategy_type in _TEMPLATE_CACHE:
        return _TEMPLATE_CACHE[strategy_type]

    from index_analyzer.utils.db import get_sqlite_db
    from index_analyzer.models.quant_strategy_type import QuantStrategyType

    db_path = Path(__file__).parent.parent.parent.parent / "data" / "marketpulse.db"
    template: Optional[Dict] = None
    try:
        db_instance = get_sqlite_db(str(db_path))
        session = db_instance.get_session()
        try:
            row = session.query(QuantStrategyType).filter_by(key=strategy_type).first()
            if row and row.template:
                template = json.loads(row.template)
        finally:
            session.close()
    except Exception as e:
        log.warning(f"Failed loading template for {strategy_type}: {e}")

    _TEMPLATE_CACHE[strategy_type] = template
    return template


def _resolve_template_cfg(template: Dict, params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Substitute ##name## placeholders in a template using `params` and return a
    cfg dict ready for _run_custom (buy_conditions/sell_conditions/logics).
    """
    resolved = _substitute_template(template, params or {})
    return {
        "buy_conditions":  resolved.get("buy_conditions",  []) or [],
        "sell_conditions": resolved.get("sell_conditions", []) or [],
        "buy_logic":       resolved.get("buy_logic",  "AND"),
        "sell_logic":      resolved.get("sell_logic", "OR"),
    }


async def scan(
    ticker: str,
    start_date: str,
    end_date: str,
    strategy_type: str,
    param_ranges: Dict[str, Any],
    stop_loss_pct: float = 0.0,
    take_profit_pct: float = 0.0,
    initial_capital: float = 10000.0,
    commission_pct: float = 0.0,
    buy_conditions: Optional[List] = None,
    sell_conditions: Optional[List] = None,
    buy_logic: str = "AND",
    sell_logic: str = "OR",
) -> Dict[str, Any]:
    """
    Fetch price data ONCE, then run all parameter combinations.
    param_ranges: { "fast": {"min":10,"max":30,"step":5}, "slow": {"min":40,"max":150,"step":10} }
    """
    template = _load_template(strategy_type)
    engine = STRATEGY_ENGINES.get(strategy_type)
    if template is None and engine is None:
        raise ValueError(f"Unknown strategy type: {strategy_type}")

    # Fetch price data once
    models = await QueryExecutor.fetch("yahoo", "stock_price", {
        "symbol": ticker,
        "start_date": start_date,
        "end_date": end_date,
        "interval": "1d",
    })
    if not models:
        raise ValueError(f"No price data found for {ticker}")
    data = [m.model_dump(mode='json') for m in models]
    data.sort(key=lambda d: d['date'])
    dates = [d['date'][:10] for d in data]
    closes = np.array([d['close'] for d in data], dtype=float)
    if len(closes) < 20:
        raise ValueError(f"Insufficient data for {ticker}")

    # Build combinations from ranges
    import itertools

    def make_values(spec):
        mn = spec["min"]
        mx = spec["max"]
        st = spec.get("step", 1)
        vals = []
        v = mn
        while v <= mx:
            vals.append(round(v, 4))
            v = round(v + st, 4)
        return vals

    keys = list(param_ranges.keys())
    value_lists = [make_values(param_ranges[k]) for k in keys]
    combinations = [dict(zip(keys, combo)) for combo in itertools.product(*value_lists)]

    # Build OHLCV series once for look-ahead fix
    series_scan = {
        "close":  closes,
        "open":   np.array([d['open']   or d['close'] for d in data], dtype=float),
        "high":   np.array([d['high']   or d['close'] for d in data], dtype=float),
        "low":    np.array([d['low']    or d['close'] for d in data], dtype=float),
        "volume": np.array([d['volume'] or 1.0        for d in data], dtype=float),
    }

    # Pre-fetch external data (MACRO_, FUND_, etc.) referenced in conditions — once
    ext_factors = set()
    if template is not None:
        import json as _json
        _tpl_str = _json.dumps(template)
        for fk in _MACRO_FACTOR_SOURCES:
            if fk in _tpl_str:
                ext_factors.add(fk)
    ext_factors |= _extract_condition_factors(buy_conditions)
    ext_factors |= _extract_condition_factors(sell_conditions)
    if ext_factors:
        await _prefetch_external_series(dates, series_scan, ext_factors)

    # Three dispatch paths per combo:
    #   1. Built-in preset with template in DB → substitute placeholders → _run_custom
    #   2. Custom: caller provides buy/sell condition templates with ##name## placeholders
    #   3. Native engine (heston_*, macro_*): pass combo straight through
    is_custom = strategy_type == "custom"
    buy_tpl   = buy_conditions  or []
    sell_tpl  = sell_conditions or []

    results = []
    skipped = 0
    for combo in combinations:
        try:
            if template is not None:
                cfg = _resolve_template_cfg(template, combo)
                raw_signals = _run_custom(closes, dates, cfg, series_scan)
            elif is_custom:
                cfg = {
                    "buy_conditions":  _substitute_template(buy_tpl,  combo),
                    "sell_conditions": _substitute_template(sell_tpl, combo),
                    "buy_logic":       buy_logic,
                    "sell_logic":      sell_logic,
                    **combo,
                }
                raw_signals = _run_custom(closes, dates, cfg, series_scan)
            else:
                raw_signals = engine(closes, dates, combo)

            fixed_signals = _fix_lookahead(raw_signals, series_scan, dates)
            signals = _apply_risk(fixed_signals, closes, dates, stop_loss_pct, take_profit_pct) \
                      if (stop_loss_pct > 0 or take_profit_pct > 0) else fixed_signals
            trades = _build_trades(signals, initial_capital)
            perf = _calc_performance(trades, initial_capital, closes, dates, commission_pct)
            row = {**combo}
            row["total_return"]      = perf["total_return"]
            row["annualized_return"] = perf["annualized_return"]
            row["max_drawdown"]      = perf["max_drawdown"]
            row["sharpe"]            = perf["sharpe"]
            row["sortino"]           = perf["sortino"]
            row["calmar"]            = perf["calmar"]
            row["profit_factor"]     = perf["profit_factor"]
            row["win_rate"]          = perf["win_rate"]
            row["trade_count"]       = perf["trade_count"]
            results.append(row)
        except Exception as e:
            log.warning(f"scan combo {combo} failed: {e}")
            skipped += 1
            continue

    results.sort(key=lambda r: r["sharpe"], reverse=True)
    best = results[0] if results else None
    return {
        "results": results,
        "best": best,
        "total_combinations": len(results),
        "skipped": skipped,
    }


async def analyze(
    ticker: str,
    start_date: str,
    end_date: str,
    strategy: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Fetch OHLCV data, run strategy, apply risk management, return signals + performance.
    """
    strategy_type = strategy.get("type", "ema_cross")
    stop_loss_pct = float(strategy.get("stop_loss_pct", 0.0))
    take_profit_pct = float(strategy.get("take_profit_pct", 0.0))
    initial_capital = float(strategy.get("initial_capital", 10000.0))

    # ── Fetch price data ──────────────────────────────────────────────────────
    models = await QueryExecutor.fetch("yahoo", "stock_price", {
        "symbol": ticker,
        "start_date": start_date,
        "end_date": end_date,
        "interval": "1d",
    })
    if not models:
        raise ValueError(f"No price data found for {ticker}")

    data = [m.model_dump(mode='json') for m in models]
    data.sort(key=lambda d: d['date'])
    dates = [d['date'][:10] for d in data]
    closes = np.array([d['close'] for d in data], dtype=float)

    def _safe(arr, fallback=None):
        if fallback is None:
            fallback = closes
        return arr if arr is not None else fallback

    # Full OHLCV series for factor-based strategies
    series = {
        "close":  closes,
        "open":   _safe(np.array([d['open']   or d['close'] for d in data], dtype=float)),
        "high":   _safe(np.array([d['high']   or d['close'] for d in data], dtype=float)),
        "low":    _safe(np.array([d['low']    or d['close'] for d in data], dtype=float)),
        "volume": _safe(np.array([d['volume'] or 1.0        for d in data], dtype=float)),
    }

    if len(closes) < 20:
        raise ValueError(f"Insufficient data for {ticker}: only {len(closes)} bars")

    # ── Run strategy ──────────────────────────────────────────────────────────
    # Templated preset: substitute scan params into template then dispatch to _run_custom.
    template = _load_template(strategy_type)

    # Pre-fetch external data (MACRO_, FUND_, etc.) referenced in strategy conditions
    ext_factors = _extract_condition_factors(strategy.get("buy_conditions"))
    ext_factors |= _extract_condition_factors(strategy.get("sell_conditions"))
    cfg = None
    if template is not None:
        cfg = _resolve_template_cfg(template, strategy)
        ext_factors |= _extract_condition_factors(cfg.get("buy_conditions"))
        ext_factors |= _extract_condition_factors(cfg.get("sell_conditions"))
    if ext_factors:
        await _prefetch_external_series(dates, series, ext_factors)

    if cfg is not None:
        raw_signals = _run_custom(closes, dates, cfg, series)
    else:
        engine = STRATEGY_ENGINES.get(strategy_type)
        if engine is None:
            raise ValueError(f"Unknown strategy type: {strategy_type}")
        if strategy_type == "custom":
            raw_signals = engine(closes, dates, strategy, series)
        else:
            raw_signals = engine(closes, dates, strategy)

    # ── Build trades & performance ────────────────────────────────────────────
    commission_pct = float(strategy.get("commission_pct", 0.0))

    # Fix look-ahead bias: entry at next bar's open, not signal bar's close
    signals = _fix_lookahead(raw_signals, series, dates)
    if stop_loss_pct > 0 or take_profit_pct > 0:
        signals = _apply_risk(signals, closes, dates, stop_loss_pct, take_profit_pct)

    trades      = _build_trades(signals, initial_capital)
    performance = _calc_performance(trades, initial_capital, closes, dates, commission_pct)
    equity_curve = _build_equity_curve(trades, initial_capital, closes, dates, commission_pct)
    performance["equity_curve"] = equity_curve

    return {
        "ticker": ticker.upper(),
        "signals": signals,
        "performance": performance,
    }
