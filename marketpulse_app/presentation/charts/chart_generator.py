"""
Chart Generator Service

Matplotlib를 활용한 터미널 기반 차트 생성
"""
import logging
from typing import List, Dict, Any, Optional
import matplotlib
matplotlib.use('Agg')  # 백엔드를 Agg로 설정 (GUI 불필요)
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import numpy as np
from pathlib import Path

log = logging.getLogger(__name__)


class ChartGenerator:
    """차트 생성기"""

    def __init__(self):
        self.logger = log
        self.output_dir = Path("output")
        self.output_dir.mkdir(exist_ok=True)

        # 한글 폰트 설정
        try:
            plt.rcParams['font.family'] = 'Malgun Gothic'
        except:
            # 한글 폰트가 없으면 기본 폰트 사용
            pass
        plt.rcParams['axes.unicode_minus'] = False

    def create_financial_metrics_comparison_chart(
        self,
        metrics_data: List[Dict[str, Any]],
        metric_name: str = "debt_to_asset"
    ) -> str:
        """
        재무지표 비교 차트 생성 (막대 그래프)

        Args:
            metrics_data: 재무지표 데이터 리스트
            metric_name: 비교할 지표 이름

        Returns:
            저장된 이미지 파일 경로
        """
        try:
            if not metrics_data:
                self.logger.warning("No data available")
                return None

            # 데이터 추출
            tickers = [d['stk_cd'] for d in metrics_data]
            values = [d.get(metric_name, 0) for d in metrics_data]

            # 한글 레이블 매핑
            metric_labels = {
                'debt_to_asset': '부채/자산 비율',
                'debt_to_equity': '부채/자본 비율',
                'current_ratio': '유동비율',
                'roe': 'ROE (%)',
                'roa': 'ROA (%)',
                'profit_margin': '순이익률 (%)',
                'pe_ratio': 'PER',
                'pb_ratio': 'PBR'
            }

            label = metric_labels.get(metric_name, metric_name.upper())

            # 차트 생성
            fig, ax = plt.subplots(figsize=(10, 6))
            bars = ax.bar(tickers, values, color='#3498db', alpha=0.8)

            # 값 레이블 추가
            for bar, value in zip(bars, values):
                height = bar.get_height()
                if value:
                    ax.text(bar.get_x() + bar.get_width()/2., height,
                           f'{value:.2f}',
                           ha='center', va='bottom', fontsize=10)

            ax.set_title(f'{label} 비교', fontsize=16, fontweight='bold', pad=20)
            ax.set_xlabel('종목', fontsize=12)
            ax.set_ylabel(label, fontsize=12)
            ax.grid(axis='y', alpha=0.3, linestyle='--')

            plt.tight_layout()

            # 파일 저장
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = self.output_dir / f"comparison_{metric_name}_{timestamp}.png"
            plt.savefig(output_file, dpi=150, bbox_inches='tight')
            plt.close()

            return str(output_file)

        except Exception as e:
            self.logger.error(f"Error creating comparison chart: {e}")
            return None

    def create_multi_metric_radar_chart(
        self,
        metrics_data: Dict[str, Any],
        ticker: str
    ) -> str:
        """
        재무지표 레이더 차트 생성

        Args:
            metrics_data: 재무지표 데이터
            ticker: 종목 코드

        Returns:
            저장된 이미지 파일 경로
        """
        try:
            # 정규화된 지표 선택 (0-100 스케일)
            categories = ['수익성', '안정성', '유동성', '성장성', '밸류에이션']

            # 각 카테고리별 점수 계산 (간단한 휴리스틱)
            def normalize_score(value, optimal_min, optimal_max):
                """지표를 0-100 점수로 정규화"""
                if value is None:
                    return 0
                if value < optimal_min:
                    return max(0, 100 * value / optimal_min)
                elif value > optimal_max:
                    return max(0, 100 - (value - optimal_max) * 10)
                else:
                    return 100

            # 수익성: ROE (10-20% 최적)
            profitability = normalize_score(
                metrics_data.get('roe', 0) * 100 if metrics_data.get('roe') else 0,
                10, 20
            )

            # 안정성: 부채/자산 비율 (낮을수록 좋음, 0.3-0.5 적정)
            stability = 100 - normalize_score(
                metrics_data.get('debt_to_asset', 0),
                0.3, 0.5
            )

            # 유동성: 유동비율 (1.5-2.0 최적)
            liquidity = normalize_score(
                metrics_data.get('current_ratio', 0),
                1.5, 2.0
            )

            # 성장성: ROA (5-15% 최적)
            growth = normalize_score(
                metrics_data.get('roa', 0) * 100 if metrics_data.get('roa') else 0,
                5, 15
            )

            # 밸류에이션: PER (15-25 적정)
            valuation = 100 - abs(
                normalize_score(metrics_data.get('pe_ratio', 0), 15, 25) - 100
            )

            values = [profitability, stability, liquidity, growth, valuation]

            # 레이더 차트 생성
            angles = np.linspace(0, 2 * np.pi, len(categories), endpoint=False).tolist()
            values_plot = values + [values[0]]  # 닫힌 도형을 만들기 위해
            angles += angles[:1]

            fig, ax = plt.subplots(figsize=(8, 8), subplot_kw=dict(projection='polar'))
            ax.plot(angles, values_plot, 'o-', linewidth=2, color='#3498db', label=ticker)
            ax.fill(angles, values_plot, alpha=0.25, color='#3498db')
            ax.set_xticks(angles[:-1])
            ax.set_xticklabels(categories, fontsize=11)
            ax.set_ylim(0, 100)
            ax.set_yticks([20, 40, 60, 80, 100])
            ax.set_yticklabels(['20', '40', '60', '80', '100'], fontsize=9)
            ax.set_title(f'{ticker} 재무건전성 분석', fontsize=16, fontweight='bold', pad=20)
            ax.legend(loc='upper right', bbox_to_anchor=(1.3, 1.1))
            ax.grid(True, linestyle='--', alpha=0.5)

            plt.tight_layout()

            # 파일 저장
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = self.output_dir / f"radar_{ticker}_{timestamp}.png"
            plt.savefig(output_file, dpi=150, bbox_inches='tight')
            plt.close()

            return str(output_file)

        except Exception as e:
            self.logger.error(f"Error creating radar chart: {e}")
            return None

    def create_credit_spread_chart(
        self,
        credit_data: Dict[str, Any]
    ) -> str:
        """
        신용 스프레드 지표 차트 생성

        Args:
            credit_data: 신용 스프레드 데이터

        Returns:
            저장된 이미지 파일 경로
        """
        try:
            # 지표 및 값
            indicators = ['High Yield ETF', 'Investment Grade ETF', 'VIX']
            prices = [
                credit_data.get('high_yield_etf_price', 0),
                credit_data.get('investment_grade_etf_price', 0),
                credit_data.get('vix', 0)
            ]
            changes = [
                credit_data.get('high_yield_30d_change', 0),
                credit_data.get('investment_grade_30d_change', 0)
            ]

            # 서브플롯 생성
            fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))

            # 현재 가격
            bars1 = ax1.bar(indicators, prices, color='#3498db', alpha=0.8)
            for bar, price in zip(bars1, prices):
                height = bar.get_height()
                ax1.text(bar.get_x() + bar.get_width()/2., height,
                        f'{price:.2f}',
                        ha='center', va='bottom', fontsize=10)
            ax1.set_title('현재 가격/수치', fontsize=14, fontweight='bold')
            ax1.set_ylabel('값', fontsize=11)
            ax1.grid(axis='y', alpha=0.3, linestyle='--')
            ax1.tick_params(axis='x', rotation=15)

            # 변화율
            colors = ['#e74c3c' if c < 0 else '#27ae60' for c in changes]
            bars2 = ax2.bar(indicators[:2], changes, color=colors, alpha=0.8)
            for bar, change in zip(bars2, changes):
                height = bar.get_height()
                ax2.text(bar.get_x() + bar.get_width()/2., height,
                        f'{change:.2f}%',
                        ha='center', va='bottom' if change >= 0 else 'top', fontsize=10)
            ax2.set_title('30일 변화율 (%)', fontsize=14, fontweight='bold')
            ax2.set_ylabel('변화율 (%)', fontsize=11)
            ax2.grid(axis='y', alpha=0.3, linestyle='--')
            ax2.axhline(y=0, color='black', linestyle='-', linewidth=0.5)
            ax2.tick_params(axis='x', rotation=15)

            plt.suptitle('신용 스프레드 지표 (CDS 프리미엄 대리 지표)',
                        fontsize=16, fontweight='bold', y=1.02)
            plt.tight_layout()

            # 파일 저장
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = self.output_dir / f"credit_spread_{timestamp}.png"
            plt.savefig(output_file, dpi=150, bbox_inches='tight')
            plt.close()

            return str(output_file)

        except Exception as e:
            self.logger.error(f"Error creating credit spread chart: {e}")
            return None

    def create_debt_ratio_trend_chart(
        self,
        historical_data: List[Dict[str, Any]],
        ticker: str
    ) -> str:
        """
        부채비율 추세 차트 생성

        Args:
            historical_data: 시계열 재무지표 데이터
            ticker: 종목 코드

        Returns:
            저장된 이미지 파일 경로
        """
        try:
            if not historical_data:
                self.logger.warning("No historical data available")
                return None

            # 데이터 정렬 (날짜 순)
            sorted_data = sorted(historical_data, key=lambda x: x['base_ymd'])

            dates = [d['base_ymd'] for d in sorted_data]
            debt_to_asset = [d.get('debt_to_asset', 0) for d in sorted_data]
            debt_to_equity = [d.get('debt_to_equity', 0) for d in sorted_data]

            # 차트 생성
            fig, ax = plt.subplots(figsize=(12, 6))

            ax.plot(dates, debt_to_asset, 'o-', linewidth=2, markersize=6,
                   color='#3498db', label='부채/자산 비율')
            ax.plot(dates, debt_to_equity, 's-', linewidth=2, markersize=6,
                   color='#e74c3c', label='부채/자본 비율')

            ax.set_title(f'{ticker} 부채비율 추세', fontsize=16, fontweight='bold', pad=20)
            ax.set_xlabel('날짜', fontsize=12)
            ax.set_ylabel('비율', fontsize=12)
            ax.legend(loc='best', fontsize=11)
            ax.grid(True, alpha=0.3, linestyle='--')
            plt.xticks(rotation=45, ha='right')
            plt.tight_layout()

            # 파일 저장
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = self.output_dir / f"debt_trend_{ticker}_{timestamp}.png"
            plt.savefig(output_file, dpi=150, bbox_inches='tight')
            plt.close()

            return str(output_file)

        except Exception as e:
            self.logger.error(f"Error creating debt ratio trend chart: {e}")
            return None


# Singleton instance
_chart_generator_instance = None


def get_chart_generator() -> ChartGenerator:
    """Chart Generator 싱글톤 인스턴스 반환"""
    global _chart_generator_instance
    if _chart_generator_instance is None:
        _chart_generator_instance = ChartGenerator()
    return _chart_generator_instance
