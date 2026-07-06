"""마이그레이션 패턴별 라이브 스모크 (무인증, opt-in).

베이스 클래스 계열별 대표 fetcher 1개씩을 실제로 실행해 TET 파이프라인을 검증한다.
네트워크(외부 API)와 로컬 DB(data/marketpulse.db)를 사용하므로 CI 기본 실행 대상이 아니다.

사용법:
    python scripts/smoke_live.py            # 전체 실행
    python scripts/smoke_live.py wsj sec    # 이름 필터
"""
import sys
import traceback
from pathlib import Path

# Windows cp949 콘솔에서 Fetcher.test()의 "✓" 출력이 깨지지 않도록
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import data_fetcher.providers_init  # noqa: F401, E402  (등록 트리거)
from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry  # noqa: E402

# (이름, provider, fetcher_key, params) — 패턴별 대표 1개
CASES = [
    # sync body를 유지한 ApiFetcher (Phase 2 wsj 파일럿 경로)
    ("wsj", "wsj", "etf_active", {}),
    # aiohttp response_callback 계약의 async ApiFetcher (OpenBB 이식) — 단일 객체 반환
    ("sec", "sec", "cik_map", {"symbol": "AAPL"}),
    # YFinanceFetcher (LibraryFetcher 계열)
    ("yahoo", "yahoo", "quote", {"symbol": "AAPL"}),
    # DbFetcher (로컬 sqlite)
    ("db", "db", "stock_list", {}),
    # ComputeFetcher (로컬 DB 시계열 기반 계산) — 단일 객체 반환
    ("quant", "quantitative", "capm", {"symbol": "AAPL"}),
    # 무인증 async ApiFetcher (SDMX)
    ("oecd", "oecd", "gdp_real", {}),
]

# 리스트가 아닌 단일 객체를 반환하는 fetcher — Fetcher.test()의 list 검증 대신 직접 검증
SINGLE_RESULT = {"cik_map", "capm"}


def main() -> int:
    only = set(sys.argv[1:])
    failures = []
    for name, provider, key, params in CASES:
        if only and name not in only:
            continue
        fetcher_cls = ProviderRegistry.get_all()[provider].fetcher_dict[key]
        label = f"{provider}/{key} ({fetcher_cls.__name__})"
        print(f"\n=== {label} params={params}")
        try:
            if key in SINGLE_RESULT:
                result = fetcher_cls.fetch_data_sync(params)
                assert result is not None, "Result must not be None"
                print(f"✓ {fetcher_cls.__name__} test passed!\n  - Result: {result}")
            else:
                fetcher_cls.test(params)
        except Exception:
            traceback.print_exc()
            failures.append(label)

    print(f"\n{'FAIL: ' + ', '.join(failures) if failures else 'ALL PASS'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
