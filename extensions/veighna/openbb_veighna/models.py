"""Pydantic models for VeighNa Alpha extension."""

from typing import Optional

from pydantic import BaseModel, Field


class AlphaFactorResult(BaseModel):
    """Single period alpha factor result."""

    date: str
    symbol: str
    factor_value: float


class BacktestMetrics(BaseModel):
    """Backtest performance metrics."""

    total_return: float = Field(description="Cumulative return over the period")
    annualized_return: float = Field(description="Annualized return")
    annualized_volatility: float = Field(description="Annualized volatility")
    sharpe_ratio: float = Field(description="Sharpe ratio (risk-free=0)")
    max_drawdown: float = Field(description="Maximum drawdown")
    win_rate: float = Field(description="Fraction of profitable periods")
    calmar_ratio: float = Field(description="Annualized return / |max drawdown|")


class BacktestResult(BaseModel):
    """Full backtest output."""

    metrics: BacktestMetrics
    equity_curve: list[dict] = Field(
        description="Date + cumulative_return pairs for charting"
    )


class MomentumFactorData(BaseModel):
    """Output row for momentum factor endpoint."""

    date: str
    symbol: str
    momentum: float = Field(description="Lookback-period return used as factor signal")
    rank: Optional[int] = Field(None, description="Cross-sectional rank among symbols")
