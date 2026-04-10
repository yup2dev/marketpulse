"""Yahoo Finance Management Fetcher"""
import logging
from typing import Any, Dict, List, Optional
import yfinance as yf

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.yahoo.management import (
    YFinanceManagementQueryParams,
    YFinanceManagementData,
    YFinanceOfficerData,
)

log = logging.getLogger(__name__)


class YFinanceManagementFetcher(Fetcher[YFinanceManagementQueryParams, YFinanceManagementData]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> YFinanceManagementQueryParams:
        return YFinanceManagementQueryParams(**params)

    @staticmethod
    def extract_data(
        query: YFinanceManagementQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        ticker = yf.Ticker(query.symbol)
        return ticker.info

    @staticmethod
    def transform_data(
        query: YFinanceManagementQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> List[YFinanceManagementData]:
        info = data or {}
        officers = [
            YFinanceOfficerData(
                name=o.get('name', ''),
                title=o.get('title', ''),
                age=o.get('age'),
                total_pay=o.get('totalPay'),
                year_born=o.get('yearBorn'),
            )
            for o in info.get('companyOfficers', [])
        ]
        governance = {
            'audit_risk': info.get('auditRisk'),
            'board_risk': info.get('boardRisk'),
            'compensation_risk': info.get('compensationRisk'),
            'shareholder_rights_risk': info.get('shareHolderRightsRisk'),
            'overall_risk': info.get('overallRisk'),
        }
        return [YFinanceManagementData(
            symbol=query.symbol,
            officers=officers,
            governance=governance,
        )]
