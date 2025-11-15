"""
FredSeriesFetcher 사용 예제

3가지 레벨의 호출 방법:
1. Low-level: FredSeriesFetcher 직접 호출
2. Mid-level: 개별 Fetcher 사용 (FREDGDPFetcher 등)
3. High-level: DataRouter 사용 (권장)
"""
import os
from datetime import date

# ========================================
# Level 1: FredSeriesFetcher 직접 호출
# ========================================
print("=" * 60)
print("Level 1: FredSeriesFetcher 직접 호출 (Low-level)")
print("=" * 60)

from data_fetcher.fetchers.fred.series import FredSeriesFetcher

# API 키 설정 (환경 변수 또는 직접)
api_key = os.getenv('FRED_API_KEY')

# API 키 검증
if not api_key or api_key == 'your_api_key_here':
    print("\n FRED API 키가 필요합니다!")
    print("\n방법 1: 환경 변수 설정")
    print("  Windows: set FRED_API_KEY=your_actual_key")
    print("  Linux/Mac: export FRED_API_KEY=your_actual_key")
    print("-" * 60)
    exit(0)

print(f"\n✓ API 키 확인됨: {api_key[:8]}...")

# 단일 시리즈 조회
print("\n[1-1] 단일 시리즈 조회 (GDP)")
try:
    observations = FredSeriesFetcher.fetch_series(
        series_id='GDP',
        api_key=api_key,
        start_date=date(2020, 1, 1),
        end_date=date(2023, 12, 31),
        limit=100
    )

    print(f"✓ 조회된 데이터: {len(observations)}개")
    if observations:
        print(f"  최신 데이터: {observations[-1]}")
except Exception as e:
    print(f"✗ 오류: {e}")

# 여러 시리즈 동시 조회
print("\n[1-2] 여러 시리즈 동시 조회")
try:
    series_ids = ['GDP', 'CPIAUCSL', 'UNRATE']  # GDP, CPI, 실업률
    results = FredSeriesFetcher.fetch_multiple_series(
        series_ids=series_ids,
        api_key=api_key,
        start_date=date(2023, 1, 1),
        limit=20
    )

    print(f"✓ 조회 성공:")
    for series_id, data in results.items():
        print(f"  {series_id}: {len(data)}개")
except Exception as e:
    print(f"✗ 오류: {e}")

# 시리즈 메타데이터 조회
print("\n[1-3] 시리즈 정보 조회")
try:
    info = FredSeriesFetcher.get_series_info(
        series_id='GDP',
        api_key=api_key
    )

    if info:
        print(f"✓ 시리즈 정보:")
        print(f"  시리즈 ID: {info.get('id')}")
        print(f"  제목: {info.get('title')}")
        print(f"  단위: {info.get('units')}")
        print(f"  빈도: {info.get('frequency')}")
except Exception as e:
    print(f"✗ 오류: {e}")


# ========================================
# Level 2: 개별 Fetcher 사용
# ========================================
print("\n" + "=" * 60)
print("Level 2: 개별 Fetcher 사용 (Mid-level)")
print("=" * 60)

from data_fetcher.fetchers.fred.gdp import FREDGDPFetcher
from data_fetcher.fetchers.fred.cpi import FREDCPIFetcher
from data_fetcher.fetchers.fred.unemployment import FREDUnemploymentFetcher

# GDP Fetcher 사용
print("\n[2-1] FREDGDPFetcher 사용")
gdp_params = {
    'country': 'US',
    'frequency': 'quarterly',
    'start_date': date(2020, 1, 1),
    'end_date': date(2023, 12, 31)
}

credentials = {'api_key': api_key}

try:
    gdp_data = FREDGDPFetcher.fetch_data(
        params=gdp_params,
        credentials=credentials
    )

    print(f"조회된 GDP 데이터: {len(gdp_data)}개")
    if gdp_data:
        latest = gdp_data[-1]
        print(f"최신: {latest.date} - ${latest.value:,.0f}B (성장률: {latest.growth_rate:+.2f}%)")
except Exception as e:
    print(f"오류: {e}")

# CPI Fetcher 사용
print("\n[2-2] FREDCPIFetcher 사용")
cpi_params = {
    'country': 'US',
    'frequency': 'monthly',
    'category': 'All Items',
    'start_date': date(2023, 1, 1)
}

try:
    cpi_data = FREDCPIFetcher.fetch_data(
        params=cpi_params,
        credentials=credentials
    )

    print(f"조회된 CPI 데이터: {len(cpi_data)}개")
    if cpi_data:
        latest = cpi_data[-1]
        print(f"최신: {latest.date} - {latest.value:.2f}")
except Exception as e:
    print(f"오류: {e}")


# ========================================
# Level 3: DataRouter 사용 (권장)
# ========================================
print("\n" + "=" * 60)
print("Level 3: DataRouter 사용 (High-level, 권장)")
print("=" * 60)

from data_fetcher.router import DataRouter, DataCategory

router = DataRouter()

