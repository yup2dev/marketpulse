"""SEC Form 4 Insider Trading Data Models"""
from datetime import date
from typing import Optional
from pydantic import BaseModel, Field


class SECInsiderTradingQueryParams(BaseModel):
    """SEC Insider Trading 쿼리 파라미터"""
    ticker: str = Field(description="Ticker symbol")
    cik: Optional[str] = Field(None, description="CIK number (10 digits with leading zeros)")
    limit: Optional[int] = Field(100, description="Maximum number of records")
    start_date: Optional[str] = Field(None, description="Start date (YYYY-MM-DD)")
    end_date: Optional[str] = Field(None, description="End date (YYYY-MM-DD)")


class SECInsiderTradingData(BaseModel):
    """SEC Form 4 Insider Trading 데이터"""
    ticker: str = Field(description="Ticker symbol")
    filing_date: date = Field(description="Filing date")
    transaction_date: Optional[date] = Field(None, description="Transaction date")
    accession_number: str = Field(description="SEC accession number")
    form_type: str = Field(description="Form type (usually 4)")
    insider_name: Optional[str] = Field(None, description="Insider name")
    insider_title: Optional[str] = Field(None, description="Insider title/relationship")
    transaction_type: Optional[str] = Field(None, description="Transaction type")
    shares: Optional[float] = Field(None, description="Number of shares")
    price_per_share: Optional[float] = Field(None, description="Price per share")
    transaction_value: Optional[float] = Field(None, description="Total transaction value")
    shares_owned_after: Optional[float] = Field(None, description="Shares owned after transaction")
    filing_url: str = Field(description="URL to SEC filing")

    class Config:
        json_schema_extra = {
            "example": {
                "ticker": "AAPL",
                "filing_date": "2024-11-15",
                "transaction_date": "2024-11-13",
                "accession_number": "0001234567-24-001234",
                "form_type": "4",
                "insider_name": "John Doe",
                "insider_title": "Chief Executive Officer",
                "transaction_type": "P",
                "shares": 10000.0,
                "price_per_share": 150.50,
                "transaction_value": 1505000.0,
                "shares_owned_after": 100000.0,
                "filing_url": "https://www.sec.gov/cgi-bin/browse-edgar?action=getfile&accession=0001234567-24-001234"
            }
        }
