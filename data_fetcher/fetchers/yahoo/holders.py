"""Yahoo Finance Holders Fetcher"""
import logging
from typing import Any, Dict, List, Optional
import yfinance as yf

from data_fetcher.fetchers.base import AnnotatedResult, Fetcher
from data_fetcher.models.yahoo.holders import (
    YFinanceHoldersQueryParams,
    YFinanceInstitutionalHolderData,
)

log = logging.getLogger(__name__)


class YFinanceHoldersFetcher(Fetcher[YFinanceHoldersQueryParams, YFinanceInstitutionalHolderData]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> YFinanceHoldersQueryParams:
        return YFinanceHoldersQueryParams(**params)

    @staticmethod
    def extract_data(
        query: YFinanceHoldersQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        ticker = yf.Ticker(query.symbol)
        return {
            'institutional': ticker.institutional_holders,
            'major': ticker.major_holders,
            'info': ticker.info,
        }

    @staticmethod
    def transform_data(
        query: YFinanceHoldersQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> "AnnotatedResult[List[YFinanceInstitutionalHolderData]]":
        institutional_df = data.get('institutional')
        major_df = data.get('major')
        info = data.get('info') or {}

        institutions: List[YFinanceInstitutionalHolderData] = []
        if institutional_df is not None and not institutional_df.empty:
            for _, row in institutional_df.iterrows():
                date_rep = row.get('Date Reported')
                institutions.append(YFinanceInstitutionalHolderData(
                    name=row.get('Holder', ''),
                    shares=int(row.get('Shares', 0)) if row.get('Shares') else 0,
                    value=float(row.get('Value', 0)) if row.get('Value') else 0.0,
                    pct_held=float(row.get('pctHeld', row.get('% Out', 0)) or 0),
                    pct_change=float(row.get('pctChange', 0) or 0),
                    date_reported=date_rep.strftime('%Y-%m-%d') if date_rep is not None else None,
                ))

        summary_raw: Dict[str, Any] = {}
        if major_df is not None and not major_df.empty:
            for idx, row in major_df.iterrows():
                value = row.iloc[0] if len(row) > 0 else None
                if isinstance(value, str) and '%' in value:
                    value = float(value.replace('%', ''))
                summary_raw[idx] = value

        metadata = {
            'institutional_pct':       summary_raw.get('% of Shares Held by Institutions', 0),
            'insider_pct':             summary_raw.get('% of Shares Held by Insiders', 0),
            'institutional_float_pct': summary_raw.get('% of Float Held by Institutions', 0),
            'shares_outstanding':      info.get('sharesOutstanding', 0),
            'float_shares':            info.get('floatShares', 0),
            'short_interest':          (info.get('shortPercentOfFloat', 0) or 0) * 100,
            'short_ratio':             info.get('shortRatio', 0),
        }
        return AnnotatedResult(result=institutions, metadata=metadata)
