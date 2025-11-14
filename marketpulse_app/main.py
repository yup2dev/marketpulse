"""
MarketPulse CLI

메인 엔트리포인트
"""
import sys
import argparse


def cli():
    """CLI 엔트리포인트"""
    parser = argparse.ArgumentParser(description='MarketPulse')
    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # view-data 명령
    view_data_parser = subparsers.add_parser('view-data', help='데이터 조회')
    view_data_parser.add_argument('symbol', help='종목 코드 (예: TSLA)')

    # view-news 명령
    view_news_parser = subparsers.add_parser('view-news', help='뉴스 조회')
    view_news_parser.add_argument('--limit', type=int, default=10, help='조회 개수')

    # chart 명령
    chart_parser = subparsers.add_parser('chart', help='차트 생성')
    chart_parser.add_argument('symbol', help='종목 코드')
    chart_parser.add_argument('--period', default='1m', help='기간 (예: 1m, 3m, 1y)')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    if args.command == 'view-data':
        from marketpulse_app.presentation.cli.data_viewer import view_data
        view_data(args.symbol)

    elif args.command == 'view-news':
        print("뉴스 조회 (준비 중)")

    elif args.command == 'chart':
        print(f"{args.symbol} 차트 생성 (준비 중)")

    else:
        print(f"Unknown command: {args.command}")
        sys.exit(1)


if __name__ == '__main__':
    cli()
