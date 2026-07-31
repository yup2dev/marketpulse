"""Standard Model: Fund Performance (펀드 분기별 추정 수익률)

13F 공시 기관의 **보유종목 기반 추정 수익률**(holdings-based return)의 공통 인터페이스.
한 행 = 한 분기.

⚠️ 이건 펀드의 실제 수익률(NAV 기준)이 아니다. 헤지펀드의 실제 수익률은 LP에게만
사적으로 보고되고 공시 의무가 없어서 어떤 데이터 소스로도 가져올 수 없다. 여기서
계산하는 값은 분기말 13F 스냅샷 2개를 비교해 얻은 근사치이며 다음 한계를 갖는다:

  1. 미국 상장주식 롱 포지션만 대상 — 공매도/채권/현금/해외자산/비상장은 13F 대상이 아님
  2. 파생(Put/Call) 라인 제외 — 13F의 <value>가 옵션 시가가 아닌 기초자산 명목가치라
     수익률로 환산 불가하고, 풋은 기초자산과 손익 부호가 반대다
  3. 분기 중 매매 무시 — 분기말↔분기말 스냅샷만 보므로 인트라쿼터 트레이딩 손익 누락
  4. 레버리지 미반영 — 차입 배수를 알 수 없어 자기자본 수익률과 괴리
  5. 주식분할 시 implied price가 왜곡 → outlier 제외 처리(excluded_positions로 노출)

따라서 `coverage_pct`(추정이 커버한 직전 분기 포트폴리오 비중)와
`derivative_weight_pct`를 반드시 함께 읽어야 한다. 커버리지가 낮으면 그 분기의
`return_pct`는 펀드 전체 성과를 대표하지 못한다.
"""
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class FundPerformanceQueryParams(BaseQueryParams):
    """펀드 추정 수익률 조회 표준 파라미터"""

    institution_key: str = Field(
        description="기관 식별자 (featured 키 예: 'situational-awareness', 'berkshire') 또는 CIK"
    )
    quarters: int = Field(
        default=8,
        description="조회할 최근 분기 수(수익률은 분기쌍 비교라 행 수는 이보다 1 적다)",
    )


class FundPerformanceData(BaseData):
    """분기별 추정 수익률 표준 데이터 (한 행 = 한 분기)"""

    institution_key: Optional[str] = Field(default=None, description="기관 식별자")
    name: Optional[str] = Field(default=None, description="기관명")
    manager: Optional[str] = Field(default=None, description="운용역")

    period: Optional[str] = Field(default=None, description="분기말 기준일 (YYYY-MM-DD)")
    filing_date: Optional[str] = Field(default=None, description="13F 제출일 (YYYY-MM-DD)")

    return_pct: Optional[float] = Field(
        default=None,
        description="해당 분기 보유종목 기반 추정 수익률 (%) — 직전 분기말 대비",
    )
    cumulative_return_pct: Optional[float] = Field(
        default=None, description="최초 산출 분기부터 누적 추정 수익률 (%)"
    )
    aum_change_pct: Optional[float] = Field(
        default=None,
        description="13F 신고 총액 변화율 (%) — 수익률이 아니라 자금 유출입·매매까지 포함된 값",
    )

    total_value: Optional[float] = Field(default=None, description="분기말 13F 신고 총액 ($)")
    num_holdings: Optional[int] = Field(default=None, description="보유 종목 수(보통주 라인)")

    coverage_pct: Optional[float] = Field(
        default=None,
        description="추정이 커버한 직전 분기 포트폴리오 비중 (%) — 낮을수록 신뢰도 낮음",
    )
    derivative_weight_pct: Optional[float] = Field(
        default=None,
        description="분기말 신고액 중 파생(Put/Call) 명목가치 비중 (%) — 수익률 산출에서 제외된 부분",
    )
    matched_positions: Optional[int] = Field(
        default=None, description="두 분기에 모두 존재해 수익률을 산출한 종목 수"
    )
    excluded_positions: Optional[int] = Field(
        default=None, description="분할 등으로 implied price가 튀어 제외한 종목 수"
    )

    top_contributor: Optional[str] = Field(default=None, description="기여도 최대 종목")
    top_contributor_pct: Optional[float] = Field(
        default=None, description="해당 종목의 수익률 기여도 (%p)"
    )
    top_detractor: Optional[str] = Field(default=None, description="기여도 최소 종목")
    top_detractor_pct: Optional[float] = Field(
        default=None, description="해당 종목의 수익률 기여도 (%p)"
    )
