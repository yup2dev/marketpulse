"""
Quant Alpha Research
====================
퀀트 트레이더 관점에서 설계한 2개의 오리지널 멀티팩터 전략 백테스트

Strategy 1 — Trend Momentum Confluence (TMC)
  철학: 추세가 살아있는 환경(EMA20 > EMA50)에서만 RSI 중립선(50) 돌파 신호를 취함
  진입 조건(AND): EMA(20) > EMA(50)  &  RSI(14) crosses_above 50
  청산 조건(OR) : EMA(20) crosses_below EMA(50)  |  RSI(14) > 72
  리스크  : SL 6%, TP 18%

Strategy 2 — Volatility Squeeze Reversal (VSR)
  철학: BB 하단 이탈 후 복귀(평균회귀) + Stochastic 과매도 탈출로 이중 확인
  진입 조건(AND): Close crosses_above BB_Lower(20, 2.0)  &  STOCH_K crosses_above 25
  청산 조건(OR) : Close crosses_above BB_Upper(20, 2.0)  |  STOCH_K > 78
  리스크  : SL 5%, TP 12%

Tickers : NVDA, AAPL, MSFT, TSLA, SPY
Period  : 2020-01-01 ~ 2024-12-31
Capital : $10,000 per trade
"""

import sys
import numpy as np
import yfinance as yf
from pathlib import Path

# ── Indicator Functions (quant_service.py 동일 구현) ────────────────────────

def _ema(prices, period):
    result = np.full(len(prices), np.nan)
    if len(prices) < period:
        return result
    result[period - 1] = np.mean(prices[:period])
    k = 2.0 / (period + 1)
    for i in range(period, len(prices)):
        result[i] = prices[i] * k + result[i - 1] * (1 - k)
    return result


def _sma(prices, period):
    result = np.full(len(prices), np.nan)
    for i in range(period - 1, len(prices)):
        result[i] = np.mean(prices[i - period + 1 : i + 1])
    return result


def _rsi(prices, period=14):
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


def _bollinger(prices, period=20, std_dev=2.0):
    mid = _sma(prices, period)
    upper = np.full(len(prices), np.nan)
    lower = np.full(len(prices), np.nan)
    for i in range(period - 1, len(prices)):
        std = np.std(prices[i - period + 1 : i + 1], ddof=0)
        upper[i] = mid[i] + std_dev * std
        lower[i] = mid[i] - std_dev * std
    return upper, mid, lower


def _stochastic(high, low, close, k_period=14, d_period=3):
    n = len(close)
    k = np.full(n, np.nan)
    for i in range(k_period - 1, n):
        hh = np.max(high[i - k_period + 1 : i + 1])
        ll = np.min(low[i - k_period + 1 : i + 1])
        k[i] = (close[i] - ll) / (hh - ll) * 100 if hh != ll else 50.0
    d = _sma(k, d_period)
    return k, d


# ── Strategy 1: Trend Momentum Confluence ────────────────────────────────────

def run_tmc(closes, dates, high, low,
            ema_fast=20, ema_slow=50, rsi_period=14,
            rsi_entry=50, rsi_exit=72,
            stop_loss_pct=6.0, take_profit_pct=18.0):
    """
    BUY : EMA(fast) > EMA(slow)  AND  RSI crosses_above rsi_entry
    SELL: EMA(fast) crosses_below EMA(slow)  OR  RSI > rsi_exit
    """
    ema_f = _ema(closes, ema_fast)
    ema_s = _ema(closes, ema_slow)
    rsi   = _rsi(closes, rsi_period)

    signals = []
    in_pos  = False
    entry_price = 0.0
    entry_idx   = 0

    for i in range(1, len(closes)):
        if any(np.isnan(x) for x in [ema_f[i], ema_s[i], rsi[i], rsi[i - 1]]):
            continue

        if not in_pos:
            trend_ok  = ema_f[i] > ema_s[i]
            rsi_cross = rsi[i - 1] <= rsi_entry and rsi[i] > rsi_entry
            if trend_ok and rsi_cross:
                signals.append({"date": dates[i], "type": "buy", "price": closes[i],
                                 "reason": f"EMA{ema_fast}>EMA{ema_slow} & RSI crosses {rsi_entry}"})
                in_pos = True
                entry_price = closes[i]
                entry_idx   = i
        else:
            # Intraday SL/TP check
            pnl_pct = (closes[i] - entry_price) / entry_price * 100
            if stop_loss_pct > 0 and pnl_pct <= -stop_loss_pct:
                signals.append({"date": dates[i], "type": "sell", "price": closes[i],
                                 "reason": f"Stop Loss -{stop_loss_pct:.0f}%"})
                in_pos = False
                continue
            if take_profit_pct > 0 and pnl_pct >= take_profit_pct:
                signals.append({"date": dates[i], "type": "sell", "price": closes[i],
                                 "reason": f"Take Profit +{take_profit_pct:.0f}%"})
                in_pos = False
                continue
            # Strategy exit
            trend_broken = ema_f[i - 1] >= ema_s[i - 1] and ema_f[i] < ema_s[i]
            overbought   = rsi[i] > rsi_exit
            if trend_broken or overbought:
                reason = "EMA Death Cross" if trend_broken else f"RSI overbought >{rsi_exit}"
                signals.append({"date": dates[i], "type": "sell", "price": closes[i],
                                 "reason": reason})
                in_pos = False
    return signals


