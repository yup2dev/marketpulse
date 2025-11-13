"""
Financial Metrics CLI Tool

터미널에서 실행하는 재무지표 조회 및 차트 생성 도구

Usage:
    python scripts/financial_cli.py fetch AAPL
    python scripts/financial_cli.py chart AAPL,MSFT,GOOGL --metric debt_to_asset
    python scripts/financial_cli.py radar AAPL
    python scripts/financial_cli.py cds
"""
import sys
import os
from pathlib import Path

# 프로젝트 루트를 Python path에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import argparse
import logging
from datetime import datetime
from app.models.database import SessionLocal, MBS_IN_FINANCIAL_METRICS, generate_batch_id
from app.services.financial_fetcher import get_financial_fetcher
from app.services.chart_generator import get_chart_generator

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
log = logging.getLogger(__name__)


def fetch_command(args):
    """재무지표 수집 명령"""
    ticker = args.ticker.upper()
    log.info(f"Fetching financial metrics for {ticker}...")

    try:
        # 데이터 수집
        fetcher = get_financial_fetcher()
        metrics_data = fetcher.fetch_financial_metrics(ticker)

        if not metrics_data:
            log.error(f"Could not fetch data for {ticker}")
            return

        # DB 저장
        db = SessionLocal()
        try:
            batch_id = generate_batch_id()
            metrics = MBS_IN_FINANCIAL_METRICS(
                stk_cd=metrics_data['stk_cd'],
                stk_nm=metrics_data['stk_nm'],
                debt_to_asset=metrics_data.get('debt_to_asset'),
                debt_to_equity=metrics_data.get('debt_to_equity'),
                current_ratio=metrics_data.get('current_ratio'),
                quick_ratio=metrics_data.get('quick_ratio'),
                roe=metrics_data.get('roe'),
                roa=metrics_data.get('roa'),
                profit_margin=metrics_data.get('profit_margin'),
                pe_ratio=metrics_data.get('pe_ratio'),
                pb_ratio=metrics_data.get('pb_ratio'),
                market_cap=metrics_data.get('market_cap'),
                fiscal_period=metrics_data.get('fiscal_period'),
                base_ymd=metrics_data['base_ymd'],
                ingest_batch_id=batch_id
            )

            db.add(metrics)
            db.commit()

            log.info(f"✓ Successfully saved financial metrics for {ticker}")

            # 결과 출력
            print("\n" + "="*60)
            print(f"  {ticker} - {metrics_data['stk_nm']}")
            print("="*60)
            print(f"부채/자산 비율:  {metrics_data.get('debt_to_asset', 'N/A')}")
            print(f"부채/자본 비율:  {metrics_data.get('debt_to_equity', 'N/A')}")
            print(f"유동비율:        {metrics_data.get('current_ratio', 'N/A')}")
            print(f"ROE:             {metrics_data.get('roe', 'N/A')}")
            print(f"ROA:             {metrics_data.get('roa', 'N/A')}")
            print(f"순이익률:        {metrics_data.get('profit_margin', 'N/A')}")
            print(f"PER:             {metrics_data.get('pe_ratio', 'N/A')}")
            print(f"PBR:             {metrics_data.get('pb_ratio', 'N/A')}")
            print(f"시가총액:        {metrics_data.get('market_cap', 'N/A')}")
            print("="*60 + "\n")

        finally:
            db.close()

    except Exception as e:
        log.error(f"Error: {e}")


def chart_command(args):
    """재무지표 비교 차트 생성 명령"""
    tickers = [t.strip().upper() for t in args.tickers.split(',')]
    metric = args.metric
    log.info(f"Creating comparison chart for {', '.join(tickers)}...")

    try:
        # DB에서 데이터 조회
        db = SessionLocal()
        try:
            metrics_data = []
            for ticker in tickers:
                m = db.query(MBS_IN_FINANCIAL_METRICS).filter(
                    MBS_IN_FINANCIAL_METRICS.stk_cd == ticker
                ).order_by(MBS_IN_FINANCIAL_METRICS.base_ymd.desc()).first()

                if m:
                    metrics_data.append(m.to_dict())
                else:
                    log.warning(f"No data found for {ticker}")

            if not metrics_data:
                log.error("No data available for any ticker")
                return

            # 차트 생성
            chart_gen = get_chart_generator()
            output_file = chart_gen.create_financial_metrics_comparison_chart(
                metrics_data, metric
            )

            if output_file:
                print("\n" + "="*60)
                print(f"  Chart saved successfully!")
                print("="*60)
                print(f"Tickers: {', '.join(tickers)}")
                print(f"Metric:  {metric}")
                print(f"File:    {output_file}")
                print("="*60 + "\n")
                log.info(f"✓ Chart saved to {output_file}")
            else:
                log.error("Failed to create chart")

        finally:
            db.close()

    except Exception as e:
        log.error(f"Error: {e}")


