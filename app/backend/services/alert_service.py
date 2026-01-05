"""
알림 시스템 서비스
"""
from sqlalchemy.orm import Session
from typing import List, Optional
from decimal import Decimal
from datetime import datetime
import uuid

from index_analyzer.models.database import Alert, User, MBS_IN_STK_STBD


class AlertService:
    """알림 관리 비즈니스 로직"""

    @staticmethod
    def create_alert(
        db: Session,
        user_id: str,
        alert_type: str,
        ticker_cd: Optional[str],
        condition_type: str,
        threshold_value: Decimal,
        notification_method: str = "email",
        message: Optional[str] = None
    ) -> Alert:
        """
        새 알림 생성

        alert_type: price, news, technical
        condition_type: above, below, percent_change, etc.
        """
        alert = Alert(
            alert_id=f"alert_{uuid.uuid4().hex[:16]}",
            user_id=user_id,
            alert_type=alert_type,
            ticker_cd=ticker_cd,
            condition_type=condition_type,
            threshold_value=threshold_value,
            is_active=True,
            notification_method=notification_method,
            message=message,
            trigger_count=0
        )

        db.add(alert)
        db.commit()
        db.refresh(alert)

        return alert

    @staticmethod
    def get_user_alerts(db: Session, user_id: str, is_active: Optional[bool] = None) -> List[Alert]:
        """
        사용자의 알림 조회
        """
        query = db.query(Alert).filter(Alert.user_id == user_id)

        if is_active is not None:
            query = query.filter(Alert.is_active == is_active)

        return query.order_by(Alert.created_at.desc()).all()

    @staticmethod
    def update_alert(
        db: Session,
        alert_id: str,
        user_id: str,
        **updates
    ) -> Optional[Alert]:
        """
        알림 업데이트
        """
        alert = db.query(Alert).filter(
            Alert.alert_id == alert_id,
            Alert.user_id == user_id
        ).first()

        if not alert:
            return None

        for key, value in updates.items():
            if hasattr(alert, key) and value is not None:
                setattr(alert, key, value)

        db.commit()
        db.refresh(alert)

        return alert

    @staticmethod
    def delete_alert(db: Session, alert_id: str, user_id: str) -> bool:
        """
        알림 삭제
        """
        alert = db.query(Alert).filter(
            Alert.alert_id == alert_id,
            Alert.user_id == user_id
        ).first()

        if not alert:
            return False

        db.delete(alert)
        db.commit()

        return True

    @staticmethod
    def toggle_alert(db: Session, alert_id: str, user_id: str) -> Optional[Alert]:
        """
        알림 활성화/비활성화 토글
        """
        alert = db.query(Alert).filter(
            Alert.alert_id == alert_id,
            Alert.user_id == user_id
        ).first()

        if not alert:
            return None

        alert.is_active = not alert.is_active
        db.commit()
        db.refresh(alert)

        return alert

    @staticmethod
    def check_price_alerts(db: Session) -> List[dict]:
        """
        가격 알림 체크 (백그라운드 작업용)
        실제로는 스케줄러에서 주기적으로 실행
        """
        # 활성화된 가격 알림 조회
        price_alerts = db.query(Alert).filter(
            Alert.alert_type == "price",
            Alert.is_active == True
        ).all()

        triggered_alerts = []

        for alert in price_alerts:
            if not alert.ticker_cd:
                continue

            # 최신 가격 조회
            latest_price = db.query(MBS_IN_STK_STBD).filter(
                MBS_IN_STK_STBD.stk_cd == alert.ticker_cd
            ).order_by(MBS_IN_STK_STBD.base_ymd.desc()).first()

            if not latest_price:
                continue

            current_price = latest_price.close_price
            triggered = False

            # 조건 체크
            if alert.condition_type == "above":
                if current_price >= alert.threshold_value:
                    triggered = True
            elif alert.condition_type == "below":
                if current_price <= alert.threshold_value:
                    triggered = True
            elif alert.condition_type == "percent_change":
                change_rate = latest_price.change_rate
                if abs(change_rate) >= abs(alert.threshold_value):
                    triggered = True

            if triggered:
                # 알림 트리거
                alert.last_triggered = datetime.utcnow()
                alert.trigger_count += 1

                # 사용자 정보 조회
                user = db.query(User).filter(User.user_id == alert.user_id).first()

                triggered_alerts.append({
                    "alert": alert.to_dict(),
                    "user": user.to_dict() if user else None,
                    "current_price": float(current_price),
                    "ticker": alert.ticker_cd
                })

        db.commit()

        return triggered_alerts
