"""
Data Fetcher 사용 예제

FRED API와 Yahoo Finance를 사용하여 금융 데이터를 조회하는 예제입니다.
"""

import os
from data_fetcher import get_data_router
from data_fetcher.router import DataCategory
from data_fetcher.utils import get_credentials_for_api, CredentialsError


def example_1_fred_gdp():
    """예제 1: FRED API를 사용한 GDP 데이터 조회"""
    print("\n=== 예제 1: GDP 데이터 조회 ===\n")

    router = get_data_router()

    try:
        # 환경 변수에서 API 키 로드
        credentials = get_credentials_for_api('FRED')

        # GDP 데이터 조회
        gdp_data = router.fetch(
            category=DataCategory.GDP,
            params={'country': 'US', 'frequency': 'quarterly'},
            credentials=credentials
        )

        print(f"조회된 GDP 데이터: {len(gdp_data)}개")
        print("\n최근 5개 데이터:")

        for data in gdp_data[-5:]:
            print(f"  {data.date}: {data.value:,.0f} (성장률: {data.growth_rate:+.2f}%)")

    except CredentialsError as e:
        print(f"❌ API 키 오류: {e}")
        print("   FRED API 키를 환경 변수로 설정하세요: export FRED_API_KEY='your_key'")


def example_2_fred_cpi():
    """예제 2: FRED API를 사용한 CPI 데이터 조회"""
    print("\n=== 예제 2: CPI (소비자물가지수) 데이터 조회 ===\n")

    router = get_data_router()

    try:
        credentials = get_credentials_for_api('FRED')

        # CPI 데이터 조회
        cpi_data = router.fetch(
            category=DataCategory.CPI,
            params={'country': 'US', 'frequency': 'monthly'},
            credentials=credentials
        )

        print(f"조회된 CPI 데이터: {len(cpi_data)}개")
        print("\n최근 5개 데이터:")

        for data in cpi_data[-5:]:
            change_info = f"전월대비: {data.change_month:+.2f}%" if data.change_month else "N/A"
            print(f"  {data.date}: {data.value:.2f} ({change_info})")

    except CredentialsError as e:
        print(f"❌ API 키 오류: {e}")


def example_3_fred_unemployment():
    """예제 3: FRED API를 사용한 실업률 데이터 조회"""
    print("\n=== 예제 3: 실업률 데이터 조회 ===\n")

    router = get_data_router()

    try:
        credentials = get_credentials_for_api('FRED')

        # 실업률 데이터 조회
        unemployment_data = router.fetch(
            category=DataCategory.UNEMPLOYMENT,
            params={'country': 'US', 'age_group': 'all'},
            credentials=credentials
        )

        print(f"조회된 실업률 데이터: {len(unemployment_data)}개")
        print("\n최근 5개 데이터:")

        for data in unemployment_data[-5:]:
            participation = f"경제활동참가율: {data.participation_rate:.1f}%" if data.participation_rate else "N/A"
            print(f"  {data.date}: 실업률 {data.value:.1f}% ({participation})")

    except CredentialsError as e:
        print(f"❌ API 키 오류: {e}")


def example_4_yahoo_short_interest():
    """예제 4: Yahoo Finance를 사용한 공매도 데이터 조회"""
    print("\n=== 예제 4: 공매도 데이터 조회 (Yahoo Finance) ===\n")

    router = get_data_router()

    try:
        # Yahoo Finance는 API 키 불필요
        short_data = router.fetch(
            category=DataCategory.SHORT_INTEREST,
            params={'symbol': 'TSLA', 'limit': 10}
        )

        if short_data:
            data = short_data[0]
            print(f"종목: {data.symbol} ({data.company_name})")
            print(f"공매도 주식 수: {data.shares_short:,} 주")
            print(f"유통주식 대비 공매도 비율: {data.short_percent_of_float * 100:.2f}%")
            print(f"공매도 커버 소요일수: {data.short_ratio:.2f}일")
            print(f"전월 대비 변화율: {data.month_over_month_change_percent:+.2f}%")
        else:
            print("공매도 데이터를 조회할 수 없습니다.")

    except Exception as e:
        print(f"❌ 오류: {e}")


