"""
Watchlist Service
관심종목 관리 비즈니스 로직
"""
import sys
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
import uuid

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from sqlalchemy.orm import Session
from sqlalchemy import and_
from index_analyzer.models.orm import Watchlist, WatchlistItem, MBS_IN_STBD_MST


class WatchlistService:
    """관심종목 서비스"""

    @staticmethod
    def get_user_watchlists(db: Session, user_id: str) -> List[Dict]:
        """
        사용자의 모든 관심종목 리스트 조회

        Args:
            db: Database session
            user_id: 사용자 ID

        Returns:
            관심종목 리스트 목록
        """
        watchlists = db.query(Watchlist).filter(Watchlist.user_id == user_id).all()
        return [wl.to_dict() for wl in watchlists]

    @staticmethod
    def create_watchlist(db: Session, user_id: str, name: str, description: Optional[str] = None) -> Dict:
        """
        새 관심종목 리스트 생성

        Args:
            db: Database session
            user_id: 사용자 ID
            name: 리스트 이름
            description: 설명 (선택사항)

        Returns:
            생성된 관심종목 리스트
        """
        watchlist = Watchlist(
            watchlist_id=str(uuid.uuid4()),
            user_id=user_id,
            name=name,
            description=description,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        db.add(watchlist)
        db.commit()
        db.refresh(watchlist)

        return watchlist.to_dict()

    @staticmethod
    def get_watchlist_by_id(db: Session, watchlist_id: str, user_id: str) -> Optional[Dict]:
        """
        특정 관심종목 리스트 조회 (권한 체크 포함)

        Args:
            db: Database session
            watchlist_id: 관심종목 리스트 ID
            user_id: 사용자 ID

        Returns:
            관심종목 리스트 또는 None
        """
        watchlist = db.query(Watchlist).filter(
            and_(Watchlist.watchlist_id == watchlist_id, Watchlist.user_id == user_id)
        ).first()

        return watchlist.to_dict() if watchlist else None

    @staticmethod
    def update_watchlist(
        db: Session,
        watchlist_id: str,
        user_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None
    ) -> Optional[Dict]:
        """
        관심종목 리스트 정보 수정

        Args:
            db: Database session
            watchlist_id: 관심종목 리스트 ID
            user_id: 사용자 ID
            name: 새 이름 (선택사항)
            description: 새 설명 (선택사항)

        Returns:
            수정된 관심종목 리스트 또는 None
        """
        watchlist = db.query(Watchlist).filter(
            and_(Watchlist.watchlist_id == watchlist_id, Watchlist.user_id == user_id)
        ).first()

        if not watchlist:
            return None

        if name is not None:
            watchlist.name = name
        if description is not None:
            watchlist.description = description

        watchlist.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(watchlist)

        return watchlist.to_dict()

    @staticmethod
    def delete_watchlist(db: Session, watchlist_id: str, user_id: str) -> bool:
        """
        관심종목 리스트 삭제

        Args:
            db: Database session
            watchlist_id: 관심종목 리스트 ID
            user_id: 사용자 ID

        Returns:
            성공 여부
        """
        watchlist = db.query(Watchlist).filter(
            and_(Watchlist.watchlist_id == watchlist_id, Watchlist.user_id == user_id)
        ).first()

        if not watchlist:
            return False

        db.delete(watchlist)
        db.commit()

        return True

    @staticmethod
    def get_watchlist_items(db: Session, watchlist_id: str, user_id: str) -> List[Dict]:
        """
        관심종목 리스트의 항목들 조회

        Args:
            db: Database session
            watchlist_id: 관심종목 리스트 ID
            user_id: 사용자 ID

        Returns:
            관심종목 항목 리스트 (가격 정보 포함)
        """
        # 권한 체크
        watchlist = db.query(Watchlist).filter(
            and_(Watchlist.watchlist_id == watchlist_id, Watchlist.user_id == user_id)
        ).first()

        if not watchlist:
            return []

        # 항목 조회
        items = db.query(WatchlistItem).filter(
            WatchlistItem.watchlist_id == watchlist_id
        ).order_by(WatchlistItem.sort_order).all()

        # 종목 정보 조인
        result = []
        for item in items:
            item_dict = item.to_dict()

            # 종목 기본 정보 추가
            stock_info = db.query(MBS_IN_STBD_MST).filter(
                MBS_IN_STBD_MST.ticker_cd == item.ticker_cd
            ).first()

            if stock_info:
                item_dict['ticker_name'] = stock_info.ticker_nm
                item_dict['sector'] = stock_info.sector
                item_dict['asset_type'] = stock_info.asset_type
            else:
                item_dict['ticker_name'] = item.ticker_cd
                item_dict['sector'] = None
                item_dict['asset_type'] = None

            result.append(item_dict)

        return result

    @staticmethod
    def add_ticker_to_watchlist(
        db: Session,
        watchlist_id: str,
        user_id: str,
        ticker_cd: str,
        notes: Optional[str] = None
    ) -> Optional[Dict]:
        """
        관심종목 리스트에 종목 추가

        Args:
            db: Database session
            watchlist_id: 관심종목 리스트 ID
            user_id: 사용자 ID
            ticker_cd: 종목 코드
            notes: 메모 (선택사항)

        Returns:
            추가된 항목 또는 None
        """
        # 권한 체크
        watchlist = db.query(Watchlist).filter(
            and_(Watchlist.watchlist_id == watchlist_id, Watchlist.user_id == user_id)
        ).first()

        if not watchlist:
            return None

        # 중복 체크
        existing = db.query(WatchlistItem).filter(
            and_(
                WatchlistItem.watchlist_id == watchlist_id,
                WatchlistItem.ticker_cd == ticker_cd
            )
        ).first()

        if existing:
            return None  # 이미 존재함

        # 현재 최대 sort_order 조회
        max_order = db.query(WatchlistItem).filter(
            WatchlistItem.watchlist_id == watchlist_id
        ).count()

        # 새 항목 생성
        item = WatchlistItem(
            item_id=str(uuid.uuid4()),
            watchlist_id=watchlist_id,
            ticker_cd=ticker_cd,
            sort_order=max_order,
            notes=notes,
            added_at=datetime.utcnow()
        )

        db.add(item)

        # 관심종목 리스트 업데이트 시간 갱신
        watchlist.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(item)

        return item.to_dict()

    @staticmethod
    def remove_ticker_from_watchlist(
        db: Session,
        watchlist_id: str,
        user_id: str,
        ticker_cd: str
    ) -> bool:
        """
        관심종목 리스트에서 종목 제거

        Args:
            db: Database session
            watchlist_id: 관심종목 리스트 ID
            user_id: 사용자 ID
            ticker_cd: 종목 코드

        Returns:
            성공 여부
        """
        # 권한 체크
        watchlist = db.query(Watchlist).filter(
            and_(Watchlist.watchlist_id == watchlist_id, Watchlist.user_id == user_id)
        ).first()

        if not watchlist:
            return False

        # 항목 조회 및 삭제
        item = db.query(WatchlistItem).filter(
            and_(
                WatchlistItem.watchlist_id == watchlist_id,
                WatchlistItem.ticker_cd == ticker_cd
            )
        ).first()

        if not item:
            return False

        removed_order = item.sort_order
        db.delete(item)

        # 삭제된 항목 이후의 순서 재정렬
        items_to_update = db.query(WatchlistItem).filter(
            and_(
                WatchlistItem.watchlist_id == watchlist_id,
                WatchlistItem.sort_order > removed_order
            )
        ).all()

        for item in items_to_update:
            item.sort_order -= 1

        # 관심종목 리스트 업데이트 시간 갱신
        watchlist.updated_at = datetime.utcnow()

        db.commit()

        return True

    @staticmethod
    def reorder_watchlist_items(
        db: Session,
        watchlist_id: str,
        user_id: str,
        ticker_orders: List[Dict[str, int]]
    ) -> bool:
        """
        관심종목 항목 순서 변경

        Args:
            db: Database session
            watchlist_id: 관심종목 리스트 ID
            user_id: 사용자 ID
            ticker_orders: [{"ticker_cd": "AAPL", "sort_order": 0}, ...]

        Returns:
            성공 여부
        """
        # 권한 체크
        watchlist = db.query(Watchlist).filter(
            and_(Watchlist.watchlist_id == watchlist_id, Watchlist.user_id == user_id)
        ).first()

        if not watchlist:
            return False

        # 순서 업데이트
        for order_info in ticker_orders:
            ticker_cd = order_info.get('ticker_cd')
            new_order = order_info.get('sort_order')

            if ticker_cd is None or new_order is None:
                continue

            item = db.query(WatchlistItem).filter(
                and_(
                    WatchlistItem.watchlist_id == watchlist_id,
                    WatchlistItem.ticker_cd == ticker_cd
                )
            ).first()

            if item:
                item.sort_order = new_order

        # 관심종목 리스트 업데이트 시간 갱신
        watchlist.updated_at = datetime.utcnow()

        db.commit()

        return True
