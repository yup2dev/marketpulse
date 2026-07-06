"""Yahoo Finance Insider Trading Models"""
from data_fetcher.abstract_provider.standard_models import InsiderTradingQueryParams, InsiderTradingData
from data_fetcher.abstract_provider.standard_models.insider_holders import (
    InsiderHoldersQueryParams,
    InsiderHolderData,
)
from data_fetcher.abstract_provider.standard_models.insider_trading_summary import (
    InsiderTradingSummaryQueryParams,
    InsiderTradingSummaryData,
)


class YFinanceInsiderTradingQueryParams(InsiderTradingQueryParams):
    pass


class YFinanceInsiderTransactionData(InsiderTradingData):
    pass


class YFinanceInsiderHolderData(InsiderHolderData):
    """내부자 보유 정보 (standard InsiderHolder 경유)"""


class YFinanceInsiderTradingSummaryData(InsiderTradingSummaryData):
    """내부자 거래 집계 데이터 (standard InsiderTradingSummary 경유)"""
    source: str = 'yahoo'


"""Yahoo Finance Insider Trading Fetcher"""
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
import yfinance as yf
import pandas as pd

from data_fetcher.abstract_provider.abstract.fetcher import AnnotatedResult
from data_fetcher.abstract_provider.abstract.base_fetchers import YFinanceFetcher

log = logging.getLogger(__name__)


