"""Portfolio Service — 기관 13F 보유 데이터 조회."""
import logging
from typing import Dict, Any, List

from data_fetcher.query_executor import QueryExecutor

log = logging.getLogger(__name__)


class PortfolioService:

    async def _fetch_cached(self, model: str, params: Dict[str, Any]):
        """db(배치 적재) 전용 조회. 13F 원본 파싱은 서버에서 하지 않는다.

        과거엔 캐시 미스 시 whalewisdom으로 온디맨드 스크래핑했으나, 동기 blocking
        fetch가 (a)백엔드 이벤트루프를 막고 (b)작은 운영 인스턴스에서 메모리 폭증→OOM으로
        앱을 죽였다. 이제 로컬 배치(Institutional13FCollector)가 파싱·산출해 적재한 데이터만
        읽고, 미적재 기관은 빈 결과 → 호출부가 에러로 승격해 프론트가 표시한다.
        """
        return await QueryExecutor.fetch('db', model, params)

    async def get_institutions_list(
        self,
        use_dynamic: bool = True,
        limit: int = 1000,
        loaded_only: bool = True,
        with_performance: bool = False,
    ) -> List[Dict[str, Any]]:
        try:
            results = await self._fetch_cached(
                'institutions_list',
                {'use_dynamic': use_dynamic, 'limit': limit, 'loaded_only': loaded_only,
                 'with_performance': with_performance},
            )
            return [
                {
                    'key':         inst.key,
                    'name':        inst.name,
                    'manager':     inst.manager,
                    'cik':         getattr(inst, 'cik', None),
                    'description': getattr(inst, 'description', None),
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
            results = await self._fetch_cached(
                'institutional_holdings',
                {'institution_key': institution_key, 'limit': limit, 'summary_only': summary_only},
            )

            if not results:
                raise ValueError(
                    f"'{institution_key}' 13F 데이터가 캐시에 없습니다(배치 미적재). "
                    f"서버 온디맨드 폴백은 비활성화돼 있습니다."
                )

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

    async def get_fund_performance(
        self,
        institution_key: str,
        quarters: int = 8,
    ) -> List[Dict[str, Any]]:
        """13F 보유종목 기반 분기별 추정 수익률.

        실제 NAV 수익률이 아니라 공시 스냅샷 비교로 얻은 근사치다(한계는
        standard_models/fund_performance.py 참고). 13F 원본을 여러 분기 파싱해야 해서
        로컬 배치가 산출·적재한 결과(db)만 읽는다.
        """
        try:
            results = await self._fetch_cached(
                'fund_performance',
                {'institution_key': institution_key, 'quarters': quarters},
            )

            if not results:
                raise ValueError(
                    f"'{institution_key}' 추정 수익률이 적재돼 있지 않습니다"
                    f"(배치 미적재 또는 13F 제출 2개 분기 미만)."
                )

            return [
                r.model_dump() if hasattr(r, 'model_dump') else dict(r)
                for r in results
            ]

        except ValueError:
            raise
        except Exception as e:
            log.error(f"Error fetching fund performance for {institution_key}: {e}")
            raise


portfolio_service = PortfolioService()
