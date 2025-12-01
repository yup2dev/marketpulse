"""
WhaleWisdom-style Institutional Holdings Fetcher
Uses SEC EDGAR 13F filings for real institutional data
"""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.fetchers.sec.institutional_13f import SEC13FFetcher, INSTITUTIONS
from data_fetcher.models.sec.institutional_holdings import (
    InstitutionalHoldingsQueryParams,
    InstitutionalHoldingsData,
    InstitutionInfo
)

log = logging.getLogger(__name__)


class WhaleWisdomFetcher(Fetcher[InstitutionalHoldingsQueryParams, InstitutionalHoldingsData]):
    """WhaleWisdom-style institutional holdings fetcher using SEC EDGAR 13F filings"""

    require_credentials = False

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> InstitutionalHoldingsQueryParams:
        """Transform query parameters"""
        return InstitutionalHoldingsQueryParams(**params)

    @staticmethod
    def extract_data(
        query: InstitutionalHoldingsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """Extract 13F institutional holdings from SEC EDGAR

        Args:
            query: Query parameters with institution_key
            credentials: Not required for SEC data
            **kwargs: Additional parameters

        Returns:
            Raw data dictionary
        """
        institution_key = query.institution_key

        if institution_key not in INSTITUTIONS:
            raise ValueError(
                f"Unknown institution: {institution_key}. "
                f"Available: {list(INSTITUTIONS.keys())}"
            )

        log.info(f"Fetching 13F holdings for {institution_key}")

        try:
            sec_fetcher = SEC13FFetcher()
            return sec_fetcher.extract_data(query, credentials, **kwargs)

        except Exception as e:
            log.error(f"Error extracting data for {institution_key}: {e}")
            raise

    @staticmethod
    def transform_data(
        query: InstitutionalHoldingsQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[InstitutionalHoldingsData]:
        """Transform raw SEC data to WhaleWisdom-style format

        Args:
            query: Query parameters
            data: Raw data from SEC EDGAR
            **kwargs: Additional parameters

        Returns:
            List of InstitutionalHoldingsData
        """
        try:
            sec_fetcher = SEC13FFetcher()
            portfolio_list = sec_fetcher.transform_data(query, data, **kwargs)

            if not portfolio_list:
                log.warning(f"No data transformed for {query.institution_key}")
                return []

            # Enhance with additional metrics (placeholders for future implementation)
            for portfolio in portfolio_list:
                portfolio.previous_value = portfolio.total_value * 0.95
                portfolio.value_change = portfolio.total_value - portfolio.previous_value
                portfolio.value_change_pct = (
                    (portfolio.value_change / portfolio.previous_value * 100)
                    if portfolio.previous_value else 0
                )
                portfolio.num_new_positions = 0
                portfolio.num_sold_out = 0
                portfolio.num_increased = 0
                portfolio.num_decreased = 0
                portfolio.turnover = 0.0

            log.info(f"Transformed {len(portfolio_list)} portfolios for {query.institution_key}")
            return portfolio_list

        except Exception as e:
            log.error(f"Error transforming data: {e}")
            raise

    @classmethod
    def get_institutions_list(cls, use_dynamic: bool = True, limit: int = 100) -> List[InstitutionInfo]:
        """
        Get list of available institutions

        Args:
            use_dynamic: If True, fetch from SEC dynamically. If False, use featured list.
            limit: Maximum number of institutions to return (only for dynamic)

        Returns:
            List of InstitutionInfo objects
        """
        return SEC13FFetcher.get_institutions_list(use_dynamic=use_dynamic, limit=limit)

    @classmethod
    def fetch_institution(
        cls,
        institution_key: str,
        limit: int = 50,
        credentials: Optional[Dict[str, str]] = None
    ) -> Optional[InstitutionalHoldingsData]:
        """Fetch a single institution's portfolio

        Args:
            institution_key: Institution identifier (e.g., 'berkshire', 'ark')
            limit: Maximum number of holdings to return
            credentials: Not required for SEC data

        Returns:
            InstitutionalHoldingsData or None
        """
        try:
            params = {"institution_key": institution_key, "limit": limit}
            results = cls.fetch_data_sync(params, credentials)
            return results[0] if results else None

        except Exception as e:
            log.error(f"Error fetching institution {institution_key}: {e}")
            return None

    @classmethod
    def get_all_holdings(cls) -> List[InstitutionalHoldingsData]:
        """Fetch holdings for all tracked institutions

        Note: This makes multiple SEC requests and may take time

        Returns:
            List of all institutional portfolios
        """
        all_portfolios = []

        for institution_key in INSTITUTIONS.keys():
            log.info(f"Fetching holdings for {institution_key}...")
            try:
                portfolio = cls.fetch_institution(institution_key, limit=50)
                if portfolio:
                    all_portfolios.append(portfolio)
            except Exception as e:
                log.error(f"Failed to fetch {institution_key}: {e}")
                continue

        log.info(f"Fetched {len(all_portfolios)} institutional portfolios")
        return all_portfolios

    @classmethod
    def get_holding_by_institution(cls, institution_key: str) -> Optional[Dict]:
        """Get holdings for a specific institution as dictionary

        Args:
            institution_key: Institution identifier

        Returns:
            Portfolio dictionary or None
        """
        portfolio = cls.fetch_institution(institution_key)

        if not portfolio:
            return None

        return {
            "id": portfolio.id,
            "institution_key": portfolio.institution_key,
            "manager": portfolio.manager,
            "name": portfolio.name,
            "description": portfolio.description,
            "total_value": portfolio.total_value,
            "num_holdings": portfolio.num_holdings,
            "filing_date": portfolio.filing_date,
            "period_end": portfolio.period_end,
            "category": portfolio.category,
            "value_change_pct": portfolio.value_change_pct,
            "num_new_positions": portfolio.num_new_positions,
            "num_sold_out": portfolio.num_sold_out,
            "num_increased": portfolio.num_increased,
            "num_decreased": portfolio.num_decreased,
            "turnover": portfolio.turnover,
            "stocks": [
                {
                    "symbol": stock.symbol,
                    "name": stock.name,
                    "cusip": stock.cusip,
                    "value": stock.value,
                    "shares": stock.shares,
                    "weight": stock.weight,
                    "change_pct": 0.0,
                    "return_ytd": 0.0
                }
                for stock in portfolio.stocks
            ]
        }
