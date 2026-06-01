"""VeighNa Alpha Router."""

from typing import Literal, Optional

from openbb_core.app.model.example import APIEx, PythonEx
from openbb_core.app.model.obbject import OBBject
from openbb_core.app.router import Router
from openbb_core.app.utils import basemodel_to_df
from openbb_core.provider.abstract.data import Data

from openbb_veighna.models import BacktestMetrics, BacktestResult, MomentumFactorData

router = Router(prefix="", description="VeighNa Alpha factor research tools.")


def _to_df(data: list[Data]):
    """Convert OpenBB Data list to DataFrame with close_price fallback."""
    # pylint: disable=import-outside-toplevel
    import pandas as pd

    df = basemodel_to_df(data)
    if "close" in df.columns and "close_price" not in df.columns:
        df = df.rename(columns={"close": "close_price"})
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"])
        df = df.sort_values("date")
    return df


@router.command(
    methods=["POST"],
    examples=[
        PythonEx(
            description="Compute momentum factor for a single symbol.",
            code=[
                "data = obb.equity.price.historical('AAPL', start_date='2022-01-01', provider='yfinance')",
                "obb.veighna.momentum(data=data.results, lookback=20)",
            ],
        ),
        APIEx(
            parameters={"lookback": 20, "data": APIEx.mock_data("timeseries", 30)}
        ),
    ],
)
def momentum(
    data: list[Data],
    lookback: int = 20,
    symbol: Optional[str] = None,
) -> OBBject[list[MomentumFactorData]]:
    """Compute momentum alpha factor (lookback-period return).

    Parameters
    ----------
    data : list[Data]
        OHLCV time series from any OpenBB equity/futures endpoint.
    lookback : int
        Number of periods for the return window (default 20 trading days).
    symbol : str, optional
        Symbol label to attach to each row. Inferred from data if omitted.

    Returns
    -------
    OBBject[list[MomentumFactorData]]
        Date + symbol + momentum factor value + cross-sectional rank.
    """
    df = _to_df(data)

    if "close_price" not in df.columns:
        raise ValueError("Data must contain a 'close' or 'close_price' column.")

    sym = symbol or (df["symbol"].iloc[0] if "symbol" in df.columns else "UNKNOWN")
    df["momentum"] = df["close_price"].pct_change(lookback)
    df = df.dropna(subset=["momentum"])
    df["rank"] = df["momentum"].rank().astype(int)

    results = [
        MomentumFactorData(
            date=str(row["date"].date()) if hasattr(row["date"], "date") else str(row["date"]),
            symbol=sym,
            momentum=round(row["momentum"], 6),
            rank=int(row["rank"]),
        )
        for _, row in df.iterrows()
    ]
    return OBBject(results=results)