# ── Strategy 2: Volatility Squeeze Reversal ──────────────────────────────────

def run_vsr(closes, dates, high, low,
            bb_period=20, bb_std=2.0,
            stoch_k=14, stoch_d=3,
            stoch_entry=25, stoch_exit=78,
            stop_loss_pct=5.0, take_profit_pct=12.0):
    """
    BUY : Close crosses_above BB_Lower  AND  STOCH_K crosses_above stoch_entry
    SELL: Close crosses_above BB_Upper  OR   STOCH_K > stoch_exit
    """
    bb_upper, _, bb_lower = _bollinger(closes, bb_period, bb_std)
    stoch, _              = _stochastic(high, low, closes, stoch_k, stoch_d)

    signals = []
    in_pos  = False
    entry_price = 0.0

    for i in range(1, len(closes)):
        if any(np.isnan(x) for x in [bb_upper[i], bb_lower[i], stoch[i], stoch[i - 1]]):
            continue

        if not in_pos:
            bb_bounce   = closes[i - 1] <= bb_lower[i - 1] and closes[i] > bb_lower[i]
            stoch_cross = stoch[i - 1] <= stoch_entry and stoch[i] > stoch_entry
            if bb_bounce and stoch_cross:
                signals.append({"date": dates[i], "type": "buy", "price": closes[i],
                                 "reason": f"BB bounce + Stoch crosses {stoch_entry}"})
                in_pos = True
                entry_price = closes[i]
        else:
            pnl_pct = (closes[i] - entry_price) / entry_price * 100
            if stop_loss_pct > 0 and pnl_pct <= -stop_loss_pct:
                signals.append({"date": dates[i], "type": "sell", "price": closes[i],
                                 "reason": f"Stop Loss -{stop_loss_pct:.0f}%"})
                in_pos = False
                continue
            if take_profit_pct > 0 and pnl_pct >= take_profit_pct:
                signals.append({"date": dates[i], "type": "sell", "price": closes[i],
                                 "reason": f"Take Profit +{take_profit_pct:.0f}%"})
                in_pos = False
                continue
            bb_exit    = closes[i - 1] <= bb_upper[i - 1] and closes[i] > bb_upper[i]
            stoch_over = stoch[i] > stoch_exit
            if bb_exit or stoch_over:
                reason = "BB Upper touch" if bb_exit else f"Stoch overbought >{stoch_exit}"
                signals.append({"date": dates[i], "type": "sell", "price": closes[i],
                                 "reason": reason})
                in_pos = False
    return signals


# ── Performance Calculator ────────────────────────────────────────────────────

