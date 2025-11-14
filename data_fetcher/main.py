"""
Data Fetcher CLI

CLI 인터페이스 및 API 서버
"""
import sys
import argparse
from data_fetcher.router import get_data_router


def cli():
    """CLI 엔트리포인트"""
    parser = argparse.ArgumentParser(description='Data Fetcher CLI')
    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # short-interest 명령
    short_parser = subparsers.add_parser('short-interest', help='공매도 데이터 조회')
    short_parser.add_argument('symbol', help='종목 코드 (예: TSLA)')

    # gdp 명령
    gdp_parser = subparsers.add_parser('gdp', help='GDP 데이터 조회')
    gdp_parser.add_argument('--start-date', help='시작일 (YYYY-MM-DD)')
    gdp_parser.add_argument('--end-date', help='종료일 (YYYY-MM-DD)')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    router = get_data_router()

    if args.command == 'short-interest':
        data = router.get_short_interest(args.symbol)
        if data:
            d = data[0]
            print(f"\n{d.company_name} ({d.symbol})")
            print(f"공매도 주식 수: {d.shares_short:,}")
            print(f"공매도 비율: {d.short_percent_of_float * 100:.2f}%")
            print(f"Short Ratio: {d.short_ratio:.2f}일")

    elif args.command == 'gdp':
        print("GDP 데이터 조회 (준비 중)")

    else:
        print(f"Unknown command: {args.command}")
        sys.exit(1)


if __name__ == '__main__':
    cli()
