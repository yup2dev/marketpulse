"""
Quant Strategy Service
Single-stock strategy backtesting with signal generation and performance metrics.
Supports: EMA Cross, RSI, MACD Cross, BB Breakout
Uses numpy only — no additional dependencies.
"""
import sys
import logging
import numpy as np
from pathlib import Path
from typing import Any, Dict, List, Optional

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from data_fetcher.fetchers.yahoo.stock_price import YahooStockPriceFetcher

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
    mid = _sma(prices, period)
    upper = np.full(len(prices), np.nan)
    lower = np.full(len(prices), np.nan)
    for i in range(period - 1, len(prices)):
        std = np.std(prices[i - period + 1 : i + 1], ddof=0)
        upper[i] = mid[i] + std_dev * std
        lower[i] = mid[i] - std_dev * std
    return upper, mid, lower


# ─── Strategy Engines ──────────────────────────────────────────────────────────

def _run_ema_cross(closes: np.ndarray, dates: List[str], cfg: Dict) -> List[Dict]:
    """Golden/Death cross on two EMAs"""
    fast = cfg.get("fast", 20)
    slow = cfg.get("slow", 50)
    ema_fast = _ema(closes, fast)
    ema_slow = _ema(closes, slow)

    signals = []
    in_position = False
    for i in range(1, len(closes)):
        if np.isnan(ema_fast[i]) or np.isnan(ema_slow[i]):
            continue
        if not in_position and ema_fast[i - 1] <= ema_slow[i - 1] and ema_fast[i] > ema_slow[i]:
            signals.append({"date": dates[i], "type": "buy", "price": closes[i],
                             "reason": f"EMA{fast} × EMA{slow} Golden Cross"})
            in_position = True
        elif in_position and ema_fast[i - 1] >= ema_slow[i - 1] and ema_fast[i] < ema_slow[i]:
            signals.append({"date": dates[i], "type": "sell", "price": closes[i],
                             "reason": f"EMA{fast} × EMA{slow} Death Cross"})
            in_position = False
    return signals


def _run_rsi(closes: np.ndarray, dates: List[str], cfg: Dict) -> List[Dict]:
    """RSI oversold/overbought strategy"""
    period = cfg.get("rsi_period", 14)
    oversold = cfg.get("oversold", 30)
    overbought = cfg.get("overbought", 70)
    rsi = _rsi(closes, period)

    signals = []
    in_position = False
    for i in range(1, len(closes)):
        if np.isnan(rsi[i]) or np.isnan(rsi[i - 1]):
            continue
        if not in_position and rsi[i - 1] <= oversold and rsi[i] > oversold:
            signals.append({"date": dates[i], "type": "buy", "price": closes[i],
                             "reason": f"RSI({period}) bounce from oversold ({oversold})"})
            in_position = True
        elif in_position and rsi[i - 1] >= overbought and rsi[i] < overbought:
            signals.append({"date": dates[i], "type": "sell", "price": closes[i],
                             "reason": f"RSI({period}) exit from overbought ({overbought})"})
            in_position = False
    return signals


def _run_macd_cross(closes: np.ndarray, dates: List[str], cfg: Dict) -> List[Dict]:
    """MACD line crossing signal line"""
    fast = cfg.get("fast", 12)
    slow = cfg.get("slow", 26)
    signal = cfg.get("signal", 9)
    macd_line, signal_line, _ = _macd(closes, fast, slow, signal)

    signals = []
    in_position = False
    for i in range(1, len(closes)):
        if np.isnan(macd_line[i]) or np.isnan(signal_line[i]):
            continue
        if not in_position and macd_line[i - 1] <= signal_line[i - 1] and macd_line[i] > signal_line[i]:
            signals.append({"date": dates[i], "type": "buy", "price": closes[i],
                             "reason": f"MACD({fast},{slow},{signal}) bullish crossover"})
            in_position = True
        elif in_position and macd_line[i - 1] >= signal_line[i - 1] and macd_line[i] < signal_line[i]:
            signals.append({"date": dates[i], "type": "sell", "price": closes[i],
                             "reason": f"MACD({fast},{slow},{signal}) bearish crossover"})
            in_position = False
    return signals


