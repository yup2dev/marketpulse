"""
Quant 3D Parameter Sweep Visualization
=======================================
TMC 전략의 3개 파라미터를 전수 조사하고 4차원으로 시각화

파라미터:
  X = EMA Fast  (10 ~ 30, step 5)
  Y = EMA Slow  (30 ~ 70, step 10)
  Z = RSI Entry (40 ~ 60, step 5)

시각화:
  - 3D Scatter: X/Y/Z=파라미터, 색상=Sharpe, 크기=승률
  - 2D Heatmap 슬라이스: RSI 값 고정 후 EMA Fast vs Slow 히트맵
  - 최적 경계면: Sharpe >= 1.0 인 조합만 표시
"""

import numpy as np
import yfinance as yf
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from mpl_toolkits.mplot3d import Axes3D
from matplotlib.colors import Normalize
from matplotlib.cm import ScalarMappable
import itertools, warnings
warnings.filterwarnings("ignore")

# ── 지표 함수 ─────────────────────────────────────────────────────────────────

def _ema(prices, period):
    result = np.full(len(prices), np.nan)
    if len(prices) < period: return result
    result[period - 1] = np.mean(prices[:period])
    k = 2.0 / (period + 1)
    for i in range(period, len(prices)):
        result[i] = prices[i] * k + result[i - 1] * (1 - k)
    return result

def _rsi(prices, period=14):
    result = np.full(len(prices), np.nan)
    if len(prices) <= period: return result
    deltas = np.diff(prices)
    gains  = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)
    ag, al = np.mean(gains[:period]), np.mean(losses[:period])
    for i in range(period, len(deltas)):
        ag = (ag * (period - 1) + gains[i]) / period
        al = (al * (period - 1) + losses[i]) / period
        rs = ag / al if al != 0 else 1e9
        result[i + 1] = 100 - (100 / (1 + rs))
    return result

# ── 전략 실행 ─────────────────────────────────────────────────────────────────

def run_tmc(closes, dates, ema_fast, ema_slow, rsi_entry,
            rsi_exit=72, sl=6.0, tp=18.0):
    ef  = _ema(closes, ema_fast)
    es  = _ema(closes, ema_slow)
    rsi = _rsi(closes, 14)
    signals, in_pos, entry_price = [], False, 0.0
    for i in range(1, len(closes)):
        if any(np.isnan(x) for x in [ef[i], es[i], rsi[i], rsi[i-1]]):
            continue
        if not in_pos:
            if ef[i] > es[i] and rsi[i-1] <= rsi_entry and rsi[i] > rsi_entry:
                signals.append(("buy", closes[i]))
                in_pos, entry_price = True, closes[i]
        else:
            pnl = (closes[i] - entry_price) / entry_price * 100
            if sl > 0 and pnl <= -sl:
                signals.append(("sell", closes[i])); in_pos = False; continue
            if tp > 0 and pnl >= tp:
                signals.append(("sell", closes[i])); in_pos = False; continue
            if (ef[i-1] >= es[i-1] and ef[i] < es[i]) or rsi[i] > rsi_exit:
                signals.append(("sell", closes[i])); in_pos = False
    return signals

def performance(signals, capital=10000.0):
    trades, cap, buy = [], capital, None
    for s_type, price in signals:
        if s_type == "buy" and buy is None:
            buy = price
        elif s_type == "sell" and buy is not None:
            pnl = (price - buy) / buy * 100
            cap *= (1 + pnl / 100)
            trades.append(pnl)
            buy = None
    if not trades:
        return 0.0, 0.0, 0.0, 0
    rets     = np.array(trades)
    total    = (cap - capital) / capital * 100
    win_rate = (rets > 0).sum() / len(rets) * 100
    sharpe   = (np.mean(rets) / np.std(rets) * np.sqrt(252)) if np.std(rets) > 0 else 0.0
    return round(total, 2), round(float(sharpe), 2), round(win_rate, 1), len(trades)

# ── 데이터 ────────────────────────────────────────────────────────────────────

print("  데이터 다운로드 중 (MSFT 2020-2024)...", flush=True)
df     = yf.download("MSFT", start="2020-01-01", end="2024-12-31",
                     progress=False, auto_adjust=True)
closes = df["Close"].values.flatten().astype(float)
dates  = [str(d)[:10] for d in df.index]
print(f"  bars={len(closes)}")

# ── 파라미터 범위 ─────────────────────────────────────────────────────────────

FAST_VALS  = list(range(10, 35, 5))    # [10,15,20,25,30]
SLOW_VALS  = list(range(30, 75, 10))   # [30,40,50,60,70]
RSI_VALS   = list(range(40, 65, 5))    # [40,45,50,55,60]
total_comb = len(FAST_VALS) * len(SLOW_VALS) * len(RSI_VALS)
print(f"  조합 수: {total_comb}개 스캔 중...", flush=True)

