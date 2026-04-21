"""Chart-based market structure factors: Volume Profile, Liquidity Sweep,
HMM Regime.  These are rolling-window factors that describe supply/demand
structure rather than momentum.
"""
import logging
import numpy as np

log = logging.getLogger(__name__)


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