def _run_bb_breakout(closes: np.ndarray, dates: List[str], cfg: Dict) -> List[Dict]:
    """Bollinger Band breakout strategy"""
    period = cfg.get("period", 20)
    std_dev = cfg.get("std_dev", 2.0)
    upper, mid, lower = _bollinger(closes, period, std_dev)

    signals = []
    in_position = False
    for i in range(1, len(closes)):
        if np.isnan(upper[i]) or np.isnan(lower[i]):
            continue
        if not in_position and closes[i - 1] <= lower[i - 1] and closes[i] > lower[i]:
            signals.append({"date": dates[i], "type": "buy", "price": closes[i],
                             "reason": f"BB({period},{std_dev}) bounce off lower band"})
            in_position = True
        elif in_position and closes[i - 1] >= upper[i - 1] and closes[i] < upper[i]:
            signals.append({"date": dates[i], "type": "sell", "price": closes[i],
                             "reason": f"BB({period},{std_dev}) rejected at upper band"})
            in_position = False
    return signals


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
        u, _, _ = _bollinger(c, int(p.get("period", 20)), float(p.get("std_dev", 2.0)))
        return u
    if factor == "BB_LOWER":
        _, _, lo = _bollinger(c, int(p.get("period", 20)), float(p.get("std_dev", 2.0)))
        return lo
    if factor == "BB_MID":
        _, m, _ = _bollinger(c, int(p.get("period", 20)), float(p.get("std_dev", 2.0)))
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
    if factor == "ZSCORE":
        return _zscore(c, int(p.get("window", 20)))
    if factor == "PERCENTILE":
        return _percentile(c, int(p.get("window", 60)))
    # External-data factors — return neutral series until backend integration
    if factor in ("BETA", "CORR", "REL_STR"):
        return np.ones(n)           # neutral: 1.0
    if factor in ("NEWS_SENTIMENT", "NEWS_VOLUME", "SENTIMENT_DELTA"):
        return np.zeros(n)          # neutral: 0.0
    # Macro / Micro / Fundamental / Alt data — placeholder until data integration
    if factor.startswith(("MACRO_", "MICRO_", "FUND_", "SUPPLY_", "ALT_")):
        return np.zeros(n)          # neutral: 0.0
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


STRATEGY_ENGINES = {
    "ema_cross":              _run_ema_cross,
    "rsi":                    _run_rsi,
    "macd_cross":             _run_macd_cross,
    "bb_breakout":            _run_bb_breakout,
    "custom":                 _run_custom,
    # ── Heston Model FFT ──────────────────────────────────────────────────────
    "heston_vol_regime":      _heston_vol_regime,
    "heston_delta_signal":    _heston_delta_signal,
    "heston_price_ratio":     _heston_price_ratio,
    "heston_variance_gap":    _heston_variance_gap,
}


# ─── Risk Management ───────────────────────────────────────────────────────────

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


def _calc_performance(trades: List[Dict], initial_capital: float,
                      closes: np.ndarray, dates: List[str]) -> Dict[str, Any]:
    """Calculate aggregate performance metrics."""
    if not trades:
        return {
            "total_return": 0.0, "annualized_return": 0.0,
            "max_drawdown": 0.0, "sharpe": 0.0,
            "win_rate": 0.0, "trade_count": 0,
            "initial_capital": initial_capital, "final_capital": initial_capital,
            "trades": [],
        }

    final_capital = initial_capital
    for t in trades:
        final_capital *= (1 + t["pnl_pct"] / 100)

    total_return = (final_capital - initial_capital) / initial_capital * 100

    # Annualized
    try:
        start_dt = _parse_date(trades[0]["entry_date"])
        end_dt = _parse_date(trades[-1]["exit_date"])
        years = max((end_dt - start_dt).days / 365.25, 1 / 12)
    except Exception:
        years = 1.0
    annualized_return = ((final_capital / initial_capital) ** (1 / years) - 1) * 100

    # Max drawdown on raw equity curve from daily closes
    peak = closes[0]
    max_dd = 0.0
    for c in closes:
        if c > peak:
            peak = c
        dd = (c - peak) / peak * 100
        if dd < max_dd:
            max_dd = dd

    # Sharpe
    daily_returns = np.diff(closes) / closes[:-1]
    rf_daily = 0.02 / 252
    excess = daily_returns - rf_daily
    sharpe = (np.mean(excess) / np.std(excess) * np.sqrt(252)) if np.std(excess) > 0 else 0.0

    # Win rate
    wins = sum(1 for t in trades if t["pnl"] > 0)
    win_rate = wins / len(trades) * 100

    return {
        "total_return": round(total_return, 2),
        "annualized_return": round(annualized_return, 2),
        "max_drawdown": round(max_dd, 2),
        "sharpe": round(float(sharpe), 2),
        "win_rate": round(win_rate, 2),
        "trade_count": len(trades),
        "initial_capital": round(initial_capital, 2),
        "final_capital": round(final_capital, 2),
        "trades": trades,
    }


