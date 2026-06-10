"""Yahoo Finance Management Model"""
from typing import Optional, List, Dict, Any
from pydantic import Field
from data_fetcher.abstract_provider.abstract import BaseQueryParams, BaseData


class YFinanceManagementQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드")


class YFinanceOfficerData(BaseData):
    """임원 정보"""
    name: str = Field(default="")
    title: str = Field(default="")
    age: Optional[int] = None
    total_pay: Optional[int] = None
    year_born: Optional[int] = None

    __alias_dict__ = {
        "total_pay": "totalPay",
        "year_born": "yearBorn",
    }


class YFinanceManagementData(BaseData):
    """경영진 및 거버넌스 데이터"""
    symbol: str
    officers: List[YFinanceOfficerData] = Field(default_factory=list)
    governance: Dict[str, Any] = Field(default_factory=dict)


"""Yahoo Finance Management Fetcher"""
import logging
from typing import Any, Dict, List, Optional
import yfinance as yf

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher

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
            YFinanceOfficerData.model_validate(o)
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
