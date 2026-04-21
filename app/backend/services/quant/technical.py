"""Technical indicators: EMA, SMA, RSI, MACD, Bollinger, ATR, Stochastic,
Z-score, percentile, VWAP.  All functions operate on numpy arrays and return
same-length arrays with leading NaNs where the window isn't fully populated.
"""
import numpy as np


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