def _parse_date(d: str):
    from datetime import date, datetime
    try:
        return datetime.strptime(d[:10], "%Y-%m-%d").date()
    except Exception:
        return date.today()


# ─── Public API ───────────────────────────────────────────────────────────────

async def scan(
    ticker: str,
    start_date: str,
    end_date: str,
    strategy_type: str,
    param_ranges: Dict[str, Any],
    stop_loss_pct: float = 0.0,
    take_profit_pct: float = 0.0,
    initial_capital: float = 10000.0,
) -> Dict[str, Any]:
    """
    Fetch price data ONCE, then run all parameter combinations.
    param_ranges: { "fast": {"min":10,"max":30,"step":5}, "slow": {"min":40,"max":150,"step":10} }
    """
    engine = STRATEGY_ENGINES.get(strategy_type)
    if engine is None:
        raise ValueError(f"Unknown strategy type: {strategy_type}")

    # Fetch price data once
    raw = await YahooStockPriceFetcher.fetch_data({
        "symbol": ticker,
        "start_date": start_date,
        "end_date": end_date,
        "interval": "1d",
    })
    if not raw:
        raise ValueError(f"No price data found for {ticker}")
    raw.sort(key=lambda p: p.date if hasattr(p.date, "isoformat") else str(p.date))
    dates = [str(p.date)[:10] for p in raw]
    closes = np.array([float(p.close) for p in raw], dtype=float)
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

    results = []
    for combo in combinations:
        raw_signals = engine(closes, dates, combo)
        signals = _apply_risk(raw_signals, closes, dates, stop_loss_pct, take_profit_pct) \
                  if (stop_loss_pct > 0 or take_profit_pct > 0) else raw_signals
        trades = _build_trades(signals, initial_capital)
        perf = _calc_performance(trades, initial_capital, closes, dates)
        row = {**combo}
        row["total_return"] = perf["total_return"]
        row["annualized_return"] = perf["annualized_return"]
        row["max_drawdown"] = perf["max_drawdown"]
        row["sharpe"] = perf["sharpe"]
        row["win_rate"] = perf["win_rate"]
        row["trade_count"] = perf["trade_count"]
        results.append(row)

    results.sort(key=lambda r: r["sharpe"], reverse=True)
    best = results[0] if results else None
    return {"results": results, "best": best, "total_combinations": len(results)}


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
    raw = await YahooStockPriceFetcher.fetch_data({
        "symbol": ticker,
        "start_date": start_date,
        "end_date": end_date,
        "interval": "1d",
    })
    if not raw:
        raise ValueError(f"No price data found for {ticker}")

    # Sort by date ascending
    raw.sort(key=lambda p: p.date if hasattr(p.date, "isoformat") else str(p.date))

    dates = [str(p.date)[:10] for p in raw]
    closes = np.array([float(p.close) for p in raw], dtype=float)

    def _safe(arr, fallback=None):
        if fallback is None:
            fallback = closes
        return arr if arr is not None else fallback

    # Full OHLCV series for factor-based strategies
    series = {
        "close":  closes,
        "open":   _safe(np.array([float(p.open)   if getattr(p, "open",   None) else p.close for p in raw])),
        "high":   _safe(np.array([float(p.high)   if getattr(p, "high",   None) else p.close for p in raw])),
        "low":    _safe(np.array([float(p.low)    if getattr(p, "low",    None) else p.close for p in raw])),
        "volume": _safe(np.array([float(p.volume) if getattr(p, "volume", None) else 1.0      for p in raw])),
    }

    if len(closes) < 20:
        raise ValueError(f"Insufficient data for {ticker}: only {len(closes)} bars")

    # ── Run strategy ──────────────────────────────────────────────────────────
    engine = STRATEGY_ENGINES.get(strategy_type)
    if engine is None:
        raise ValueError(f"Unknown strategy type: {strategy_type}")

    if strategy_type == "custom":
        raw_signals = engine(closes, dates, strategy, series)
    else:
        raw_signals = engine(closes, dates, strategy)

    # ── Apply risk management ─────────────────────────────────────────────────
    if stop_loss_pct > 0 or take_profit_pct > 0:
        signals = _apply_risk(raw_signals, closes, dates, stop_loss_pct, take_profit_pct)
    else:
        signals = raw_signals

    # ── Build trades & performance ────────────────────────────────────────────
    trades = _build_trades(signals, initial_capital)
    performance = _calc_performance(trades, initial_capital, closes, dates)

    return {
        "ticker": ticker.upper(),
        "signals": signals,
        "performance": performance,
    }