def example_5_direct_credentials():
    """예제 5: 직접 자격증명 전달"""
    print("\n=== 예제 5: 직접 자격증명 전달 ===\n")

    router = get_data_router()

    # 직접 API 키 전달 (권장하지 않음 - 환경 변수 사용 권장)
    credentials = {"api_key": "your_fred_api_key_here"}

    try:
        gdp_data = router.fetch(
            category=DataCategory.GDP,
            params={'country': 'US', 'frequency': 'quarterly'},
            credentials=credentials
        )

        print("✓ GDP 데이터 조회 성공")
        print(f"조회된 데이터: {len(gdp_data)}개")

    except CredentialsError as e:
        print(f"❌ 자격증명 오류: {e}")
    except Exception as e:
        print(f"❌ 데이터 조회 오류: {e}")


def example_6_error_handling():
    """예제 6: 에러 처리"""
    print("\n=== 예제 6: 에러 처리 ===\n")

    router = get_data_router()

    # API 키 없이 시도 (에러 발생)
    try:
        gdp_data = router.fetch(
            category=DataCategory.GDP,
            params={'country': 'US'},
            # credentials 미제공
        )
    except CredentialsError as e:
        print(f"✓ 예상된 에러 처리됨:")
        print(f"  {e}")
    except Exception as e:
        print(f"예상 외 에러: {e}")


def example_7_multiple_countries():
    """예제 7: 여러 국가 데이터 조회 (현재는 US만 지원)"""
    print("\n=== 예제 7: 국가별 데이터 조회 ===\n")

    router = get_data_router()

    try:
        credentials = get_credentials_for_api('FRED')

        # 현재 FRED API는 미국 데이터만 지원
        countries = ['US']  # 'KR', 'CN' 등은 아직 미지원

        for country in countries:
            print(f"\n{country} 데이터 조회:")
            try:
                gdp_data = router.fetch(
                    category=DataCategory.GDP,
                    params={'country': country, 'frequency': 'quarterly'},
                    credentials=credentials
                )
                if gdp_data:
                    print(f"  ✓ {len(gdp_data)}개 데이터 조회됨")
                    print(f"  최신: {gdp_data[-1].date} - {gdp_data[-1].value:,.0f}")
            except Exception as e:
                print(f"  ✗ 조회 실패: {e}")

    except CredentialsError as e:
        print(f"❌ API 키 오류: {e}")


def main():
    """모든 예제 실행"""
    print("=" * 60)
    print("Data Fetcher 사용 예제")
    print("=" * 60)

    # 실행할 예제 선택
    examples = {
        '1': ('GDP 데이터 조회', example_1_fred_gdp),
        '2': ('CPI 데이터 조회', example_2_fred_cpi),
        '3': ('실업률 데이터 조회', example_3_fred_unemployment),
        '4': ('공매도 데이터 조회', example_4_yahoo_short_interest),
        '5': ('직접 자격증명 전달', example_5_direct_credentials),
        '6': ('에러 처리', example_6_error_handling),
        '7': ('국가별 데이터 조회', example_7_multiple_countries),
        'all': ('모든 예제 실행', None),
    }

    print("\n사용 가능한 예제:")
    for key, (desc, _) in examples.items():
        print(f"  {key}: {desc}")

    choice = input("\n실행할 예제 선택 (기본값: 4): ").strip() or '4'

    if choice == 'all':
        for key, (_, func) in examples.items():
            if key != 'all':
                func()
    elif choice in examples and examples[choice][1]:
        examples[choice][1]()
    else:
        print(f"❌ 유효하지 않은 선택: {choice}")


if __name__ == "__main__":
    main()