@router.command(
    methods=["POST"],
    examples=[
        PythonEx(
            description="Backtest a simple momentum strategy on AAPL.",
            code=[
                "data = obb.equity.price.historical('AAPL', start_date='2020-01-01', provider='yfinance')",
                "obb.veighna.backtest(data=data.results, factor='momentum', lookback=20, holding=5)",
            ],
        ),
        APIEx(
            parameters={
                "factor": "momentum",
                "lookback": 20,
                "holding": 5,
                "data": APIEx.mock_data("timeseries", 60),
            }
        ),
    ],
)
def backtest(
    data: list[Data],
    factor: Literal["momentum", "mean_reversion"] = "momentum",
    lookback: int = 20,
    holding: int = 5,
    long_only: bool = True,
) -> OBBject[BacktestResult]:
    """Backtest a single-factor strategy using VeighNa-style signal logic.

    Parameters
    ----------
    data : list[Data]
        OHLCV time series — pass `.results` from any historical price call.
    factor : Literal["momentum", "mean_reversion"]
        Alpha factor to use for signal generation.
    lookback : int
        Signal calculation window (periods).
    holding : int
        Number of periods to hold each position before rebalancing.
    long_only : bool
        If True, skip short signals (default True).

    Returns
    -------
    OBBject[BacktestResult]
        Backtest metrics + equity curve ready for charting.
    """
    # pylint: disable=import-outside-toplevel
    import numpy as np
    import pandas as pd

    df = _to_df(data)

    if "close_price" not in df.columns:
        raise ValueError("Data must contain a 'close' or 'close_price' column.")

    prices = df.set_index("date")["close_price"]

    # --- Signal generation ---
    if factor == "momentum":
        signal = prices.pct_change(lookback)
    else:  # mean_reversion
        signal = -prices.pct_change(lookback)

    # --- Position: resample every `holding` periods ---
    position = signal.shift(1)  # avoid look-ahead bias
    if long_only:
        position = position.clip(lower=0)
    # Normalise to unit position size
    position = position.apply(lambda x: 1.0 if x > 0 else (-1.0 if x < 0 else 0.0))
    position = position.shift(holding).fillna(0)

    daily_returns = prices.pct_change()
    strategy_returns = (daily_returns * position).dropna()

    # --- Metrics ---
    total_return = float((1 + strategy_returns).prod() - 1)
    ann_factor = 252
    n = len(strategy_returns)
    annualized_return = float((1 + total_return) ** (ann_factor / n) - 1) if n > 0 else 0.0
    annualized_vol = float(strategy_returns.std() * np.sqrt(ann_factor))
    sharpe = annualized_return / annualized_vol if annualized_vol != 0 else 0.0

    cum = (1 + strategy_returns).cumprod()
    rolling_max = cum.cummax()
    drawdowns = (cum - rolling_max) / rolling_max
    max_dd = float(drawdowns.min())

    win_rate = float((strategy_returns > 0).mean())
    calmar = annualized_return / abs(max_dd) if max_dd != 0 else 0.0

    # --- Equity curve ---
    equity_curve = [
        {"date": str(idx.date()), "cumulative_return": round(float(val - 1), 6)}
        for idx, val in cum.items()
    ]

    metrics = BacktestMetrics(
        total_return=round(total_return, 6),
        annualized_return=round(annualized_return, 6),
        annualized_volatility=round(annualized_vol, 6),
        sharpe_ratio=round(sharpe, 4),
        max_drawdown=round(max_dd, 6),
        win_rate=round(win_rate, 4),
        calmar_ratio=round(calmar, 4),
    )
    return OBBject(results=BacktestResult(metrics=metrics, equity_curve=equity_curve))


@router.command(
    methods=["POST"],
    examples=[
        PythonEx(
            description="Rank a universe of symbols by momentum.",
            code=[
                "symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA']",
                "universe = {s: obb.equity.price.historical(s, start_date='2023-01-01', provider='yfinance').results for s in symbols}",
                "obb.veighna.rank_universe(universe=universe, factor='momentum', lookback=60)",
            ],
        ),
    ],
)
def rank_universe(
    universe: dict[str, list[Data]],
    factor: Literal["momentum", "mean_reversion"] = "momentum",
    lookback: int = 60,
) -> OBBject[list[dict]]:
    """Cross-sectionally rank a universe of symbols by a chosen alpha factor.

    Parameters
    ----------
    universe : dict[str, list[Data]]
        Mapping of symbol → results list from equity.price.historical.
    factor : Literal["momentum", "mean_reversion"]
        Factor to rank by.
    lookback : int
        Signal calculation window.

    Returns
    -------
    OBBject[list[dict]]
        Symbols sorted by factor strength with rank, signal value, and z-score.
    """
    # pylint: disable=import-outside-toplevel
    import numpy as np

    scores = {}
    for sym, data in universe.items():
        df = _to_df(data)
        if "close_price" not in df.columns:
            continue
        prices = df["close_price"]
        raw = prices.pct_change(lookback).iloc[-1]
        scores[sym] = -raw if factor == "mean_reversion" else raw

    if not scores:
        return OBBject(results=[])

    values = list(scores.values())
    mean, std = float(np.mean(values)), float(np.std(values))

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    results = [
        {
            "rank": i + 1,
            "symbol": sym,
            "signal": round(val, 6),
            "zscore": round((val - mean) / std, 4) if std != 0 else 0.0,
        }
        for i, (sym, val) in enumerate(ranked)
    ]
    return OBBject(results=results)
