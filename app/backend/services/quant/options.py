"""Options pricing via Carr-Madan FFT (Black-Scholes + Heston) plus analytical
Greeks and rolling realised variance.

Reference: Carr & Madan (1999) "Option valuation using the fast Fourier transform"
  C(k) = (e^{-αk}/π) ∫₀^∞ Re[e^{-iuk} · e^{-rT}·φ(u−i(α+1))
                              / (α²+α−u²+i(2α+1)u)] du
"""
import numpy as np


# ─── Shared Volatility Helper ─────────────────────────────────────────────────

def _rolling_realized_var(closes: np.ndarray, window: int) -> np.ndarray:
    """Annualised realised variance via log-return std².  Used by both the
    custom factor engine and the Heston strategy engines."""
    log_rets = np.log(closes[1:] / np.maximum(closes[:-1], 1e-12))
    rv = np.full(len(closes), np.nan)
    for i in range(window, len(closes)):
        rv[i] = np.var(log_rets[i - window: i], ddof=0) * 252
    return rv


# ─── Normal distribution helpers ──────────────────────────────────────────────

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


# ─── Characteristic functions ─────────────────────────────────────────────────

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


# ─── Carr-Madan FFT pricing ───────────────────────────────────────────────────

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
