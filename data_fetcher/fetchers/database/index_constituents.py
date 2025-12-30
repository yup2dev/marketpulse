"""Database Index Constituents Fetcher"""
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from data_fetcher.fetchers.base import Fetcher
from index_analyzer.models.database import (
    MBS_IN_STBD_MST, MBS_IN_INDX_STBD, get_sqlite_db
)

log = logging.getLogger(__name__)


class IndexQueryParams(BaseModel):
    """Index query parameters"""
    index: str = Field(description="Index name - 'sp500', 'nasdaq100', 'dow30'")


class ConstituentResult(BaseModel):
    """Index constituent data"""
    symbol: str
    name: str
    sector: Optional[str] = None
    sub_sector: Optional[str] = None
    headquarters: Optional[str] = None
    date_first_added: Optional[str] = None
    cik: Optional[str] = None
    founded: Optional[str] = None


class DBIndexConstituentsFetcher(Fetcher[IndexQueryParams, ConstituentResult]):
    """Database Index Constituents Fetcher - S&P 500, NASDAQ 100, Dow 30"""

    require_credentials = False

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> IndexQueryParams:
        """Transform query parameters"""
        return IndexQueryParams(**params)

    @staticmethod
    def extract_data(
        query: IndexQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        """
        Extract index constituents data from Database

        Args:
            query: Query parameters
            credentials: Not used for DB queries
            **kwargs: Additional parameters (db_path)

        Returns:
            Raw data list
        """
        try:
            # Get DB path from kwargs or use default
            db_path = kwargs.get('db_path', Path(__file__).parent.parent.parent.parent / "data" / "marketpulse.db")

            # Connect to database
            db = get_sqlite_db(str(db_path))
            session = db.get_session()

            # Map index names to data sources
            # DB에 저장할 때 data_source를 'github_{index_id}' 형식으로 저장했음
            index_source_map = {
                "sp500": "github_sp500",
                "nasdaq100": "github_nasdaq100",
                "dow30": "github_dow30",
            }

            data_source = index_source_map.get(query.index.lower())
            if not data_source:
                log.error(f"Unknown index: {query.index}")
                session.close()
                return []

            # Query active tickers for this index
            tickers = session.query(MBS_IN_STBD_MST).filter(
                MBS_IN_STBD_MST.data_source == data_source,
                MBS_IN_STBD_MST.is_active == True,
                MBS_IN_STBD_MST.asset_type == 'stock'
            ).all()

            session.close()

            # Convert to dict
            data = []
            for ticker in tickers:
                data.append({
                    'symbol': ticker.ticker_cd,
                    'name': ticker.ticker_nm,
                    'sector': ticker.sector,
                    'subSector': ticker.industry,  # industry를 subSector로 매핑
                    'headQuarter': None,  # DB에 없음
                    'dateFirstAdded': ticker.start_date.isoformat() if ticker.start_date else None,
                    'cik': None,  # DB에 없음
                    'founded': None  # DB에 없음
                })

            log.info(f"Retrieved {len(data)} constituents from DB for {query.index}")
            return data

        except Exception as e:
            log.error(f"Error fetching index constituents from DB for '{query.index}': {e}")
            raise

    @staticmethod
    def transform_data(
        query: IndexQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[ConstituentResult]:
        """
        Transform raw data to standard model

        Args:
            query: Query parameters
            data: Raw data
            **kwargs: Additional parameters

        Returns:
            ConstituentResult list
        """
        if not data:
            log.info(f"No constituents found in DB for index: {query.index}")
            return []

        results = []

        for item in data:
            try:
                result = ConstituentResult(
                    symbol=item.get("symbol", ""),
                    name=item.get("name", ""),
                    sector=item.get("sector"),
                    sub_sector=item.get("subSector"),
                    headquarters=item.get("headQuarter"),
                    date_first_added=item.get("dateFirstAdded"),
                    cik=item.get("cik"),
                    founded=item.get("founded"),
                )

                results.append(result)

            except (KeyError, ValueError) as e:
                log.warning(f"Error parsing constituent from DB: {e}")
                continue

        log.info(f"Parsed {len(results)} constituents from DB for {query.index}")
        return results
