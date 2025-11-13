"""
ETL 매핑 테이블 모델

데이터 소스 매핑 관리를 위한 DB 테이블
"""
from sqlalchemy import Column, String, Integer, DateTime, Text
from sqlalchemy.sql import func
from app.models.database import Base


class ETLMapping(Base):
    """ETL 데이터 매핑 테이블"""

    __tablename__ = "mbs_in_etl_mapping"

    # Primary Key
    mapping_id = Column(Integer, primary_key=True, autoincrement=True)

    # 분류
    category = Column(String(50), nullable=False, index=True, comment="카테고리 (거시경제, 기업재무, 주식시장 등)")
    keyword = Column(String(200), nullable=False, index=True, comment="뉴스 키워드/주제")
    indicator = Column(String(200), comment="관련 금융지표")

    # 데이터 소스
    data_source = Column(String(100), nullable=False, index=True, comment="데이터 소스 (FRED, FMP, Yahoo Finance)")
    api_endpoint = Column(String(500), comment="API/엔드포인트")
    main_fields = Column(Text, comment="주요 필드 (JSON 또는 CSV)")

    # 메타데이터
    update_cycle = Column(String(50), comment="업데이트 주기 (Daily, Quarterly, Realtime 등)")
    fallback_source = Column(String(100), comment="Fallback 소스")
    note = Column(Text, comment="비고")

    # 추가 정보
    is_active = Column(Integer, default=1, comment="활성화 여부 (1: 활성, 0: 비활성)")

    # 타임스탬프
    created_at = Column(DateTime, default=func.now(), comment="생성일시")
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), comment="수정일시")

    def __repr__(self):
        return f"<ETLMapping(category={self.category}, keyword={self.keyword}, source={self.data_source})>"

    def to_dict(self):
        """딕셔너리로 변환"""
        return {
            'mapping_id': self.mapping_id,
            'category': self.category,
            'keyword': self.keyword,
            'indicator': self.indicator,
            'data_source': self.data_source,
            'api_endpoint': self.api_endpoint,
            'main_fields': self.main_fields,
            'update_cycle': self.update_cycle,
            'fallback_source': self.fallback_source,
            'note': self.note,
            'is_active': self.is_active
        }