def build_performance(signals, initial_capital=10000.0):
    trades = []
    capital = initial_capital
    buy_sig = None
    for s in signals:
        if s["type"] == "buy" and buy_sig is None:
            buy_sig = s
        elif s["type"] == "sell" and buy_sig is not None:
            entry   = buy_sig["price"]
            exit_p  = s["price"]
            shares  = capital / entry
            pnl     = (exit_p - entry) * shares
            pnl_pct = (exit_p - entry) / entry * 100
            capital += pnl
            trades.append({
                "entry": buy_sig["date"],
                "exit":  s["date"],
                "pnl_pct": round(pnl_pct, 2),
                "exit_reason": s["reason"],
            })
            buy_sig = None

    if not trades:
        return {"trades": 0, "win_rate": 0, "total_return": 0,
                "ann_return": 0, "max_dd": 0, "sharpe": 0, "final": initial_capital}

    total_ret = (capital - initial_capital) / initial_capital * 100

    try:
        from datetime import datetime
        s_dt = datetime.strptime(trades[0]["entry"][:10], "%Y-%m-%d")
        e_dt = datetime.strptime(trades[-1]["exit"][:10], "%Y-%m-%d")
        years = max((e_dt - s_dt).days / 365.25, 1 / 12)
    except Exception:
        years = 1.0

    ann_ret  = ((capital / initial_capital) ** (1 / years) - 1) * 100
    win_rate = sum(1 for t in trades if t["pnl_pct"] > 0) / len(trades) * 100

    # Equity curve max drawdown
    eq = [initial_capital]
    c = initial_capital
    for t in trades:
        c *= (1 + t["pnl_pct"] / 100)
        eq.append(c)
    peak = eq[0]
    max_dd = 0.0
    for v in eq:
        if v > peak: peak = v
        dd = (v - peak) / peak * 100
        if dd < max_dd: max_dd = dd

    # Sharpe (based on trade returns)
    rets = np.array([t["pnl_pct"] / 100 for t in trades])
    rf   = 0.02 / 252
    sharpe = (np.mean(rets) - rf) / np.std(rets) * np.sqrt(252) if np.std(rets) > 0 else 0.0

    return {
        "trades":       len(trades),
        "win_rate":     round(win_rate, 1),
        "total_return": round(total_ret, 2),
        "ann_return":   round(ann_ret, 2),
        "max_dd":       round(max_dd, 2),
        "sharpe":       round(float(sharpe), 2),
        "final":        round(capital, 2),
    }


# ── Benchmark (Buy & Hold) ────────────────────────────────────────────────────

def buy_and_hold(closes, initial_capital=10000.0):
    ret = (closes[-1] - closes[0]) / closes[0] * 100
    return round(ret, 2)


# ── Data Fetcher ──────────────────────────────────────────────────────────────

def fetch(ticker, start, end):
    df = yf.download(ticker, start=start, end=end, progress=False, auto_adjust=True)
    if df.empty:
        return None, None, None, None, None
    closes = df["Close"].values.flatten().astype(float)
    highs  = df["High"].values.flatten().astype(float)
    lows   = df["Low"].values.flatten().astype(float)
    dates  = [str(d)[:10] for d in df.index]
    return closes, highs, lows, dates, df


# ── Main ──────────────────────────────────────────────────────────────────────

