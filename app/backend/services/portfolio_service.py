"""Portfolio Service — 기관 13F 보유 데이터 조회."""
import logging
from typing import Dict, Any, List

from data_fetcher.query_executor import QueryExecutor

log = logging.getLogger(__name__)


class PortfolioService:

    async def get_institutions_list(
        self,
        use_dynamic: bool = True,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        try:
            results = await QueryExecutor.fetch(
                'whalewisdom', 'institutions_list',
                {'use_dynamic': use_dynamic, 'limit': limit},
            )
            return [
                {
                    'key':         inst.key,
                    'name':        inst.name,
                    'manager':     inst.manager,
                    'cik':         inst.cik,
                    'description': inst.description,
                }
                for inst in (results or [])
            ]
        except Exception as e:
            log.error(f"Error fetching institutions list: {e}")
            raise

    async def get_institution_portfolio(
        self,
        institution_key: str,
        limit: int = 50,
        summary_only: bool = False,
    ) -> Dict[str, Any]:
        try:
            results = await QueryExecutor.fetch(
                'whalewisdom', 'institutional_holdings',
                {'institution_key': institution_key, 'limit': limit, 'summary_only': summary_only},
            )

            if not results:
                raise ValueError(f"Holdings not found for institution: {institution_key}")

            portfolio = results[0]

            def _serialize(stock):
                d = {
                    'symbol': stock.symbol,
                    'name':   stock.name,
                    'cusip':  stock.cusip,
                    'value':  stock.value,
                    'shares': stock.shares,
                    'weight': stock.weight,
                }
                for field in ('prev_shares', 'prev_value', 'share_change',
                              'share_change_pct', 'value_change', 'value_change_pct', 'status'):
                    val = getattr(stock, field, None)
                    if val is not None:
                        d[field] = val
                return d

            holding = {
                'id':                    portfolio.id,
                'institution_key':       portfolio.institution_key,
                'manager':               portfolio.manager,
                'name':                  portfolio.name,
                'description':           portfolio.description,
                'total_value':           portfolio.total_value,
                'num_holdings':          portfolio.num_holdings,
                'filing_date':           portfolio.filing_date,
                'period_end':            portfolio.period_end,
                'category':              portfolio.category,
                'previous_filing_date':  portfolio.previous_filing_date,
                'previous_value':        portfolio.previous_value,
                'value_change':          portfolio.value_change,
                'value_change_pct':      portfolio.value_change_pct,
                'num_new_positions':     portfolio.num_new_positions,
                'num_sold_out':          portfolio.num_sold_out,
                'num_increased':         portfolio.num_increased,
                'num_decreased':         portfolio.num_decreased,
                'turnover':              portfolio.turnover,
                'stocks':                [_serialize(s) for s in portfolio.stocks],
                'sold_positions':        [_serialize(s) for s in portfolio.sold_positions],
            }

            if getattr(portfolio, 'performance', None):
                holding['performance'] = portfolio.performance
            if getattr(portfolio, 'top_sectors', None):
                holding['top_sectors'] = portfolio.top_sectors

            return holding

        except ValueError:
            raise
        except Exception as e:
            log.error(f"Error fetching portfolio for {institution_key}: {e}")
            raise


portfolio_service = PortfolioService()