def radar_command(args):
    """재무건전성 레이더 차트 생성 명령"""
    ticker = args.ticker.upper()
    log.info(f"Creating radar chart for {ticker}...")

    try:
        # DB에서 데이터 조회
        db = SessionLocal()
        try:
            metrics = db.query(MBS_IN_FINANCIAL_METRICS).filter(
                MBS_IN_FINANCIAL_METRICS.stk_cd == ticker
            ).order_by(MBS_IN_FINANCIAL_METRICS.base_ymd.desc()).first()

            if not metrics:
                log.error(f"No data found for {ticker}")
                return

            # 차트 생성
            chart_gen = get_chart_generator()
            output_file = chart_gen.create_multi_metric_radar_chart(
                metrics.to_dict(), ticker
            )

            if output_file:
                print("\n" + "="*60)
                print(f"  Radar Chart saved successfully!")
                print("="*60)
                print(f"Ticker: {ticker}")
                print(f"File:   {output_file}")
                print("="*60 + "\n")
                log.info(f"✓ Chart saved to {output_file}")
            else:
                log.error("Failed to create chart")

        finally:
            db.close()

    except Exception as e:
        log.error(f"Error: {e}")


def cds_command(args):
    """CDS 프리미엄/신용 스프레드 차트 생성 명령"""
    log.info("Fetching credit spread indicators...")

    try:
        # 데이터 수집
        fetcher = get_financial_fetcher()
        credit_data = fetcher.fetch_credit_spread_indicators()

        if not credit_data:
            log.error("Could not fetch credit spread data")
            return

        # 차트 생성
        chart_gen = get_chart_generator()
        output_file = chart_gen.create_credit_spread_chart(credit_data)

        if output_file:
            print("\n" + "="*60)
            print(f"  Credit Spread Chart saved successfully!")
            print("="*60)
            print(f"Note: {credit_data.get('note', 'N/A')}")
            print(f"File: {output_file}")
            print("="*60 + "\n")
            log.info(f"✓ Chart saved to {output_file}")
        else:
            log.error("Failed to create chart")

    except Exception as e:
        log.error(f"Error: {e}")


def main():
    """메인 함수"""
    parser = argparse.ArgumentParser(
        description="Financial Metrics CLI Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # 재무지표 수집
  python scripts/financial_cli.py fetch AAPL

  # 비교 차트 생성
  python scripts/financial_cli.py chart AAPL,MSFT,GOOGL --metric debt_to_asset

  # 레이더 차트 생성
  python scripts/financial_cli.py radar AAPL

  # CDS/신용스프레드 차트
  python scripts/financial_cli.py cds
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # fetch 명령
    fetch_parser = subparsers.add_parser('fetch', help='Fetch financial metrics')
    fetch_parser.add_argument('ticker', help='Stock ticker (e.g., AAPL)')

    # chart 명령
    chart_parser = subparsers.add_parser('chart', help='Create comparison chart')
    chart_parser.add_argument('tickers', help='Comma-separated tickers (e.g., AAPL,MSFT,GOOGL)')
    chart_parser.add_argument('--metric', default='debt_to_asset',
                             choices=['debt_to_asset', 'debt_to_equity', 'current_ratio',
                                     'roe', 'roa', 'profit_margin', 'pe_ratio', 'pb_ratio'],
                             help='Metric to compare')

    # radar 명령
    radar_parser = subparsers.add_parser('radar', help='Create radar chart')
    radar_parser.add_argument('ticker', help='Stock ticker (e.g., AAPL)')

    # cds 명령
    cds_parser = subparsers.add_parser('cds', help='Create CDS/credit spread chart')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    # 명령 실행
    if args.command == 'fetch':
        fetch_command(args)
    elif args.command == 'chart':
        chart_command(args)
    elif args.command == 'radar':
        radar_command(args)
    elif args.command == 'cds':
        cds_command(args)


if __name__ == '__main__':
    main()