def run():
    TICKERS    = ["NVDA", "AAPL", "MSFT", "TSLA", "SPY"]
    START      = "2020-01-01"
    END        = "2024-12-31"
    CAPITAL    = 10_000

    STRATEGIES = {
        "TMC (Trend+Momentum)": run_tmc,
        "VSR (Squeeze+Stoch)":  run_vsr,
    }

    COL = {
        "cyan":   "\033[96m",
        "green":  "\033[92m",
        "red":    "\033[91m",
        "yellow": "\033[93m",
        "bold":   "\033[1m",
        "dim":    "\033[2m",
        "reset":  "\033[0m",
    }

    def c(color, text): return f"{COL[color]}{text}{COL['reset']}"
    def fmt_ret(v):
        if v > 0:  return c("green",  f"+{v:.1f}%")
        if v < 0:  return c("red",    f"{v:.1f}%")
        return f"{v:.1f}%"
    def fmt_dd(v):
        if v < -20: return c("red",    f"{v:.1f}%")
        if v < -10: return c("yellow", f"{v:.1f}%")
        return f"{v:.1f}%"

    print()
    print(c("bold", "=" * 76))
    print(c("bold", c("cyan", "  QUANT ALPHA RESEARCH  |  퀀트 팩터 전략 백테스트")))
    print(c("bold", "=" * 76))
    print(c("dim",  f"  Period : {START} → {END}  |  Capital : ${CAPITAL:,}  |  Tickers : {', '.join(TICKERS)}"))
    print()

    # ── Strategy Definitions ──────────────────────────────────────────────────
    print(c("bold", "  ▶ Strategy 1 — Trend Momentum Confluence (TMC)"))
    print(c("dim",  "    BUY : EMA(20) > EMA(50)  AND  RSI(14) crosses_above 50"))
    print(c("dim",  "    SELL: EMA Death Cross     OR   RSI > 72"))
    print(c("dim",  "    RISK: SL -6%  |  TP +18%"))
    print()
    print(c("bold", "  ▶ Strategy 2 — Volatility Squeeze Reversal (VSR)"))
    print(c("dim",  "    BUY : Close crosses_above BB_Lower(20,2)  AND  Stoch %K crosses 25"))
    print(c("dim",  "    SELL: Close crosses_above BB_Upper(20,2)  OR   Stoch %K > 78"))
    print(c("dim",  "    RISK: SL -5%  |  TP +12%"))
    print()
    print("-" * 76)

    all_results = {}

    for ticker in TICKERS:
        print(f"\n  {c('bold', c('cyan', f'[{ticker}]'))}", end="  ", flush=True)
        closes, highs, lows, dates, df = fetch(ticker, START, END)
        if closes is None:
            print(c("red", "데이터 없음"))
            continue

        bnh = buy_and_hold(closes, CAPITAL)
        print(c("dim", f"bars={len(closes)}, B&H={fmt_ret(bnh)}"))

        for strat_name, strat_fn in STRATEGIES.items():
            signals = strat_fn(closes, dates, highs, lows)
            perf    = build_performance(signals, CAPITAL)
            all_results.setdefault(strat_name, {})[ticker] = {**perf, "bnh": bnh}

            win_str   = c("green", f"{perf['win_rate']:.0f}%") if perf["win_rate"] >= 50 else c("red", f"{perf['win_rate']:.0f}%")
            sharpe_str = c("green", f"{perf['sharpe']:.2f}") if perf["sharpe"] >= 1.0 else (
                         c("yellow", f"{perf['sharpe']:.2f}") if perf["sharpe"] >= 0.5 else
                         c("red",    f"{perf['sharpe']:.2f}"))

            print(f"    {'TMC' if 'TMC' in strat_name else 'VSR'}"
                  f"  trades={perf['trades']:2d}"
                  f"  win={win_str}"
                  f"  ret={fmt_ret(perf['total_return'])}"
                  f"  ann={fmt_ret(perf['ann_return'])}"
                  f"  dd={fmt_dd(perf['max_dd'])}"
                  f"  sharpe={sharpe_str}"
                  f"  final=${perf['final']:,.0f}")

    # ── Summary Table ─────────────────────────────────────────────────────────
    print()
    print(c("bold", "=" * 76))
    print(c("bold", c("cyan", "  SUMMARY — Total Return vs Buy & Hold")))
    print(c("bold", "=" * 76))
    header = f"  {'Strategy':<28}" + "".join(f"  {t:>8}" for t in TICKERS)
    print(c("dim", header))
    print(c("dim", "  " + "-" * 72))

    for strat_name, ticker_results in all_results.items():
        row = f"  {strat_name:<28}"
        for t in TICKERS:
            if t in ticker_results:
                v = ticker_results[t]["total_return"]
                row += f"  {fmt_ret(v):>18}"
            else:
                row += "        N/A"
        print(row)

    # Buy & Hold row
    if all_results:
        first_strat = list(all_results.values())[0]
        row = f"  {'Buy & Hold':<28}"
        for t in TICKERS:
            if t in first_strat:
                v = first_strat[t]["bnh"]
                row += f"  {fmt_ret(v):>18}"
            else:
                row += "        N/A"
        print(row)

    # ── Best Sharpe ────────────────────────────────────────────────────────────
    print()
    print(c("bold", "  ■ Best Sharpe Ratio per Ticker"))
    for t in TICKERS:
        best_strat  = None
        best_sharpe = -999
        for sname, tres in all_results.items():
            if t in tres and tres[t]["sharpe"] > best_sharpe:
                best_sharpe = tres[t]["sharpe"]
                best_strat  = sname
        if best_strat:
            scolor = "green" if best_sharpe >= 1.0 else ("yellow" if best_sharpe >= 0.5 else "red")
            print(f"    {c('bold', t):>6}  →  {best_strat}  Sharpe={c(scolor, str(best_sharpe))}")

    print()
    print(c("bold", "=" * 76))
    print()


if __name__ == "__main__":
    run()