class YFinanceInsiderTradingFetcher(YFinanceFetcher[YFinanceInsiderTradingQueryParams, YFinanceInsiderTransactionData]):
    """Yahoo Finance 내부자 거래 Fetcher"""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> YFinanceInsiderTradingQueryParams:
        """쿼리 파라미터 변환"""
        return YFinanceInsiderTradingQueryParams(**params)

    @staticmethod
    def extract_data(
        query: YFinanceInsiderTradingQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Yahoo Finance에서 내부자 거래 데이터 추출

        Args:
            query: 쿼리 파라미터
            credentials: 사용 안함

        Returns:
            내부자 거래 데이터
        """
        try:
            ticker = yf.Ticker(query.symbol)

            # 내부자 거래 내역
            insider_transactions = ticker.insider_transactions

            # 내부자 매수 정보
            insider_purchases = ticker.insider_purchases

            # 내부자 보유 현황
            insider_roster = ticker.insider_roster_holders

            return {
                'transactions': insider_transactions,
                'purchases': insider_purchases,
                'roster': insider_roster,
                'symbol': query.symbol
            }

        except Exception as e:
            log.error(f"Error fetching insider trading for {query.symbol}: {e}")
            raise

    @staticmethod
    def transform_data(
        query: YFinanceInsiderTradingQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[YFinanceInsiderTransactionData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 내부자 거래 데이터

        Returns:
            YFinanceInsiderTransactionData 리스트
        """
        transactions_df = data.get('transactions')
        symbol = data['symbol']

        result = []

        if transactions_df is None or transactions_df.empty:
            log.info(f"No insider transaction data for {symbol}")
            return result

        for _, row in transactions_df.iterrows():
            try:
                # 거래 날짜 파싱
                tx_date = None
                if 'Start Date' in row and pd.notna(row['Start Date']):
                    tx_date = row['Start Date']
                    if isinstance(tx_date, pd.Timestamp):
                        tx_date = tx_date.date()

                # 거래 유형 파싱 - 'Text' 컬럼에서 추출 (예: "Sale at price 271.23 per share.")
                tx_text = row.get('Text', '')
                tx_type = None
                if tx_text:
                    tx_text_lower = str(tx_text).lower()
                    if 'sale' in tx_text_lower:
                        tx_type = 'Sale'
                    elif 'purchase' in tx_text_lower or 'buy' in tx_text_lower:
                        tx_type = 'Purchase'
                    elif 'gift' in tx_text_lower:
                        tx_type = 'Gift'
                    elif 'option' in tx_text_lower:
                        tx_type = 'Option Exercise'
                    else:
                        tx_type = str(tx_text)[:50]  # Truncate if unknown

                # 주식 수량
                shares = None
                if 'Shares' in row and pd.notna(row['Shares']):
                    shares = int(row['Shares'])

                # 가격
                price = None
                if 'Value' in row and 'Shares' in row and pd.notna(row['Value']) and pd.notna(row['Shares']):
                    if row['Shares'] != 0:
                        price = float(row['Value']) / float(row['Shares'])

                # 총 가치
                value = None
                if 'Value' in row and pd.notna(row['Value']):
                    value = float(row['Value'])

                # 내부자 정보
                insider_name = row.get('Insider', row.get('Name', ''))
                insider_title = row.get('Position', row.get('Title', ''))

                # 소유 유형
                ownership = row.get('Ownership', '')

                transaction = YFinanceInsiderTransactionData(
                    symbol=symbol,
                    insider_name=str(insider_name) if insider_name else None,
                    insider_title=str(insider_title) if insider_title else None,
                    transaction_date=tx_date,
                    transaction_type=str(tx_type) if tx_type else None,
                    ownership_type=str(ownership) if ownership else None,
                    shares_traded=shares,
                    price_per_share=price,
                    transaction_value=value,
                    shares_owned_after=None
                )

                result.append(transaction)

            except Exception as e:
                log.warning(f"Error parsing insider transaction: {e}")
                continue

        log.info(f"Fetched {len(result)} insider transactions for {symbol}")
        return result


class YFinanceInsiderHoldersFetcher(YFinanceFetcher[YFinanceInsiderTradingQueryParams, YFinanceInsiderHolderData]):
    """Yahoo Finance 내부자 보유 현황 Fetcher"""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> YFinanceInsiderTradingQueryParams:
        """쿼리 파라미터 변환"""
        return YFinanceInsiderTradingQueryParams(**params)

    @staticmethod
    def extract_data(
        query: YFinanceInsiderTradingQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """Yahoo Finance에서 내부자 보유 현황 추출"""
        try:
            ticker = yf.Ticker(query.symbol)
            insider_roster = ticker.insider_roster_holders

            return {
                'roster': insider_roster,
                'symbol': query.symbol
            }

        except Exception as e:
            log.error(f"Error fetching insider holders for {query.symbol}: {e}")
            raise

    @staticmethod
    def transform_data(
        query: YFinanceInsiderTradingQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[YFinanceInsiderHolderData]:
        """원시 데이터를 표준 모델로 변환"""
        roster_df = data.get('roster')
        symbol = data['symbol']

        result = []

        if roster_df is None or roster_df.empty:
            log.info(f"No insider roster data for {symbol}")
            return result

        for _, row in roster_df.iterrows():
            try:
                # 최근 거래 날짜 - 'Latest Transaction Date' 컬럼
                latest_date = None
                date_col = 'Latest Transaction Date'
                if date_col in row.index and pd.notna(row[date_col]):
                    latest_date = row[date_col]
                    if isinstance(latest_date, pd.Timestamp):
                        latest_date = latest_date.date()
                    elif isinstance(latest_date, str):
                        try:
                            latest_date = datetime.strptime(latest_date, '%Y-%m-%d').date()
                        except:
                            pass

                # 보유 주식 수 - 'Shares Owned Directly' 컬럼
                shares = None
                shares_col = 'Shares Owned Directly'
                if shares_col in row.index and pd.notna(row[shares_col]):
                    shares = int(row[shares_col])

                holder = YFinanceInsiderHolderData(
                    symbol=symbol,
                    name=str(row.get('Name', '')) if pd.notna(row.get('Name')) else None,
                    position=str(row.get('Position', '')) if pd.notna(row.get('Position')) else None,
                    shares=shares,
                    value=None,  # Value not provided in roster data
                    latest_transaction_date=latest_date,
                    position_direct=shares,  # Same as shares
                    position_indirect=None  # Not provided in current yfinance data
                )

                result.append(holder)

            except Exception as e:
                log.warning(f"Error parsing insider holder: {e}")
                continue

        log.info(f"Fetched {len(result)} insider holders for {symbol}")
        return result


class YFinanceInsiderTradingSummaryFetcher(YFinanceFetcher[YFinanceInsiderTradingQueryParams, YFinanceInsiderTransactionData]):
    """내부자 거래 집계 Fetcher (transactions + buy/sell summary)"""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> YFinanceInsiderTradingQueryParams:
        return YFinanceInsiderTradingQueryParams(**params)

    @staticmethod
    def extract_data(
        query: YFinanceInsiderTradingQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        try:
            ticker = yf.Ticker(query.symbol)
            return {'transactions': ticker.insider_transactions, 'symbol': query.symbol}
        except Exception as e:
            log.error(f"Error fetching insider trading for {query.symbol}: {e}")
            raise

    @staticmethod
    def transform_data(
        query: YFinanceInsiderTradingQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> List[YFinanceInsiderTradingSummaryData]:
        symbol = data['symbol']
        transactions_df = data.get('transactions')
        limit = query.limit if hasattr(query, 'limit') else kwargs.get('limit', 50)

        transactions = []
        buy_count = buy_value = sell_count = sell_value = 0

        if transactions_df is not None and not transactions_df.empty:
            for _, row in transactions_df.iterrows():
                try:
                    tx_date = None
                    if 'Start Date' in row and pd.notna(row['Start Date']):
                        tx_date = row['Start Date']
                        if isinstance(tx_date, pd.Timestamp):
                            tx_date = tx_date.date().isoformat()
                        else:
                            tx_date = str(tx_date)[:10]

                    tx_text = str(row.get('Text', '') or '')
                    tx_text_lower = tx_text.lower()
                    if 'sale' in tx_text_lower:
                        tx_type = 'Sale'
                    elif 'purchase' in tx_text_lower or 'buy' in tx_text_lower:
                        tx_type = 'Purchase'
                    elif 'gift' in tx_text_lower:
                        tx_type = 'Gift'
                    elif 'option' in tx_text_lower:
                        tx_type = 'Option Exercise'
                    else:
                        tx_type = tx_text[:50] if tx_text else None

                    shares = int(row['Shares']) if 'Shares' in row and pd.notna(row.get('Shares')) else None
                    value = float(row['Value']) if 'Value' in row and pd.notna(row.get('Value')) else None
                    price = (value / shares) if (value and shares and shares != 0) else None

                    tx_type_lower = (tx_type or '').lower()
                    is_buy = 'purchase' in tx_type_lower or 'buy' in tx_type_lower
                    is_sell = 'sale' in tx_type_lower or 'sell' in tx_type_lower

                    if is_buy:
                        buy_count += 1
                        buy_value += value or 0
                        acq_disp = 'A'
                    elif is_sell:
                        sell_count += 1
                        sell_value += value or 0
                        acq_disp = 'D'
                    else:
                        acq_disp = None

                    transactions.append({
                        'transaction_date': tx_date,
                        'filing_date': None,
                        'insider_name': str(row.get('Insider', row.get('Name', ''))) or None,
                        'insider_title': str(row.get('Position', row.get('Title', ''))) or None,
                        'is_director': None,
                        'is_officer': None,
                        'transaction_type': tx_type,
                        'acquisition_or_disposition': acq_disp,
                        'shares_traded': shares,
                        'price_per_share': price,
                        'transaction_value': value,
                        'shares_owned_after': None,
                    })
                except Exception as ex:
                    log.warning(f"Error parsing insider transaction row: {ex}")
                    continue

        # 각 거래를 YFinanceInsiderTransactionData로 변환
        result = []
        for tx in transactions[:limit]:
            try:
                result.append(YFinanceInsiderTransactionData(
                    symbol=symbol,
                    insider_name=tx.get('insider_name'),
                    insider_title=tx.get('insider_title'),
                    transaction_date=tx.get('transaction_date'),
                    transaction_type=tx.get('transaction_type'),
                    ownership_type=tx.get('acquisition_or_disposition'),
                    shares_traded=tx.get('shares_traded'),
                    price_per_share=tx.get('price_per_share'),
                    transaction_value=tx.get('transaction_value'),
                    shares_owned_after=tx.get('shares_owned_after'),
                ))
            except Exception as ex:
                log.warning(f"Error converting transaction: {ex}")

        return AnnotatedResult(
            result=result,
            metadata={
                'buy_count':  buy_count,
                'sell_count': sell_count,
                'buy_value':  buy_value,
                'sell_value': sell_value,
                'net_value':  buy_value - sell_value,
            },
        )
