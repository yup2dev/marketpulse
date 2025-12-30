"""
Portfolio Service
Provides institutional portfolio and 13F holdings data
"""
import sys
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from data_fetcher.fetchers.whalewisdom import WhaleWisdomFetcher

log = logging.getLogger(__name__)


class PortfolioService:
    """Service for institutional portfolio data"""

    def __init__(self):
        self.fetcher = WhaleWisdomFetcher

    async def get_institutions_list(
        self,
        use_dynamic: bool = True,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get list of all available institutions with 13F filings

        Args:
            use_dynamic: If True, fetch from SEC dynamically. If False, use featured list.
            limit: Maximum number of institutions to return (only for dynamic)

        Returns:
            List of institutions with basic information
        """
        try:
            institutions_list = self.fetcher.get_institutions_list(
                use_dynamic=use_dynamic,
                limit=limit
            )

            institutions = [
                {
                    "key": inst.key,
                    "name": inst.name,
                    "manager": inst.manager,
                    "cik": inst.cik,
                    "description": inst.description
                }
                for inst in institutions_list
            ]

            return institutions

        except Exception as e:
            log.error(f"Error fetching institutions list: {e}")
            raise

    async def get_institution_portfolio(
        self,
        institution_key: str,
        limit: int = 50
    ) -> Dict[str, Any]:
        """
        Get detailed 13F holdings for a specific institution

        Args:
            institution_key: Institution identifier (e.g., 'berkshire', 'ark')
            limit: Maximum number of holdings to return

        Returns:
            Portfolio data including holdings, metrics, and metadata
        """
        try:
            params = {"institution_key": institution_key, "limit": limit}
            results = await self.fetcher.fetch_data(params, credentials=None)

            if not results or len(results) == 0:
                raise ValueError(f"Holdings not found for institution: {institution_key}")

            portfolio = results[0]

            # Build response with actual fetcher data
            holding = {
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
                        "weight": stock.weight
                    }
                    for stock in portfolio.stocks
                ]
            }

            # Add optional fields if available from fetcher
            if hasattr(portfolio, 'performance') and portfolio.performance:
                holding["performance"] = portfolio.performance

            if hasattr(portfolio, 'top_sectors') and portfolio.top_sectors:
                holding["top_sectors"] = portfolio.top_sectors

            return holding

        except ValueError:
            raise
        except Exception as e:
            log.error(f"Error fetching portfolio for {institution_key}: {e}")
            raise


# Global instance
portfolio_service = PortfolioService()
