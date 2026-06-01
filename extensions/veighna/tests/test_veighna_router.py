"""Tests for VeighNa Alpha extension."""

import pytest
from openbb_core.provider.abstract.data import Data


def _make_data(n: int = 60) -> list[Data]:
    """Generate synthetic OHLCV Data objects."""
    import pandas as pd

    dates = pd.date_range("2023-01-01", periods=n, freq="B")
    prices = 100 + pd.Series(range(n)) * 0.5  # simple uptrend

    return [
        Data.model_construct(
            date=str(d.date()),
            open=float(p - 0.1),
            high=float(p + 0.2),
            low=float(p - 0.3),
            close=float(p),
            volume=1_000_000,
        )
        for d, p in zip(dates, prices)
    ]


def test_momentum_basic():
    from openbb_veighna.veighna_router import momentum

    result = momentum(data=_make_data(60), lookback=20)
    assert result.results
    assert all(hasattr(r, "momentum") for r in result.results)


def test_momentum_lookback_gt_data_raises():
    from openbb_veighna.veighna_router import momentum

    # lookback > data length → all NaN dropped → empty results (not an error)
    result = momentum(data=_make_data(10), lookback=20)
    assert result.results == []


def test_backtest_momentum():
    from openbb_veighna.veighna_router import backtest

    result = backtest(data=_make_data(120), factor="momentum", lookback=20, holding=5)
    m = result.results.metrics
    assert -1.0 <= m.max_drawdown <= 0.0
    assert 0.0 <= m.win_rate <= 1.0
    assert len(result.results.equity_curve) > 0


def test_backtest_mean_reversion():
    from openbb_veighna.veighna_router import backtest

    result = backtest(data=_make_data(120), factor="mean_reversion", lookback=20, holding=5)
    assert result.results.metrics is not None


def test_rank_universe():
    from openbb_veighna.veighna_router import rank_universe

    universe = {
        "AAPL": _make_data(60),
        "MSFT": _make_data(60),
        "GOOGL": _make_data(60),
    }
    result = rank_universe(universe=universe, factor="momentum", lookback=20)
    assert len(result.results) == 3
    ranks = [r["rank"] for r in result.results]
    assert sorted(ranks) == [1, 2, 3]
