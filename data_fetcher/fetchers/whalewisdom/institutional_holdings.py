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
    HoldingData,
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
        """Extract 13F institutional holdings from SEC EDGAR (2 quarters for QoQ)

        Args:
            query: Query parameters with institution_key
            credentials: Not required for SEC data
            **kwargs: Additional parameters

        Returns:
            Raw data dictionary with current and previous quarter holdings
        """
        institution_key = query.institution_key

        if institution_key not in INSTITUTIONS:
            raise ValueError(
                f"Unknown institution: {institution_key}. "
                f"Available: {list(INSTITUTIONS.keys())}"
            )

        inst_info = INSTITUTIONS[institution_key]
        cik = inst_info['cik']

        log.info(f"Fetching 2-quarter 13F holdings for {institution_key}")

        headers = {
            'User-Agent': 'MarketPulse research@marketpulse.com',
            'Accept-Encoding': 'gzip, deflate',
            'Host': 'www.sec.gov'
        }

        try:
            filing_urls = SEC13FFetcher._get_filing_urls(cik, headers, count=2)

            if not filing_urls:
                log.error(f"No 13F filings found for {inst_info['name']}")
                return {
                    'institution': inst_info,
                    'holdings': [],
                    'filing_date': None,
                    'previous_holdings': [],
                    'previous_filing_date': None
                }

            # Parse current quarter
            current_holdings, current_filing_date = SEC13FFetcher._parse_filing(filing_urls[0], headers)
            log.info(f"Current quarter: {len(current_holdings)} holdings, filed {current_filing_date}")

            # Parse previous quarter if available
            previous_holdings = []
            previous_filing_date = None
            if len(filing_urls) >= 2:
                import time
                time.sleep(0.2)  # SEC rate limiting
                previous_holdings, previous_filing_date = SEC13FFetcher._parse_filing(filing_urls[1], headers)
                log.info(f"Previous quarter: {len(previous_holdings)} holdings, filed {previous_filing_date}")

            return {
                'institution': inst_info,
                'holdings': current_holdings,
                'filing_date': current_filing_date,
                'previous_holdings': previous_holdings,
                'previous_filing_date': previous_filing_date
            }

        except Exception as e:
            log.error(f"Error extracting data for {institution_key}: {e}")
            raise

    @staticmethod
    def transform_data(
        query: InstitutionalHoldingsQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[InstitutionalHoldingsData]:
        """Transform raw SEC data to WhaleWisdom-style format with QoQ comparison

        Args:
            query: Query parameters
            data: Raw data from SEC EDGAR (current + previous quarter)
            **kwargs: Additional parameters

        Returns:
            List of InstitutionalHoldingsData with per-stock QoQ changes
        """
        try:
            inst_info = data['institution']
            current_holdings_raw = data['holdings']
            filing_date = data.get('filing_date', '2024-12-31')
            previous_holdings_raw = data.get('previous_holdings', [])
            previous_filing_date = data.get('previous_filing_date')

            if not current_holdings_raw:
                log.warning(f"No holdings found for {inst_info['name']}")
                return []

            # Build previous quarter lookup: CUSIP -> holding dict
            prev_by_cusip = {}
            prev_by_symbol = {}
            for h in previous_holdings_raw:
                if h.get('share_type') == 'SH':
                    cusip = h.get('cusip', '')
                    symbol = h.get('symbol', '')
                    if cusip:
                        prev_by_cusip[cusip] = h
                    if symbol:
                        prev_by_symbol[symbol] = h

            has_previous = len(prev_by_cusip) > 0 or len(prev_by_symbol) > 0

            # Calculate total values
            total_value = sum(h['value'] for h in current_holdings_raw if h.get('share_type') == 'SH')
            prev_total_value = sum(h['value'] for h in previous_holdings_raw if h.get('share_type') == 'SH')

            # Sort by value
            holdings_sorted = sorted(current_holdings_raw, key=lambda x: x['value'], reverse=True)

            # Track which previous positions were matched
            matched_prev_cusips = set()
            matched_prev_symbols = set()

            # Convert to HoldingData with QoQ comparison
            stock_holdings = []
            num_new = 0
            num_increased = 0
            num_decreased = 0
            turnover_value = 0.0

            for holding in holdings_sorted[:query.limit]:
                if holding.get('share_type') != 'SH':
                    continue

                weight = (holding['value'] / total_value * 100) if total_value > 0 else 0
                cusip = holding.get('cusip', '')
                symbol = holding.get('symbol', '') or cusip[:6]

                # Match to previous quarter: CUSIP first, then symbol fallback
                prev = None
                if cusip and cusip in prev_by_cusip:
                    prev = prev_by_cusip[cusip]
                    matched_prev_cusips.add(cusip)
                elif symbol and symbol in prev_by_symbol:
                    prev = prev_by_symbol[symbol]
                    matched_prev_symbols.add(symbol)

                # Compute QoQ fields
                prev_shares = None
                prev_value = None
                share_change = None
                share_change_pct = None
                h_value_change = None
                h_value_change_pct = None
                status = None

                if has_previous:
                    if prev:
                        prev_shares = prev['shares']
                        prev_value = prev['value']
                        share_change = holding['shares'] - prev_shares
                        share_change_pct = (share_change / prev_shares * 100) if prev_shares > 0 else None
                        h_value_change = holding['value'] - prev_value
                        h_value_change_pct = (h_value_change / prev_value * 100) if prev_value > 0 else None

                        if share_change > 0:
                            status = 'increased'
                            num_increased += 1
                        elif share_change < 0:
                            status = 'decreased'
                            num_decreased += 1
                        else:
                            status = 'unchanged'

                        # Turnover
                        current_price = (holding['value'] / holding['shares']) if holding['shares'] > 0 else 0
                        turnover_value += abs(share_change * current_price)
                    else:
                        status = 'new'
                        num_new += 1

                stock_holdings.append(HoldingData(
                    symbol=symbol,
                    name=holding['name'],
                    cusip=cusip,
                    value=holding['value'],
                    shares=holding['shares'],
                    weight=round(weight, 2),
                    share_type=holding['share_type'],
                    prev_shares=prev_shares,
                    prev_value=prev_value,
                    share_change=share_change,
                    share_change_pct=round(share_change_pct, 2) if share_change_pct is not None else None,
                    value_change=h_value_change,
                    value_change_pct=round(h_value_change_pct, 2) if h_value_change_pct is not None else None,
                    status=status
                ))

            # Build sold_positions list from previous holdings not matched
            sold_positions = []
            if has_previous:
                for h in previous_holdings_raw:
                    if h.get('share_type') != 'SH':
                        continue
                    cusip = h.get('cusip', '')
                    symbol = h.get('symbol', '') or cusip[:6]
                    if cusip and cusip in matched_prev_cusips:
                        continue
                    if symbol and symbol in matched_prev_symbols:
                        continue
                    # Check if this CUSIP/symbol exists in current holdings at all
                    in_current = any(
                        (cusip and ch.get('cusip') == cusip) or (symbol and ch.get('symbol') == symbol)
                        for ch in current_holdings_raw if ch.get('share_type') == 'SH'
                    )
                    if not in_current:
                        sold_positions.append(HoldingData(
                            symbol=symbol,
                            name=h['name'],
                            cusip=cusip,
                            value=h['value'],
                            shares=h['shares'],
                            weight=0.0,
                            share_type=h.get('share_type', 'SH'),
                            prev_shares=h['shares'],
                            prev_value=h['value'],
                            share_change=-h['shares'],
                            share_change_pct=-100.0,
                            value_change=-h['value'],
                            value_change_pct=-100.0,
                            status='sold'
                        ))

            num_sold = len(sold_positions)

            # Portfolio-level value change
            portfolio_value_change = total_value - prev_total_value if has_previous else 0
            portfolio_value_change_pct = (
                (portfolio_value_change / prev_total_value * 100) if prev_total_value > 0 else 0
            ) if has_previous else 0

            turnover_pct = (turnover_value / total_value * 100) if total_value > 0 else 0.0

            all_current_sh = len([h for h in current_holdings_raw if h.get('share_type') == 'SH'])

            portfolio = InstitutionalHoldingsData(
                id=f"13f_{query.institution_key}",
                institution_key=query.institution_key,
                name=inst_info['name'],
                manager=inst_info['manager'],
                description=f"13F Holdings - {inst_info['name']}",
                category='13f',
                source='SEC EDGAR',
                filing_date=filing_date or '2024-12-31',
                period_end=filing_date or '2024-12-31',
                total_value=total_value,
                num_holdings=all_current_sh,
                stocks=stock_holdings,
                sold_positions=sold_positions,
                previous_filing_date=previous_filing_date,
                previous_value=prev_total_value if has_previous else None,
                value_change=portfolio_value_change if has_previous else None,
                value_change_pct=round(portfolio_value_change_pct, 2) if has_previous else None,
                num_new_positions=num_new,
                num_sold_out=num_sold,
                num_increased=num_increased,
                num_decreased=num_decreased,
                turnover=round(turnover_pct, 2)
            )

            log.info(f"Transformed {len(stock_holdings)} holdings for {inst_info['name']} "
                     f"(new={num_new}, sold={num_sold}, up={num_increased}, down={num_decreased})")

            return [portfolio]

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

        Args:3
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
