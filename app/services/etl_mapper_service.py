"""
ETL Mapper Service

데이터 소스 매핑 조회 서비스
DB에 저장된 ETL 매핑 테이블을 조회하여 적절한 데이터 소스 반환
"""
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from app.models.database import SessionLocal
from app.models.etl_mapping import ETLMapping


class ETLMapperService:
    """ETL 매핑 서비스 - DB 기반"""

    def __init__(self, db: Session = None):
        """
        Args:
            db: SQLAlchemy Session (옵션, 없으면 자동 생성)
        """
        self.db = db
        self._auto_session = False

        if self.db is None:
            self.db = SessionLocal()
            self._auto_session = True

    def __del__(self):
        """소멸자 - 자동 생성된 세션 정리"""
        if self._auto_session and self.db:
            self.db.close()

    def find_by_keyword(self, keyword: str) -> List[Dict]:
        """
        키워드로 매핑 조회

        Args:
            keyword: 검색 키워드 (예: "금리", "실적", "GDP")

        Returns:
            매핑 정보 리스트
        """
        results = self.db.query(ETLMapping)\
            .filter(
                ETLMapping.is_active == 1,
                ETLMapping.keyword.like(f'%{keyword}%')
            )\
            .all()

        return [r.to_dict() for r in results]

    def find_by_category(self, category: str) -> List[Dict]:
        """
        카테고리로 매핑 조회

        Args:
            category: 카테고리 (예: "거시경제", "기업재무", "주식시장")

        Returns:
            매핑 정보 리스트
        """
        results = self.db.query(ETLMapping)\
            .filter(
                ETLMapping.is_active == 1,
                ETLMapping.category == category
            )\
            .all()

        return [r.to_dict() for r in results]

    def find_by_data_source(self, data_source: str) -> List[Dict]:
        """
        데이터 소스로 매핑 조회

        Args:
            data_source: 데이터 소스 (예: "FRED", "FMP", "Yahoo Finance")

        Returns:
            매핑 정보 리스트
        """
        results = self.db.query(ETLMapping)\
            .filter(
                ETLMapping.is_active == 1,
                ETLMapping.data_source == data_source
            )\
            .all()

        return [r.to_dict() for r in results]

    def search(
        self,
        keyword: Optional[str] = None,
        category: Optional[str] = None,
        data_source: Optional[str] = None
    ) -> List[Dict]:
        """
        복합 검색

        Args:
            keyword: 검색 키워드 (옵션)
            category: 카테고리 (옵션)
            data_source: 데이터 소스 (옵션)

        Returns:
            매핑 정보 리스트
        """
        query = self.db.query(ETLMapping).filter(ETLMapping.is_active == 1)

        if keyword:
            query = query.filter(ETLMapping.keyword.like(f'%{keyword}%'))

        if category:
            query = query.filter(ETLMapping.category == category)

        if data_source:
            query = query.filter(ETLMapping.data_source == data_source)

        results = query.all()
        return [r.to_dict() for r in results]

    def get_data_source_for_query(self, user_query: str) -> List[Dict]:
        """
        사용자 질의에 대한 데이터 소스 추천

        Args:
            user_query: 사용자 자연어 질의 (예: "미국 금리 동향 보여줘")

        Returns:
            추천 데이터 소스 리스트
        """
        # 간단한 키워드 추출 (추후 NLP/LLM으로 개선 가능)
        keywords = self._extract_keywords(user_query)

        # 각 키워드로 매핑 조회
        all_mappings = []
        seen_ids = set()

        for keyword in keywords:
            mappings = self.find_by_keyword(keyword)
            for mapping in mappings:
                if mapping['mapping_id'] not in seen_ids:
                    all_mappings.append(mapping)
                    seen_ids.add(mapping['mapping_id'])

        return all_mappings

    def _extract_keywords(self, query: str) -> List[str]:
        """
        사용자 질의에서 키워드 추출 (간단 구현)

        Args:
            query: 사용자 질의

        Returns:
            추출된 키워드 리스트
        """
        # 간단한 키워드 맵핑 (추후 NLP 모델로 개선)
        keyword_mapping = {
            '금리': ['금리', '국채', '연준'],
            '인플레이션': ['인플레이션', 'CPI', 'PPI'],
            '고용': ['고용', '실업률', 'NFP'],
            'GDP': ['GDP', '경제성장'],
            '주가': ['주가', '주식', '종목'],
            '재무제표': ['재무제표', '손익계산서', '대차대조표', '현금흐름'],
            '실적': ['실적', '어닝', 'earnings'],
            '배당': ['배당', 'dividend'],
            'IPO': ['IPO', '상장'],
            '섹터': ['섹터', '업종', '산업'],
            '원자재': ['원유', '금', '은', '구리', '원자재'],
            '채권': ['채권', '국채', '회사채']
        }

        keywords = []
        query_lower = query.lower()

        for key, values in keyword_mapping.items():
            for value in values:
                if value in query or value.lower() in query_lower:
                    keywords.append(key)
                    break

        return keywords if keywords else ['주가']  # 기본값: 주가

    def get_all_categories(self) -> List[str]:
        """
        모든 카테고리 목록 조회

        Returns:
            카테고리 리스트
        """
        results = self.db.query(ETLMapping.category)\
            .filter(ETLMapping.is_active == 1)\
            .distinct()\
            .all()

        return [r[0] for r in results if r[0]]

    def get_all_data_sources(self) -> List[str]:
        """
        모든 데이터 소스 목록 조회

        Returns:
            데이터 소스 리스트
        """
        results = self.db.query(ETLMapping.data_source)\
            .filter(ETLMapping.is_active == 1)\
            .distinct()\
            .all()

        return [r[0] for r in results if r[0]]


# Singleton instance
_etl_mapper_instance = None


def get_etl_mapper() -> ETLMapperService:
    """ETL Mapper Singleton 인스턴스 반환"""
    global _etl_mapper_instance
    if _etl_mapper_instance is None:
        _etl_mapper_instance = ETLMapperService()
    return _etl_mapper_instance


# 사용 예시
if __name__ == "__main__":
    # 테스트
    mapper = get_etl_mapper()

    print("=== ETL Mapper Test ===\n")

    # 1. 키워드 검색
    print("1. Search by keyword '금리':")
    results = mapper.find_by_keyword('금리')
    for r in results[:3]:
        print(f"  - {r['category']} | {r['keyword']} | {r['data_source']} | {r['api_endpoint']}")

    # 2. 카테고리 검색
    print("\n2. Search by category '거시경제':")
    results = mapper.find_by_category('거시경제')
    print(f"  Found {len(results)} mappings")

    # 3. 데이터 소스 검색
    print("\n3. Search by data source 'FRED':")
    results = mapper.find_by_data_source('FRED')
    print(f"  Found {len(results)} mappings")

    # 4. 사용자 질의 처리
    print("\n4. Get data source for query '미국 금리 동향':")
    results = mapper.get_data_source_for_query('미국 금리 동향')
    for r in results[:3]:
        print(f"  - {r['data_source']}: {r['api_endpoint']}")

    # 5. 카테고리 목록
    print("\n5. All categories:")
    categories = mapper.get_all_categories()
    print(f"  {categories}")

    # 6. 데이터 소스 목록
    print("\n6. All data sources:")
    sources = mapper.get_all_data_sources()
    print(f"  {sources}")
