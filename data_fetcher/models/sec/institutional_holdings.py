"""SEC 13F Institutional Holdings Models"""
from typing import Optional, List
from datetime import date
from pydantic import BaseModel, Field


class InstitutionalHoldingsQueryParams(BaseModel):
    """Query parameters for 13F institutional holdings"""

    institution_key: str = Field(
        description="Institution identifier (e.g., 'berkshire', 'ark', 'bridgewater')"
    )
    limit: int = Field(
        default=50,
        description="Maximum number of holdings to return"
    )


class HoldingData(BaseModel):
    """Individual stock holding"""

    symbol: str = Field(description="Stock ticker symbol")
    name: str = Field(description="Company name")
    cusip: str = Field(default="", description="CUSIP identifier")
    value: float = Field(description="Position value in dollars")
    shares: int = Field(default=0, description="Number of shares held")
    weight: float = Field(default=0.0, description="Portfolio weight percentage")
    share_type: str = Field(default="SH", description="Share type (SH=Shares, PRN=Principal)")


class InstitutionInfo(BaseModel):
    """Institution information"""

    key: str = Field(description="Institution key")
    name: str = Field(description="Institution name")
    cik: str = Field(description="SEC CIK number")
    manager: str = Field(description="Fund manager name")
    description: str = Field(default="", description="Institution description")


class InstitutionalHoldingsData(BaseModel):
    """13F institutional holdings data"""

    id: str = Field(description="Portfolio ID")
    institution_key: str = Field(description="Institution key")
    name: str = Field(description="Institution name")
    manager: str = Field(description="Fund manager")
    description: str = Field(description="Institution description")
    category: str = Field(default="13f", description="Portfolio category")
    source: str = Field(default="SEC EDGAR", description="Data source")
    filing_date: str = Field(description="Filing date (YYYY-MM-DD)")
    period_end: str = Field(description="Reporting period end date")
    total_value: float = Field(description="Total portfolio value")
    num_holdings: int = Field(description="Number of holdings")
    stocks: List[HoldingData] = Field(default_factory=list, description="List of stock holdings")

    # Optional performance metrics (estimates or calculated)
    previous_value: Optional[float] = Field(None, description="Previous quarter value")
    value_change: Optional[float] = Field(None, description="Value change from previous quarter")
    value_change_pct: Optional[float] = Field(None, description="Value change percentage")
    num_new_positions: Optional[int] = Field(0, description="Number of new positions")
    num_sold_out: Optional[int] = Field(0, description="Number of sold positions")
    num_increased: Optional[int] = Field(0, description="Number of increased positions")
    num_decreased: Optional[int] = Field(0, description="Number of decreased positions")
    turnover: Optional[float] = Field(0.0, description="Portfolio turnover rate")
