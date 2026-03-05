"""
알림 시스템 서비스
"""
from sqlalchemy.orm import Session
from typing import List, Optional
from decimal import Decimal
from datetime import datetime
import uuid

from index_analyzer.models.orm import Alert, AlertHistory, User, MBS_IN_STK_STBD


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

    @staticmethod
    def get_alert_history(
        db: Session,
        user_id: str,
        alert_id: Optional[str] = None,
        limit: int = 50
    ) -> List[dict]:
        """
        알림 발생 이력 조회

        Args:
            user_id: 사용자 ID
            alert_id: 특정 알림 ID (선택사항)
            limit: 조회 개수 제한

        Returns:
            알림 이력 리스트
        """
        # 먼저 사용자의 알림 ID들 조회
        user_alert_ids = [
            a.alert_id for a in db.query(Alert.alert_id).filter(Alert.user_id == user_id).all()
        ]

        # 히스토리 조회
        query = db.query(AlertHistory).filter(
            AlertHistory.alert_id.in_(user_alert_ids)
        )

        if alert_id:
            # 특정 알림의 히스토리만 조회
            if alert_id not in user_alert_ids:
                return []
            query = query.filter(AlertHistory.alert_id == alert_id)

        history = query.order_by(
            AlertHistory.triggered_at.desc()
        ).limit(limit).all()

        # 알림 정보와 함께 반환
        result = []
        for h in history:
            alert = db.query(Alert).filter(Alert.alert_id == h.alert_id).first()
            history_dict = h.to_dict()
            if alert:
                history_dict['alert_info'] = {
                    'ticker_cd': alert.ticker_cd,
                    'alert_type': alert.alert_type,
                    'condition_type': alert.condition_type
                }
            result.append(history_dict)

        return result

    @staticmethod
    def create_alert_history(
        db: Session,
        alert_id: str,
        triggered_value: Decimal,
        message: str,
        is_sent: bool = True
    ) -> AlertHistory:
        """
        알림 히스토리 생성

        Args:
            alert_id: 알림 ID
            triggered_value: 발생 시의 값
            message: 발송 메시지
            is_sent: 발송 성공 여부

        Returns:
            생성된 히스토리
        """
        history = AlertHistory(
            history_id=f"hist_{uuid.uuid4().hex[:16]}",
            alert_id=alert_id,
            triggered_at=datetime.utcnow(),
            triggered_value=triggered_value,
            message=message,
            is_sent=is_sent
        )

        db.add(history)
        db.commit()
        db.refresh(history)

        return history

    @staticmethod
    def test_alert(db: Session, alert_id: str, user_id: str) -> dict:
        """
        알림 테스트 발송

        Args:
            alert_id: 알림 ID
            user_id: 사용자 ID

        Returns:
            테스트 결과
        """
        alert = db.query(Alert).filter(
            Alert.alert_id == alert_id,
            Alert.user_id == user_id
        ).first()

        if not alert:
            return None

        # 테스트 메시지 생성
        test_message = f"[TEST] Alert: {alert.alert_type} for {alert.ticker_cd or 'N/A'}"

        # 히스토리에 기록
        AlertService.create_alert_history(
            db=db,
            alert_id=alert_id,
            triggered_value=alert.threshold_value,
            message=test_message,
            is_sent=True
        )

        return {
            "success": True,
            "message": "Test alert sent successfully",
            "alert_id": alert_id,
            "test_message": test_message
        }
