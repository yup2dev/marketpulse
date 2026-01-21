"""Yahoo Finance Insider Trading Models"""
from datetime import date
from typing import Optional
from pydantic import BaseModel, Field


class InsiderTradingQueryParams(BaseModel):
    """Insider Trading 조회 파라미터"""
    symbol: str = Field(..., description="종목 심볼")


class InsiderTransactionData(BaseModel):
    """내부자 거래 데이터"""
    symbol: str
    insider_name: Optional[str] = None
    insider_title: Optional[str] = None
    transaction_date: Optional[date] = None
    transaction_type: Optional[str] = None  # Sale, Purchase, etc.
    ownership_type: Optional[str] = None  # Direct, Indirect
    shares_traded: Optional[int] = None
    price_per_share: Optional[float] = None
    transaction_value: Optional[float] = None
    shares_owned_after: Optional[int] = None


class InsiderHolderData(BaseModel):
    """내부자 보유 정보"""
    symbol: str
    name: Optional[str] = None
    position: Optional[str] = None
    shares: Optional[int] = None
    value: Optional[float] = None
    latest_transaction_date: Optional[date] = None
    position_direct: Optional[int] = None
    position_indirect: Optional[int] = None
