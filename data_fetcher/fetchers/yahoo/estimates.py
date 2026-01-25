"""Yahoo Finance Estimates Fetcher"""
import logging
from typing import Any, Dict, List, Optional
import yfinance as yf
import pandas as pd

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.yahoo.estimates import (
    EstimatesQueryParams,
    EstimatesData,
    PriceTargetData,
    EarningsEstimateData,
    RevenueEstimateData,
    GrowthEstimateData
)

log = logging.getLogger(__name__)


class YahooEstimatesFetcher(Fetcher[EstimatesQueryParams, EstimatesData]):
    """Yahoo Finance 애널리스트 추정치 Fetcher"""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> EstimatesQueryParams:
        """쿼리 파라미터 변환"""
        return EstimatesQueryParams(**params)

    @staticmethod
    def extract_data(
        query: EstimatesQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Yahoo Finance에서 애널리스트 추정치 추출

        Args:
            query: 쿼리 파라미터
            credentials: 사용 안함

        Returns:
            추정치 딕셔너리
        """
        try:
            ticker = yf.Ticker(query.symbol)

            return {
                'info': ticker.info,
                'earnings_estimate': ticker.earnings_estimate,
                'revenue_estimate': ticker.revenue_estimate,
                'growth_estimates': ticker.growth_estimates,
                'analyst_price_targets': ticker.analyst_price_targets
            }

        except Exception as e:
            log.error(f"Error fetching estimates for {query.symbol}: {e}")
            raise

    @staticmethod
    def transform_data(
        query: EstimatesQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[EstimatesData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 추정치 딕셔너리

        Returns:
            EstimatesData 리스트
        """
        try:
            info = data.get('info', {})
            earnings_est = data.get('earnings_estimate')
            revenue_est = data.get('revenue_estimate')
            growth_est = data.get('growth_estimates')
            price_targets = data.get('analyst_price_targets')

            # Price Target
            price_target_data = None
            if price_targets is not None:
                if isinstance(price_targets, dict):
                    price_target_data = PriceTargetData(
                        symbol=query.symbol,
                        current_price=price_targets.get('current'),
                        target_high=price_targets.get('high'),
                        target_low=price_targets.get('low'),
                        target_mean=price_targets.get('mean'),
                        target_median=price_targets.get('median'),
                        number_of_analysts=info.get('numberOfAnalystOpinions')
                    )
            elif info:
                price_target_data = PriceTargetData(
                    symbol=query.symbol,
                    current_price=info.get('currentPrice'),
                    target_high=info.get('targetHighPrice'),
                    target_low=info.get('targetLowPrice'),
                    target_mean=info.get('targetMeanPrice'),
                    target_median=info.get('targetMedianPrice'),
                    number_of_analysts=info.get('numberOfAnalystOpinions')
                )

            # Earnings Estimate
            earnings_estimate_list = []
            if earnings_est is not None and isinstance(earnings_est, pd.DataFrame):
                for col in earnings_est.columns:
                    try:
                        earnings_estimate_list.append(EarningsEstimateData(
                            symbol=query.symbol,
                            period=str(col),
                            avg=float(earnings_est.loc['avg', col]) if 'avg' in earnings_est.index and pd.notna(earnings_est.loc['avg', col]) else None,
                            low=float(earnings_est.loc['low', col]) if 'low' in earnings_est.index and pd.notna(earnings_est.loc['low', col]) else None,
                            high=float(earnings_est.loc['high', col]) if 'high' in earnings_est.index and pd.notna(earnings_est.loc['high', col]) else None,
                            year_ago_eps=float(earnings_est.loc['yearAgoEps', col]) if 'yearAgoEps' in earnings_est.index and pd.notna(earnings_est.loc['yearAgoEps', col]) else None,
                            number_of_analysts=int(earnings_est.loc['numberOfAnalysts', col]) if 'numberOfAnalysts' in earnings_est.index and pd.notna(earnings_est.loc['numberOfAnalysts', col]) else None,
                            growth=float(earnings_est.loc['growth', col]) if 'growth' in earnings_est.index and pd.notna(earnings_est.loc['growth', col]) else None
                        ))
                    except Exception as e:
                        log.warning(f"Error parsing earnings estimate for {col}: {e}")

            # Revenue Estimate
            revenue_estimate_list = []
            if revenue_est is not None and isinstance(revenue_est, pd.DataFrame):
                for col in revenue_est.columns:
                    try:
                        revenue_estimate_list.append(RevenueEstimateData(
                            symbol=query.symbol,
                            period=str(col),
                            avg=float(revenue_est.loc['avg', col]) if 'avg' in revenue_est.index and pd.notna(revenue_est.loc['avg', col]) else None,
                            low=float(revenue_est.loc['low', col]) if 'low' in revenue_est.index and pd.notna(revenue_est.loc['low', col]) else None,
                            high=float(revenue_est.loc['high', col]) if 'high' in revenue_est.index and pd.notna(revenue_est.loc['high', col]) else None,
                            year_ago_revenue=float(revenue_est.loc['yearAgoRevenue', col]) if 'yearAgoRevenue' in revenue_est.index and pd.notna(revenue_est.loc['yearAgoRevenue', col]) else None,
                            number_of_analysts=int(revenue_est.loc['numberOfAnalysts', col]) if 'numberOfAnalysts' in revenue_est.index and pd.notna(revenue_est.loc['numberOfAnalysts', col]) else None,
                            growth=float(revenue_est.loc['growth', col]) if 'growth' in revenue_est.index and pd.notna(revenue_est.loc['growth', col]) else None
                        ))
                    except Exception as e:
                        log.warning(f"Error parsing revenue estimate for {col}: {e}")

            # Growth Estimate
            growth_estimate_data = None
            if growth_est is not None and isinstance(growth_est, pd.DataFrame):
                try:
                    # growth_estimates의 첫번째 컬럼이 해당 종목
                    symbol_col = query.symbol if query.symbol in growth_est.columns else growth_est.columns[0] if len(growth_est.columns) > 0 else None
                    if symbol_col:
                        growth_estimate_data = GrowthEstimateData(
                            symbol=query.symbol,
                            current_quarter=float(growth_est.loc['Current Qtr.', symbol_col]) if 'Current Qtr.' in growth_est.index and pd.notna(growth_est.loc['Current Qtr.', symbol_col]) else None,
                            next_quarter=float(growth_est.loc['Next Qtr.', symbol_col]) if 'Next Qtr.' in growth_est.index and pd.notna(growth_est.loc['Next Qtr.', symbol_col]) else None,
                            current_year=float(growth_est.loc['Current Year', symbol_col]) if 'Current Year' in growth_est.index and pd.notna(growth_est.loc['Current Year', symbol_col]) else None,
                            next_year=float(growth_est.loc['Next Year', symbol_col]) if 'Next Year' in growth_est.index and pd.notna(growth_est.loc['Next Year', symbol_col]) else None,
                            next_5_years=float(growth_est.loc['Next 5 Years (per annum)', symbol_col]) if 'Next 5 Years (per annum)' in growth_est.index and pd.notna(growth_est.loc['Next 5 Years (per annum)', symbol_col]) else None,
                            past_5_years=float(growth_est.loc['Past 5 Years (per annum)', symbol_col]) if 'Past 5 Years (per annum)' in growth_est.index and pd.notna(growth_est.loc['Past 5 Years (per annum)', symbol_col]) else None
                        )
                except Exception as e:
                    log.warning(f"Error parsing growth estimates: {e}")

            estimates_data = EstimatesData(
                symbol=query.symbol,
                price_target=price_target_data,
                earnings_estimate=earnings_estimate_list if earnings_estimate_list else None,
                revenue_estimate=revenue_estimate_list if revenue_estimate_list else None,
                growth_estimate=growth_estimate_data
            )

            log.info(f"Fetched estimates for {query.symbol}")
            return [estimates_data]

        except Exception as e:
            log.error(f"Error transforming estimates: {e}")
            raise