xs, ys, zs    = [], [], []   # fast, slow, rsi_entry
sharpes       = []
win_rates     = []
total_rets    = []

for fast, slow, rsi_entry in itertools.product(FAST_VALS, SLOW_VALS, RSI_VALS):
    if fast >= slow: continue
    sigs = run_tmc(closes, dates, fast, slow, rsi_entry)
    tot, sharpe, wr, n_trades = performance(sigs)
    if n_trades < 2: continue
    xs.append(fast)
    ys.append(slow)
    zs.append(rsi_entry)
    sharpes.append(sharpe)
    win_rates.append(wr)
    total_rets.append(tot)

xs, ys, zs    = np.array(xs),  np.array(ys),  np.array(zs)
sharpes       = np.array(sharpes)
win_rates     = np.array(win_rates)
total_rets    = np.array(total_rets)

best_idx = np.argmax(sharpes)
print(f"  완료! 유효 조합 {len(xs)}개")
print(f"  최적: fast={xs[best_idx]}, slow={ys[best_idx]}, "
      f"rsi={zs[best_idx]} → Sharpe={sharpes[best_idx]:.2f}, "
      f"Return={total_rets[best_idx]:.1f}%, WinRate={win_rates[best_idx]:.0f}%")

# ── 시각화 ────────────────────────────────────────────────────────────────────

fig = plt.figure(figsize=(20, 14), facecolor="#0d0d12")
fig.suptitle("TMC Strategy — 3D Parameter Sweep  |  MSFT 2020–2024",
             color="white", fontsize=15, fontweight="bold", y=0.98)

gs = gridspec.GridSpec(2, 3, figure=fig,
                       left=0.04, right=0.96, top=0.93, bottom=0.06,
                       wspace=0.35, hspace=0.4)

# ── 공통 색상 설정 ────────────────────────────────────────────────────────────
clamp_s  = np.clip(sharpes, -3, 10)
norm     = Normalize(vmin=clamp_s.min(), vmax=clamp_s.max())
cmap     = plt.cm.RdYlGn

# ── [0,0:2] 3D Scatter 메인 차트 ─────────────────────────────────────────────
ax3d = fig.add_subplot(gs[0, 0:2], projection="3d")
ax3d.set_facecolor("#0d0d12")
ax3d.set_title("4D View: X=EMA Fast, Y=EMA Slow, Z=RSI Entry\n"
               "Color=Sharpe Ratio, Size=Win Rate",
               color="#aaaaaa", fontsize=9, pad=6)

# 크기 스케일 (승률 반영)
sizes = ((win_rates - win_rates.min()) / (np.ptp(win_rates) + 1e-9) * 200 + 30)
colors = cmap(norm(clamp_s))

sc = ax3d.scatter(xs, ys, zs, c=clamp_s, cmap=cmap,
                  norm=norm, s=sizes, alpha=0.85, edgecolors="none")

# 최적점 강조
ax3d.scatter([xs[best_idx]], [ys[best_idx]], [zs[best_idx]],
             c="gold", s=300, marker="*", zorder=10, label="Best")

ax3d.set_xlabel("EMA Fast",  color="#888", labelpad=6, fontsize=8)
ax3d.set_ylabel("EMA Slow",  color="#888", labelpad=6, fontsize=8)
ax3d.set_zlabel("RSI Entry", color="#888", labelpad=6, fontsize=8)
ax3d.tick_params(colors="#666", labelsize=7)
for pane in [ax3d.xaxis.pane, ax3d.yaxis.pane, ax3d.zaxis.pane]:
    pane.fill = False
    pane.set_edgecolor("#333")
ax3d.grid(True, color="#333", linewidth=0.4)
ax3d.legend(fontsize=8, loc="upper left", labelcolor="white",
            facecolor="#1a1a22", edgecolor="#444")

cbar1 = fig.colorbar(ScalarMappable(norm=norm, cmap=cmap),
                     ax=ax3d, shrink=0.5, pad=0.08, aspect=20)
cbar1.set_label("Sharpe Ratio", color="#aaa", fontsize=8)
cbar1.ax.yaxis.set_tick_params(color="#666", labelsize=7, labelcolor="#888")

# ── [0,2] Total Return vs Sharpe 산점도 ─────────────────────────────────────
ax_ret = fig.add_subplot(gs[0, 2])
ax_ret.set_facecolor("#0d0d12")
ax_ret.spines[:].set_color("#333")
ax_ret.tick_params(colors="#666", labelsize=8)
ax_ret.set_title("Return vs Sharpe\n(색=RSI Entry)", color="#aaa", fontsize=9)

rsi_norm  = Normalize(vmin=min(RSI_VALS), vmax=max(RSI_VALS))
rsi_cmap  = plt.cm.plasma
rsi_colors = rsi_cmap(rsi_norm(zs))

