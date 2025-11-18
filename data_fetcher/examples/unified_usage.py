"""
통합 데이터 조회 시스템 사용 예제

OpenBB 패턴을 따르는 개선된 Fetcher 시스템 사용법을 보여줍니다.

Features:
- Async/Sync 지원
- 자동 Provider 등록 및 발견
- Type-safe 데이터 조회
- 통합 Router 인터페이스
- 테스트 자동화
"""
import asyncio
from datetime import datetime
from typing import List

from data_fetcher.router import DataRouter, get_data_router
from data_fetcher.registry import FetcherRegistry
from data_fetcher.provider import ProviderRegistry
from data_fetcher.fetchers.fred.gdp import FREDGDPFetcher
from data_fetcher.utils.credentials import get_credentials_for_api


# ==================== Example 1: Router를 사용한 통합 조회 ====================

async def example_router_usage():
    """Router를 사용한 데이터 조회 예제"""
    print("=" * 70)
    print("Example 1: Router를 사용한 통합 데이터 조회")
    print("=" * 70)

    # Router 인스턴스 생성
    router = DataRouter()

    # 사용 가능한 카테고리 확인
    print(f"\n사용 가능한 카테고리: {router.list_categories()}")

    # GDP 데이터 조회 (async)
    try:
        credentials = get_credentials_for_api("FRED")

        gdp_data = await router.fetch(
            category="gdp",
            provider="fred",
            params={
                "country": "US",
                "frequency": "quarterly",
                "start_date": "2020-01-01",
                "end_date": "2024-01-01"
            },
            credentials=credentials
        )

        print(f"\n✓ GDP 데이터 조회 성공!")
        print(f"  - 레코드 수: {len(gdp_data)}")
        print(f"  - 첫 번째 데이터: {gdp_data[0]}")
        print(f"  - 마지막 데이터: {gdp_data[-1]}")

    except Exception as e:
        print(f"✗ GDP 데이터 조회 실패: {e}")


# ==================== Example 2: 편의 메서드 사용 ====================

async def example_convenience_methods():
    """편의 메서드를 사용한 데이터 조회"""
    print("\n" + "=" * 70)
    print("Example 2: 편의 메서드 사용")
    print("=" * 70)

    router = DataRouter()

    try:
        credentials = get_credentials_for_api("FRED")

        # get_gdp 편의 메서드 사용
        gdp_data = await router.get_gdp(
            country="US",
            frequency="quarterly",
            start_date="2023-01-01",
            credentials=credentials
        )

        print(f"\n✓ get_gdp() 사용 성공!")
        print(f"  - 레코드 수: {len(gdp_data)}")

        # get_cpi 편의 메서드 사용
        cpi_data = await router.get_cpi(
            country="US",
            start_date="2023-01-01",
            credentials=credentials
        )

        print(f"\n✓ get_cpi() 사용 성공!")
        print(f"  - 레코드 수: {len(cpi_data)}")

    except Exception as e:
        print(f"✗ 데이터 조회 실패: {e}")


# ==================== Example 3: Fetcher 직접 사용 ====================

async def example_direct_fetcher():
    """Fetcher 클래스를 직접 사용하는 예제"""
    print("\n" + "=" * 70)
    print("Example 3: Fetcher 직접 사용")
    print("=" * 70)

    try:
        credentials = get_credentials_for_api("FRED")

        # Fetcher 직접 호출 (async)
        gdp_data = await FREDGDPFetcher.fetch_data(
            params={
                "country": "US",
                "frequency": "quarterly",
                "start_date": "2023-01-01",
                "end_date": "2024-01-01"
            },
            credentials=credentials
        )

        print(f"\n✓ Fetcher 직접 사용 성공!")
        print(f"  - 레코드 수: {len(gdp_data)}")
        print(f"  - 데이터 타입: {type(gdp_data[0])}")

    except Exception as e:
        print(f"✗ Fetcher 사용 실패: {e}")


# ==================== Example 4: 동기 방식 사용 ====================

def example_sync_usage():
    """동기 방식으로 데이터 조회"""
    print("\n" + "=" * 70)
    print("Example 4: 동기 방식 사용 (fetch_sync)")
    print("=" * 70)

    router = DataRouter()

    try:
        credentials = get_credentials_for_api("FRED")

        # fetch_sync 사용 (내부적으로 asyncio.run 호출)
        gdp_data = router.fetch_sync(
            category="gdp",
            provider="fred",
            params={
                "country": "US",
                "frequency": "quarterly",
                "start_date": "2023-01-01"
            },
            credentials=credentials
        )

        print(f"\n✓ 동기 조회 성공!")
        print(f"  - 레코드 수: {len(gdp_data)}")

    except Exception as e:
        print(f"✗ 동기 조회 실패: {e}")


