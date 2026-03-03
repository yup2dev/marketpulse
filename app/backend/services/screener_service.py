"""
종목 스크리너 서비스
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Dict, Any, Optional
from decimal import Decimal
from datetime import datetime, date
import uuid
import json

from index_analyzer.models.orm import (
    MBS_IN_STBD_MST,
    MBS_IN_STK_STBD,
    MBS_IN_FINANCIAL_METRICS,
    SavedScreener,
    User
)


class ScreenerService:
    """종목 스크리너 비즈니스 로직"""

    # 사전 정의된 스크리너 프리셋
    PRESETS = {
        "value_stocks": {
            "name": "가치주 (Value Stocks)",
            "description": "저평가된 우량주를 찾습니다 (낮은 P/E, P/B, 높은 ROE)",
            "filters": {
                "pe_ratio_min": 5,
                "pe_ratio_max": 15,
                "pb_ratio_max": 2.0,
                "roe_min": 10,
                "market_cap_min": 1000000000,
            }
        },
        "growth_stocks": {
            "name": "성장주 (Growth Stocks)",
            "description": "빠르게 성장하는 기업을 찾습니다",
            "filters": {
                "roe_min": 15,
                "roa_min": 10,
                "market_cap_min": 500000000,
            }
        },
        "dividend_aristocrats": {
            "name": "배당 귀족 (Dividend Aristocrats)",
            "description": "안정적인 배당을 지급하는 우량주",
            "filters": {
                "market_cap_min": 3000000000,
                "debt_to_equity_max": 1.0,
                "roe_min": 10,
            }
        },
        "small_cap_growth": {
            "name": "소형 성장주 (Small Cap Growth)",
            "description": "작지만 빠르게 성장하는 기업",
            "filters": {
                "market_cap_min": 300000000,
                "market_cap_max": 2000000000,
                "roe_min": 15,
            }
        },
        "undervalued_large_cap": {
            "name": "저평가 대형주 (Undervalued Large Cap)",
            "description": "저평가된 대형 우량주",
            "filters": {
                "market_cap_min": 10000000000,
                "pe_ratio_max": 20,
                "pb_ratio_max": 3.0,
                "roe_min": 12,
            }
        }
    }

    @staticmethod
    def screen_stocks(
        db: Session,
        filters: Dict[str, Any],
        limit: int = 100
    ) -> List[Dict]:
        """
        조건에 맞는 종목 스크리닝

        filters 예시:
        {
            "sector": ["Technology", "Healthcare"],
            "market_cap_min": 1000000000,
            "market_cap_max": 100000000000,
            "pe_ratio_min": 5,
            "pe_ratio_max": 30,
            "price_min": 10,
            "price_max": 500,
            "change_rate_min": -5,
            "change_rate_max": 10
        }
        """
        # 기본 쿼리: 최신 재무 데이터와 가격 데이터 조인
        latest_date = db.query(MBS_IN_STK_STBD.base_ymd).order_by(
            MBS_IN_STK_STBD.base_ymd.desc()
        ).first()

        if not latest_date:
            return []

        latest_date = latest_date[0]

        # 가격 데이터 조회
        query = db.query(
            MBS_IN_STK_STBD,
            MBS_IN_FINANCIAL_METRICS
        ).outerjoin(
            MBS_IN_FINANCIAL_METRICS,
            and_(
                MBS_IN_STK_STBD.stk_cd == MBS_IN_FINANCIAL_METRICS.stk_cd,
                MBS_IN_FINANCIAL_METRICS.base_ymd == latest_date
            )
        ).filter(
            MBS_IN_STK_STBD.base_ymd == latest_date
        )

        # 필터 적용
        if "sector" in filters and filters["sector"]:
            query = query.filter(MBS_IN_STK_STBD.sector.in_(filters["sector"]))

        if "market_cap_min" in filters:
            query = query.filter(
                MBS_IN_FINANCIAL_METRICS.market_cap >= filters["market_cap_min"]
            )

        if "market_cap_max" in filters:
            query = query.filter(
                MBS_IN_FINANCIAL_METRICS.market_cap <= filters["market_cap_max"]
            )

        if "pe_ratio_min" in filters:
            query = query.filter(
                MBS_IN_FINANCIAL_METRICS.pe_ratio >= filters["pe_ratio_min"]
            )

        if "pe_ratio_max" in filters:
            query = query.filter(
                MBS_IN_FINANCIAL_METRICS.pe_ratio <= filters["pe_ratio_max"]
            )

        if "price_min" in filters:
            query = query.filter(
                MBS_IN_STK_STBD.close_price >= filters["price_min"]
            )

        if "price_max" in filters:
            query = query.filter(
                MBS_IN_STK_STBD.close_price <= filters["price_max"]
            )

        if "change_rate_min" in filters:
            query = query.filter(
                MBS_IN_STK_STBD.change_rate >= filters["change_rate_min"]
            )

        if "change_rate_max" in filters:
            query = query.filter(
                MBS_IN_STK_STBD.change_rate <= filters["change_rate_max"]
            )

        # ROE 필터
        if "roe_min" in filters:
            query = query.filter(
                MBS_IN_FINANCIAL_METRICS.roe >= filters["roe_min"]
            )

        # 부채비율 필터
        if "debt_to_equity_max" in filters:
            query = query.filter(
                MBS_IN_FINANCIAL_METRICS.debt_to_equity <= filters["debt_to_equity_max"]
            )

        # 결과 제한 및 조회
        results = query.limit(limit).all()

        # 결과 포맷팅
        screened_stocks = []
        for stock, financial in results:
            stock_data = stock.to_dict()
            if financial:
                stock_data.update({
                    "market_cap": float(financial.market_cap) if financial.market_cap else None,
                    "pe_ratio": float(financial.pe_ratio) if financial.pe_ratio else None,
                    "pb_ratio": float(financial.pb_ratio) if financial.pb_ratio else None,
                    "roe": float(financial.roe) if financial.roe else None,
                    "roa": float(financial.roa) if financial.roa else None,
                    "debt_to_equity": float(financial.debt_to_equity) if financial.debt_to_equity else None,
                })
            screened_stocks.append(stock_data)

        return screened_stocks

    @staticmethod
    def save_screener(
        db: Session,
        user_id: str,
        name: str,
        filters: Dict[str, Any],
        description: Optional[str] = None,
        run_frequency: str = "manual"
    ) -> SavedScreener:
        """
        스크리너 조건 저장
        """
        screener = SavedScreener(
            screener_id=f"scrn_{uuid.uuid4().hex[:16]}",
            user_id=user_id,
            name=name,
            description=description,
            filters=json.dumps(filters),
            is_active=True,
            run_frequency=run_frequency
        )

        db.add(screener)
        db.commit()
        db.refresh(screener)

        return screener

    @staticmethod
    def get_user_screeners(db: Session, user_id: str) -> List[SavedScreener]:
        """
        사용자의 저장된 스크리너 조회
        """
        return db.query(SavedScreener).filter(
            SavedScreener.user_id == user_id
        ).all()

    @staticmethod
    def run_saved_screener(
        db: Session,
        screener_id: str,
        user_id: str,
        limit: int = 100
    ) -> Dict:
        """
        저장된 스크리너 실행
        """
        screener = db.query(SavedScreener).filter(
            SavedScreener.screener_id == screener_id,
            SavedScreener.user_id == user_id
        ).first()

        if not screener:
            return None

        # 스크리너 실행
        filters = json.loads(screener.filters)
        results = ScreenerService.screen_stocks(db, filters, limit)

        # 마지막 실행 시간 업데이트
        screener.last_run = datetime.utcnow()
        db.commit()

        return {
            "screener": screener.to_dict(),
            "results": results,
            "count": len(results)
        }

    @staticmethod
    def delete_screener(db: Session, screener_id: str, user_id: str) -> bool:
        """
        저장된 스크리너 삭제
        """
        screener = db.query(SavedScreener).filter(
            SavedScreener.screener_id == screener_id,
            SavedScreener.user_id == user_id
        ).first()

        if not screener:
            return False

        db.delete(screener)
        db.commit()

        return True

    @staticmethod
    def get_available_sectors(db: Session) -> List[str]:
        """
        사용 가능한 섹터 목록 조회
        """
        sectors = db.query(MBS_IN_STBD_MST.sector).filter(
            MBS_IN_STBD_MST.sector.isnot(None),
            MBS_IN_STBD_MST.is_active == True
        ).distinct().all()

        return [s[0] for s in sectors if s[0]]

    @staticmethod
    def get_presets() -> List[dict]:
        """
        사전 정의된 스크리너 프리셋 목록 조회

        Returns:
            프리셋 목록
        """
        return [
            {
                "preset_id": preset_id,
                "name": preset["name"],
                "description": preset["description"],
                "filters": preset["filters"]
            }
            for preset_id, preset in ScreenerService.PRESETS.items()
        ]

    @staticmethod
    def get_preset_by_id(preset_id: str) -> Optional[dict]:
        """
        특정 프리셋 조회

        Args:
            preset_id: 프리셋 ID

        Returns:
            프리셋 정보 또는 None
        """
        preset = ScreenerService.PRESETS.get(preset_id)
        if not preset:
            return None

        return {
            "preset_id": preset_id,
            "name": preset["name"],
            "description": preset["description"],
            "filters": preset["filters"]
        }
