"""Database Index Constituents Fetcher"""
import logging
from typing import Any, Dict, List, Optional
from data_fetcher.abstract_provider.standard_models.index_constituents import (
    IndexConstituentsQueryParams,
    IndexConstituentData,
)
from data_fetcher.abstract_provider.abstract.base_fetchers import DbFetcher
from data_fetcher.providers.database.schema import (
    MBS_IN_STBD_MST, MBS_IN_INDX_STBD
)

log = logging.getLogger(__name__)


class IndexQueryParams(IndexConstituentsQueryParams):
    """Index query parameters (standard IndexConstituents 경유)"""


class ConstituentResult(IndexConstituentData):
    """Index constituent data (standard IndexConstituents 경유)"""


class DBIndexConstituentsFetcher(DbFetcher[IndexQueryParams, ConstituentResult]):
    """Database Index Constituents Fetcher - S&P 500, NASDAQ 100, Dow 30"""

    # index 이름 → 저장 시 data_source. DB에 적재 가능한 인덱스 목록의 원천.
    INDEX_SOURCE_MAP = {
        "sp500": "github_sp500",
        "nasdaq100": "github_nasdaq100",
        "dow30": "github_dow30",
    }
    # 프론트 셀렉터 옵션(param_choices) — /api/data/ 메타로 노출되어 index 드롭다운이 된다.
    param_choices = {"index": list(INDEX_SOURCE_MAP.keys())}

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> IndexQueryParams:
        """Transform query parameters"""
        return IndexQueryParams(**params)

    @classmethod
    def extract_data(
        cls,
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
            # Map index names to data sources (클래스 상수 사용 — param_choices와 단일 출처)
            data_source = cls.INDEX_SOURCE_MAP.get(query.index.lower())
            if not data_source:
                log.error(f"Unknown index: {query.index}")
                return []

            # Query active tickers for this index
            with cls.db_session(**kwargs) as session:
                tickers = session.query(MBS_IN_STBD_MST).filter(
                    MBS_IN_STBD_MST.data_source == data_source,
                    MBS_IN_STBD_MST.is_active == True,
                    MBS_IN_STBD_MST.asset_type == 'stock'
                ).all()

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