# GDP 조회
print("\n[3-1] DataRouter로 GDP 조회")
try:
    gdp_data = router.fetch(
        category=DataCategory.GDP,
        params={
            'country': 'US',
            'frequency': 'quarterly',
            'start_date': date(2020, 1, 1)
        },
        credentials=credentials
    )

    print(f"조회된 GDP 데이터: {len(gdp_data)}개")
    if gdp_data:
        for data in gdp_data[-3:]:
            print(f"  {data.date}: ${data.value:,.0f}B (성장률: {data.growth_rate:+.2f}%)")
except Exception as e:
    print(f"오류: {e}")

# 여러 카테고리 조회
print("\n[3-2] 여러 경제 지표 조회")
categories = [
    (DataCategory.GDP, {'country': 'US', 'frequency': 'quarterly'}),
    (DataCategory.CPI, {'country': 'US', 'frequency': 'monthly'}),
    (DataCategory.UNEMPLOYMENT, {'country': 'US', 'age_group': 'all'}),
    (DataCategory.INDUSTRIAL_PRODUCTION, {'country': 'US', 'category': 'total'}),
    (DataCategory.CONSUMER_SENTIMENT, {'country': 'US', 'sentiment_type': 'preliminary'}),
]

for category, params in categories:
    try:
        data = router.fetch(
            category=category,
            params=params,
            credentials=credentials
        )
        print(f"  {category.value}: {len(data)}개 데이터")
    except Exception as e:
        print(f"  {category.value}: 오류 - {e}")


# ========================================
# 실전 예제: 경제 대시보드 데이터 수집
# ========================================
print("\n" + "=" * 60)
print("실전 예제: 경제 대시보드 데이터")
print("=" * 60)

def fetch_economic_dashboard(api_key: str):
    """경제 지표 대시보드용 데이터 수집"""
    router = DataRouter()
    credentials = {'api_key': api_key}

    dashboard_data = {}

    # 1. GDP (최근 4분기)
    try:
        gdp = router.fetch(
            category=DataCategory.GDP,
            params={'country': 'US', 'frequency': 'quarterly'},
            credentials=credentials
        )
        dashboard_data['gdp'] = {
            'latest': gdp[-1].value if gdp else None,
            'growth': gdp[-1].growth_rate if gdp else None,
            'date': gdp[-1].date if gdp else None
        }
    except Exception as e:
        print(f"GDP 조회 실패: {e}")

    # 2. 인플레이션 (최근 1개월)
    try:
        cpi = router.fetch(
            category=DataCategory.CPI,
            params={'country': 'US', 'frequency': 'monthly'},
            credentials=credentials
        )
        dashboard_data['inflation'] = {
            'latest': cpi[-1].value if cpi else None,
            'change': cpi[-1].change_month if cpi else None,
            'date': cpi[-1].date if cpi else None
        }
    except Exception as e:
        print(f"CPI 조회 실패: {e}")

    # 3. 실업률
    try:
        unemployment = router.fetch(
            category=DataCategory.UNEMPLOYMENT,
            params={'country': 'US', 'age_group': 'all'},
            credentials=credentials
        )
        dashboard_data['unemployment'] = {
            'rate': unemployment[-1].value if unemployment else None,
            'date': unemployment[-1].date if unemployment else None
        }
    except Exception as e:
        print(f"실업률 조회 실패: {e}")

    return dashboard_data

# 대시보드 데이터 수집
print("\n경제 대시보드 데이터:")
dashboard = fetch_economic_dashboard(api_key)

for indicator, data in dashboard.items():
    print(f"\n{indicator.upper()}:")
    for key, value in data.items():
        print(f"  {key}: {value}")


# ========================================
# 요약
# ========================================
print("\n" + "=" * 60)
print("사용 방법 요약")
print("=" * 60)
print("""
레벨 1 (Low-level): FredSeriesFetcher 직접 호출
  - 사용 시기: 단순 시계열 데이터만 필요할 때
  - 장점: 빠르고 직접적
  - 단점: 데이터 변환 수동, 검증 없음

  예:
    from data_fetcher.fetchers.fred.series import FredSeriesFetcher
    data = FredSeriesFetcher.fetch_series('GDP', api_key=key)

레벨 2 (Mid-level): 개별 Fetcher 사용
  - 사용 시기: 특정 경제 지표에 대한 상세 제어가 필요할 때
  - 장점: 타입 검증, 데이터 변환, 도메인 로직 포함
  - 단점: Fetcher별 API 알아야 함

  예:
    from data_fetcher.fetchers.fred.gdp import FREDGDPFetcher
    data = FREDGDPFetcher.fetch_data(params, credentials)

레벨 3 (High-level): DataRouter 사용 [권장]
  - 사용 시기: 일반적인 모든 경우
  - 장점: 일관된 인터페이스, 카테고리 기반, 확장 용이
  - 단점: 없음

  예:
    from data_fetcher.router import DataRouter, DataCategory
    router = DataRouter()
    data = router.fetch(DataCategory.GDP, params, credentials)

권장: DataRouter (Level 3) 사용
이유: 일관성, 타입 안정성, 확장성, 유지보수성
""")

print("\n실행 방법:")
print("  1. FRED API 키 발급: https://fred.stlouisfed.org/docs/api/api_key.html")
print("  2. 환경 변수 설정: export FRED_API_KEY='your_key'")
print("  3. 스크립트 실행: python data_fetcher/examples_fred_usage.py")

#if __name__ == "__main__":
#   main()