# ==================== Example 5: Registry 정보 확인 ====================

def example_registry_info():
    """Registry 정보 확인"""
    print("\n" + "=" * 70)
    print("Example 5: Registry 정보 확인")
    print("=" * 70)

    # Fetcher Registry 정보
    print("\n[Fetcher Registry]")
    categories = FetcherRegistry.list_categories()
    print(f"총 카테고리 수: {len(categories)}")

    for category in categories[:5]:  # 처음 5개만 출력
        providers = FetcherRegistry.list_providers(category)
        metadata = FetcherRegistry.get_metadata(category, providers[0])
        print(f"\n  Category: {category}")
        print(f"    Providers: {', '.join(providers)}")
        print(f"    Description: {metadata.get('description', 'N/A')}")

    # Provider Registry 정보
    print("\n[Provider Registry]")
    providers = ProviderRegistry.list()
    print(f"총 Provider 수: {len(providers)}")

    for provider_name in providers:
        provider = ProviderRegistry.get(provider_name)
        print(f"\n  {provider_name.upper()}:")
        print(f"    Website: {provider.website}")
        print(f"    Categories: {', '.join(provider.list_categories()[:5])}")


# ==================== Example 6: Type Safety 확인 ====================

def example_type_safety():
    """Type Safety 확인"""
    print("\n" + "=" * 70)
    print("Example 6: Type Safety 확인")
    print("=" * 70)

    # Fetcher의 type properties 확인
    print(f"\nFREDGDPFetcher Type Info:")
    print(f"  - Query Params Type: {FREDGDPFetcher.query_params_type}")
    print(f"  - Data Type: {FREDGDPFetcher.data_type}")
    print(f"  - Require Credentials: {FREDGDPFetcher.require_credentials}")


# ==================== Example 7: 자동 테스트 ====================

def example_automated_testing():
    """자동화된 Fetcher 테스트"""
    print("\n" + "=" * 70)
    print("Example 7: Fetcher 자동 테스트")
    print("=" * 70)

    try:
        credentials = get_credentials_for_api("FRED")

        # Fetcher.test() 메서드 사용
        print("\nFREDGDPFetcher 테스트 실행 중...")
        FREDGDPFetcher.test(
            params={
                "country": "US",
                "frequency": "quarterly",
                "start_date": "2023-01-01",
                "end_date": "2023-12-31"
            },
            credentials=credentials
        )

    except Exception as e:
        print(f"✗ 테스트 실패: {e}")


# ==================== Example 8: 여러 Provider 비교 ====================

async def example_multi_provider():
    """같은 데이터를 여러 Provider에서 조회하여 비교"""
    print("\n" + "=" * 70)
    print("Example 8: Multi-Provider 비교 (동일 카테고리)")
    print("=" * 70)

    router = DataRouter()

    # 같은 카테고리에 여러 provider가 있다면 비교 가능
    category = "gdp"
    providers = FetcherRegistry.list_providers(category)

    print(f"\n'{category}' 카테고리의 사용 가능한 Provider: {providers}")

    # 실제로는 각 provider에서 데이터를 조회하여 비교할 수 있음
    # 예제에서는 정보만 출력
    for provider in providers:
        metadata = FetcherRegistry.get_metadata(category, provider)
        print(f"  - {provider}: {metadata.get('description', 'No description')}")


# ==================== Main ====================

async def main():
    """모든 예제 실행"""
    print("\n" + "=" * 70)
    print("데이터 조회 시스템 통합 예제")
    print("OpenBB 패턴을 따르는 개선된 Fetcher 시스템")
    print("=" * 70)

    # 비동기 예제
    await example_router_usage()
    await example_convenience_methods()
    await example_direct_fetcher()
    await example_multi_provider()

    # 동기 예제
    example_sync_usage()
    example_registry_info()
    example_type_safety()

    # 테스트 예제 (실제 API 키가 필요)
    # example_automated_testing()

    print("\n" + "=" * 70)
    print("모든 예제 실행 완료!")
    print("=" * 70)


if __name__ == "__main__":
    # 비동기 main 실행
    asyncio.run(main())