ax_ret.scatter(total_rets, sharpes, c=zs, cmap=rsi_cmap,
               norm=rsi_norm, s=30, alpha=0.7, edgecolors="none")
ax_ret.scatter(total_rets[best_idx], sharpes[best_idx],
               c="gold", s=200, marker="*", zorder=10, label="Best")
ax_ret.axhline(0, color="#555", lw=0.8, ls="--")
ax_ret.axvline(0, color="#555", lw=0.8, ls="--")
ax_ret.axhline(1, color="#4ade80", lw=0.6, ls=":", alpha=0.6)
ax_ret.set_xlabel("Total Return (%)", color="#888", fontsize=8)
ax_ret.set_ylabel("Sharpe Ratio",     color="#888", fontsize=8)
ax_ret.legend(fontsize=8, labelcolor="white",
              facecolor="#1a1a22", edgecolor="#444")
cbar2 = fig.colorbar(ScalarMappable(norm=rsi_norm, cmap=rsi_cmap),
                     ax=ax_ret, shrink=0.8, pad=0.04)
cbar2.set_label("RSI Entry", color="#aaa", fontsize=8)
cbar2.ax.yaxis.set_tick_params(color="#666", labelsize=7, labelcolor="#888")

# ── [1, 0~2] RSI 값별 2D Heatmap 슬라이스 ────────────────────────────────────
for col_i, rsi_val in enumerate(RSI_VALS[:3]):   # RSI 40, 45, 50 표시
    ax_hm = fig.add_subplot(gs[1, col_i])
    ax_hm.set_facecolor("#0d0d12")
    ax_hm.spines[:].set_color("#333")
    ax_hm.tick_params(colors="#666", labelsize=8)
    ax_hm.set_title(f"Sharpe Heatmap  (RSI Entry={rsi_val})",
                    color="#aaa", fontsize=9)

    mask = zs == rsi_val
    if mask.sum() == 0:
        ax_hm.text(0.5, 0.5, "No Data", ha="center", va="center",
                   color="#666", transform=ax_hm.transAxes)
        continue

    # 히트맵 격자 구성
    f_vals = sorted(set(xs[mask]))
    s_vals = sorted(set(ys[mask]))
    grid   = np.full((len(s_vals), len(f_vals)), np.nan)
    f_idx  = {v: i for i, v in enumerate(f_vals)}
    s_idx  = {v: i for i, v in enumerate(s_vals)}
    for xi, yi, sh in zip(xs[mask], ys[mask], sharpes[mask]):
        r, c = s_idx[yi], f_idx[xi]
        grid[r, c] = sh

    im = ax_hm.imshow(grid, cmap=cmap, aspect="auto",
                      vmin=-3, vmax=10, origin="lower")
    ax_hm.set_xticks(range(len(f_vals)))
    ax_hm.set_yticks(range(len(s_vals)))
    ax_hm.set_xticklabels(f_vals, fontsize=7, color="#888")
    ax_hm.set_yticklabels(s_vals, fontsize=7, color="#888")
    ax_hm.set_xlabel("EMA Fast", color="#888", fontsize=8)
    ax_hm.set_ylabel("EMA Slow", color="#888", fontsize=8)

    # 셀 값 표시
    for r in range(len(s_vals)):
        for c in range(len(f_vals)):
            v = grid[r, c]
            if not np.isnan(v):
                txt_color = "white" if abs(v) > 3 else "#aaa"
                ax_hm.text(c, r, f"{v:.1f}", ha="center", va="center",
                           fontsize=6.5, color=txt_color, fontweight="bold")

    cbar3 = fig.colorbar(im, ax=ax_hm, shrink=0.8, pad=0.04)
    cbar3.set_label("Sharpe", color="#aaa", fontsize=7)
    cbar3.ax.yaxis.set_tick_params(color="#666", labelsize=6, labelcolor="#888")

    # 최적 셀 강조
    bm = mask & (sharpes == sharpes[mask].max())
    if bm.any():
        bi = np.where(bm)[0][0]
        ax_hm.add_patch(plt.Rectangle(
            (f_idx[xs[bi]] - 0.5, s_idx[ys[bi]] - 0.5), 1, 1,
            fill=False, edgecolor="gold", linewidth=2.5))

# ── 범례 텍스트 (우측 하단 여백에) ────────────────────────────────────────────
note = ("★ = Best combo  |  Heatmap: RSI Entry 40/45/50 슬라이스\n"
        "Size in 3D plot ∝ Win Rate  |  Color ∝ Sharpe Ratio")
fig.text(0.5, 0.01, note, ha="center", color="#555", fontsize=8)

out_path = "quant_3d_scan.png"
plt.savefig(out_path, dpi=150, bbox_inches="tight", facecolor="#0d0d12")
print(f"\n  저장 완료 → {out_path}")
plt.show()
