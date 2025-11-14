"""
데이터 조회 CLI

카테고리별로 데이터를 선택하고, 병합하여 조회할 수 있는 CLI 인터페이스
"""
import sys
import io
from pathlib import Path

# Windows 콘솔 인코딩 설정
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 프로젝트 루트를 sys.path에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from typing import List, Dict, Any, Optional
import pandas as pd
from datetime import datetime, timedelta

from app.services.unified_data_fetcher import get_unified_fetcher, DataCategory
from app.core.config import settings


class DataCLI:
    """데이터 조회 CLI"""

    def __init__(self):
        self.fetcher = get_unified_fetcher()
        self.selected_data: List[Dict[str, Any]] = []
        self.running = True

    def clear_screen(self):
        """화면 클리어 (Windows/Unix 호환)"""
        import os
        os.system('cls' if os.name == 'nt' else 'clear')

    def print_header(self, title: str):
        """헤더 출력"""
        print("\n" + "=" * 80)
        print(f"  {title}")
        print("=" * 80 + "\n")

    def print_menu(self, title: str, options: Dict[str, str], show_back: bool = True):
        """메뉴 출력"""
        print(f"\n{title}")
        print("-" * 80)
        for key, value in options.items():
            print(f"  [{key}] {value}")
        if show_back:
            print(f"  [0] 이전 메뉴")
        print()

    def show_main_menu(self):
        """메인 메뉴"""
        self.print_header("MarketPulse 데이터 조회 시스템")

        print(f"API 상태:")
        print(f"  FRED API Key: {'✅ 설정됨' if settings.FRED_API_KEY else '❌ 없음'}")
        print(f"  Alpha Vantage API Key: {'✅ 설정됨' if settings.ALPHAVANTAGE_API_KEY else '❌ 없음'}")
        print(f"  선택된 데이터셋: {len(self.selected_data)}개\n")

        options = {
            '1': '거시경제 지표 조회 (FRED)',
            '2': '기업 재무 데이터 조회 (Yahoo Finance)',
            '3': '종목 분석 (재무비율 + 기술지표)',
            '4': '신용 시장 지표',
            '5': '투자 분석 (README 시나리오)',
            '6': '선택한 데이터 확인 및 병합',
            '7': '데이터 초기화',
            'q': '종료'
        }

        self.print_menu("메인 메뉴", options, show_back=False)

    def select_macro_indicators(self):
        """거시경제 지표 선택"""
        self.print_header("거시경제 지표 선택")

        indicators_map = {
            '1': ('gdp_growth', 'GDP 성장률'),
            '2': ('unemployment_rate', '실업률'),
            '3': ('cpi', '소비자 물가지수 (CPI)'),
            '4': ('core_pce', '핵심 PCE 물가지수'),
            '5': ('fed_funds_rate', '연방기금금리'),
            '6': ('treasury_10y', '10년 국채 수익률'),
            '7': ('treasury_2y', '2년 국채 수익률'),
            '8': ('m2', 'M2 통화 공급량'),
            '9': ('baa_spread', 'BAA 신용 스프레드'),
            '10': ('consumer_sentiment', '소비자 심리지수')
        }

        print("조회할 지표를 선택하세요 (쉼표로 구분, 예: 1,2,3):")
        for key, (code, name) in indicators_map.items():
            print(f"  [{key}] {name}")
        print()

        choice = input("선택 (Enter=모두 선택): ").strip()

        if not choice:
            # 모두 선택
            selected_indicators = [code for code, name in indicators_map.values()]
        else:
            selected_keys = [k.strip() for k in choice.split(',')]
            selected_indicators = [indicators_map[k][0] for k in selected_keys if k in indicators_map]

        if not selected_indicators:
            print("❌ 선택된 지표가 없습니다.")
            input("\nEnter를 눌러 계속...")
            return

        print(f"\n조회 중... ({len(selected_indicators)}개 지표)")

        try:
            data = self.fetcher.get_macro_indicators(
                indicators=selected_indicators,
                limit=10
            )

            if data and 'data' in data:
                self.selected_data.append({
                    'category': 'macro_economic',
                    'name': f"거시경제 지표 ({len(selected_indicators)}개)",
                    'data': data,
                    'fetched_at': datetime.now().isoformat()
                })

                print(f"✅ 데이터 조회 완료!")
                self._display_macro_data(data)

            else:
                print("❌ 데이터 조회 실패")

        except Exception as e:
            print(f"❌ 에러: {e}")

        input("\nEnter를 눌러 계속...")

    def _display_macro_data(self, data: Dict):
        """거시경제 데이터 표시"""
        print(f"\n조회 시간: {data['fetched_at']}")
        print(f"데이터 소스: {data['source']}\n")

        if 'data' in data:
            for indicator, indicator_data in data['data'].items():
                if indicator_data and 'latest_value' in indicator_data:
                    latest = indicator_data['latest_value']
                    print(f"  {indicator:25} : {latest['value']:>10} ({latest['date']})")

    def select_company_financials(self):
        """기업 재무 데이터 선택"""
        self.print_header("기업 재무 데이터 조회")

        symbol = input("종목 코드 입력 (예: AAPL, MSFT, ORCL): ").strip().upper()

        if not symbol:
            print("❌ 종목 코드를 입력하세요.")
            input("\nEnter를 눌러 계속...")
            return

        print(f"\n{symbol} 데이터 조회 중...")

        try:
            data = self.fetcher.get_company_financials(symbol)

            if data and 'comprehensive' in data:
                self.selected_data.append({
                    'category': 'company_financials',
                    'name': f"{symbol} 재무 데이터",
                    'symbol': symbol,
                    'data': data,
                    'fetched_at': datetime.now().isoformat()
                })

                print(f"✅ 데이터 조회 완료!")
                self._display_company_financials(data)

            else:
                print("❌ 데이터 조회 실패")

        except Exception as e:
            print(f"❌ 에러: {e}")

        input("\nEnter를 눌러 계속...")

    def _display_company_financials(self, data: Dict):
        """기업 재무 데이터 표시"""
        if 'comprehensive' not in data:
            return

        comp = data['comprehensive']
        print(f"\n기업명: {comp['company_name']}")
        print(f"섹터: {comp['sector']}")
        print(f"산업: {comp['industry']}")

        if 'profitability' in comp:
            print("\n[ 수익성 지표 ]")
            prof = comp['profitability']
            if prof.get('operating_margin'):
                print(f"  영업이익률: {prof['operating_margin']:.2%}")
            if prof.get('profit_margin'):
                print(f"  순이익률: {prof['profit_margin']:.2%}")
            if prof.get('roe'):
                print(f"  ROE: {prof['roe']:.2%}")

        if 'liquidity' in comp:
            print("\n[ 유동성 비율 ]")
            liq = comp['liquidity']
            if liq.get('current_ratio'):
                print(f"  유동비율: {liq['current_ratio']:.2f}")
            if liq.get('quick_ratio'):
                print(f"  당좌비율: {liq['quick_ratio']:.2f}")

    def investment_analysis(self):
        """투자 분석 (README 시나리오)"""
        self.print_header("투자 분석 (README 시나리오)")

        print("분석 유형을 선택하세요:")
        print("  [1] 오라클 투자 분석 (시나리오 2)")
        print("  [2] 데이터센터 운영비용 분석 (시나리오 1)")
        print("  [3] 사용자 정의 종목 분석")
        print()

        choice = input("선택: ").strip()

        if choice == '1':
            symbol = 'ORCL'
            print(f"\n{symbol} 투자 분석 중...")
            self._run_investment_analysis(symbol)

        elif choice == '2':
            symbol = 'NVDA'
            print(f"\n{symbol} 운영비용 분석 중...")
            self._run_operating_cost_analysis(symbol)

        elif choice == '3':
            symbol = input("종목 코드 입력: ").strip().upper()
            if symbol:
                print(f"\n{symbol} 투자 분석 중...")
                self._run_investment_analysis(symbol)

    def _run_investment_analysis(self, symbol: str):
        """투자 분석 실행"""
        try:
            analysis = self.fetcher.analyze_investment_opportunity(symbol)

            self.selected_data.append({
                'category': 'investment_analysis',
                'name': f"{symbol} 투자 분석",
                'symbol': symbol,
                'data': analysis,
                'fetched_at': datetime.now().isoformat()
            })

            print(f"✅ 분석 완료!")
            self._display_investment_analysis(analysis)

        except Exception as e:
            print(f"❌ 에러: {e}")

        input("\nEnter를 눌러 계속...")

    def _display_investment_analysis(self, analysis: Dict):
        """투자 분석 결과 표시"""
        print(f"\n기업: {analysis['symbol']}")

        if 'key_ratios' in analysis:
            ratios = analysis['key_ratios']

            print("\n[ 유동성 ]")
            liq = ratios.get('liquidity', {})
            print(f"  유동비율: {liq.get('current_ratio', 'N/A')}")

            print("\n[ 수익성 ]")
            prof = ratios.get('profitability', {})
            print(f"  영업이익률: {prof.get('operating_margin', 'N/A')}")
            print(f"  ROE: {prof.get('roe', 'N/A')}")

            print("\n[ 레버리지 ]")
            lev = ratios.get('leverage', {})
            print(f"  부채/자본: {lev.get('debt_to_equity', 'N/A')}")

        if 'investment_summary' in analysis:
            print("\n[ 투자 의견 ]")
            summary = analysis['investment_summary']
            print(f"  유동성: {summary.get('liquidity_assessment', 'N/A')}")
            print(f"  수익성: {summary.get('profitability_assessment', 'N/A')}")
            print(f"  레버리지: {summary.get('leverage_assessment', 'N/A')}")

    def _run_operating_cost_analysis(self, symbol: str):
        """운영비용 분석 실행"""
        try:
            analysis = self.fetcher.compare_operating_costs_vs_profit(symbol)

            self.selected_data.append({
                'category': 'operating_cost_analysis',
                'name': f"{symbol} 운영비용 분석",
                'symbol': symbol,
                'data': analysis,
                'fetched_at': datetime.now().isoformat()
            })

            print(f"✅ 분석 완료!")

            if 'operating_data' in analysis:
                opdata = analysis['operating_data']
                print(f"\n[ 운영 데이터 ]")
                print(f"  총 매출: ${opdata.get('total_revenue', 0):,.0f}")
                print(f"  운영비용: ${opdata.get('operating_expense', 0):,.0f}")
                print(f"  영업이익: ${opdata.get('operating_income', 0):,.0f}")
                print(f"  영업이익률: {opdata.get('operating_margin', 0):.2%}")

        except Exception as e:
            print(f"❌ 에러: {e}")

        input("\nEnter를 눌러 계속...")

    def view_selected_data(self):
        """선택한 데이터 확인 및 병합"""
        self.print_header("선택한 데이터 확인")

        if not self.selected_data:
            print("선택된 데이터가 없습니다.")
            input("\nEnter를 눌러 계속...")
            return

        print(f"총 {len(self.selected_data)}개의 데이터셋이 선택되었습니다:\n")

        for idx, dataset in enumerate(self.selected_data, 1):
            print(f"  [{idx}] {dataset['name']} (카테고리: {dataset['category']})")
            print(f"      조회 시간: {dataset['fetched_at']}")

        print("\n옵션:")
        print("  [1] 데이터 병합 및 비교")
        print("  [2] 개별 데이터 상세 보기")
        print("  [3] CSV로 내보내기")
        print("  [0] 이전 메뉴")

        choice = input("\n선택: ").strip()

        if choice == '1':
            self.merge_data()
        elif choice == '2':
            self.view_detail()
        elif choice == '3':
            self.export_csv()

    def merge_data(self):
        """데이터 병합"""
        print("\n데이터 병합 중...")

        # 같은 카테고리끼리 그룹화
        categories = {}
        for dataset in self.selected_data:
            cat = dataset['category']
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(dataset)

        print(f"\n병합 가능한 카테고리: {len(categories)}개\n")

        for cat, datasets in categories.items():
            print(f"[ {cat} ] - {len(datasets)}개 데이터셋")

            if cat == 'company_financials':
                # 기업 재무 데이터 비교
                self._merge_company_financials(datasets)
            elif cat == 'macro_economic':
                # 거시경제 지표 병합
                self._merge_macro_indicators(datasets)

        input("\nEnter를 눌러 계속...")

    def _merge_company_financials(self, datasets: List[Dict]):
        """기업 재무 데이터 병합 및 비교"""
        print("\n기업 재무 데이터 비교:\n")

        # 비교 테이블 생성
        companies = []
        metrics = {
            'P/E Ratio': [],
            'ROE': [],
            '순이익률': [],
            '유동비율': [],
            '부채/자본': []
        }

        for dataset in datasets:
            symbol = dataset.get('symbol', 'N/A')
            companies.append(symbol)

            data = dataset['data']
            if 'ratios' in data:
                ratios = data['ratios']
                metrics['P/E Ratio'].append(ratios.get('pe_ratio', 'N/A'))
                metrics['ROE'].append(ratios.get('roe', 'N/A'))
                metrics['순이익률'].append(ratios.get('profit_margin', 'N/A'))
                metrics['유동비율'].append(ratios.get('current_ratio', 'N/A'))
                metrics['부채/자본'].append(ratios.get('debt_to_equity', 'N/A'))

        # 테이블 출력
        print(f"{'지표':<15}", end='')
        for company in companies:
            print(f"{company:>15}", end='')
        print()
        print("-" * (15 + 15 * len(companies)))

        for metric_name, values in metrics.items():
            print(f"{metric_name:<15}", end='')
            for value in values:
                if isinstance(value, (int, float)):
                    print(f"{value:>15.4f}", end='')
                else:
                    print(f"{str(value):>15}", end='')
            print()

    def _merge_macro_indicators(self, datasets: List[Dict]):
        """거시경제 지표 병합"""
        print("\n거시경제 지표 시계열 데이터")

        all_indicators = {}
        for dataset in datasets:
            if 'data' in dataset['data'] and 'data' in dataset['data']['data']:
                for indicator, indicator_data in dataset['data']['data'].items():
                    if indicator not in all_indicators:
                        all_indicators[indicator] = indicator_data

        print(f"\n총 {len(all_indicators)}개 지표\n")
        for indicator, data in all_indicators.items():
            if data and 'latest_value' in data:
                latest = data['latest_value']
                print(f"  {indicator}: {latest['value']} ({latest['date']})")

    def view_detail(self):
        """개별 데이터 상세 보기"""
        print("\n보고 싶은 데이터셋 번호를 입력하세요:")
        for idx, dataset in enumerate(self.selected_data, 1):
            print(f"  [{idx}] {dataset['name']}")

        choice = input("\n선택: ").strip()

        try:
            idx = int(choice) - 1
            if 0 <= idx < len(self.selected_data):
                dataset = self.selected_data[idx]
                print(f"\n{dataset['name']} 상세 정보:")
                print(f"카테고리: {dataset['category']}")
                print(f"조회 시간: {dataset['fetched_at']}\n")
                # 전체 데이터 출력 (간략화)
                import json
                print(json.dumps(dataset['data'], indent=2, ensure_ascii=False, default=str)[:2000])
            else:
                print("❌ 잘못된 번호입니다.")
        except ValueError:
            print("❌ 숫자를 입력하세요.")

        input("\nEnter를 눌러 계속...")

    def export_csv(self):
        """CSV로 내보내기"""
        print("\nCSV 내보내기 기능 (준비 중)")
        input("\nEnter를 눌러 계속...")

    def clear_data(self):
        """선택한 데이터 초기화"""
        self.selected_data.clear()
        print("✅ 선택한 데이터가 초기화되었습니다.")
        input("\nEnter를 눌러 계속...")

    def run(self):
        """CLI 실행"""
        while self.running:
            self.show_main_menu()
            choice = input("선택: ").strip()

            if choice == '1':
                self.select_macro_indicators()
            elif choice == '2':
                self.select_company_financials()
            elif choice == '3':
                print("\n종목 분석 기능 (준비 중)")
                input("\nEnter를 눌러 계속...")
            elif choice == '4':
                print("\n신용 시장 지표 기능 (준비 중)")
                input("\nEnter를 눌러 계속...")
            elif choice == '5':
                self.investment_analysis()
            elif choice == '6':
                self.view_selected_data()
            elif choice == '7':
                self.clear_data()
            elif choice.lower() == 'q':
                print("\n프로그램을 종료합니다.")
                self.running = False
            else:
                print("❌ 잘못된 선택입니다.")
                input("\nEnter를 눌러 계속...")


def main():
    """메인 함수"""
    cli = DataCLI()
    cli.run()


if __name__ == "__main__":
    main()
