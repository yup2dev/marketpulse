"""Standard Model: COT Positioning (CFTC Commitments of Traders 순포지션)

CFTC가 매주 금요일 공표하는 선물 포지션 집계. 한 행 = 한 주(화요일 기준일).

엔 캐리 트레이드 맥락에서는 `JAPANESE YEN` 계약의 **비상업(non-commercial, 투기)
순포지션**이 IMM 스펙 포지션으로 통용된다. 순숏이 크게 쌓여 있다가 빠르게 축소되면
캐리 언와인드가 진행 중이라는 신호로 읽는다.

⚠️ 한계 (지표를 읽기 전에 반드시 인지할 것):
  1. **후행 지표** — 기준일은 화요일인데 공표는 금요일 15:30 ET다. 최소 3영업일,
     실질적으로는 최대 1주 늦다. 급변 국면에서는 이미 지나간 그림을 본다.
  2. **커버리지 한계** — 대형 매크로 헤지펀드는 CME 선물이 아니라 은행 간 FX 포워드/
     스왑/옵션으로 캐리를 실행한다. 이쪽은 CFTC 보고 대상이 전혀 아니다. 따라서 IMM
     순포지션은 캐리 포지션 전체가 아니라 **관찰 가능한 일부의 대리변수**다.
  3. 비상업 분류는 자기신고 기반이라 실수요 헤지와 투기가 완벽히 갈리지 않는다.

그래서 이 모델은 절대 수준(`net_noncomm`)보다 **변화 속도**(`net_change_1w`,
`net_change_4w`)와 **과거 대비 극단성**(`net_zscore`)을 함께 제공한다. 언와인드
판단은 수준이 아니라 속도에서 나온다.
"""
from datetime import date as date_type
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class CotPositioningQueryParams(BaseQueryParams):
    """COT 순포지션 조회 표준 파라미터"""

    contract: str = Field(
        default="JAPANESE YEN",
        description="CFTC 계약명 (정확히 일치해야 함. 예: 'JAPANESE YEN', 'EURO FX')",
    )
    weeks: int = Field(
        default=104,
        description="반환할 최근 주 수. **start_date가 주어지면 무시된다**(날짜 구간이 우선)",
    )
    start_date: Optional[date_type] = Field(
        default=None,
        description="구간 시작일. 지정 시 weeks 대신 날짜로 자른다. "
                    "파생값(4주 변화·z-score)은 이 날짜 이전 구간까지 조회해 계산하므로 "
                    "구간 첫 행부터 값이 채워진다",
    )
    end_date: Optional[date_type] = Field(default=None, description="구간 종료일")


class CotPositioningData(BaseData):
    """주간 COT 순포지션 (한 행 = 한 주)"""

    report_date: Optional[str] = Field(default=None, description="보고 기준일 = 화요일 (YYYY-MM-DD)")
    contract: Optional[str] = Field(default=None, description="계약명")

    open_interest: Optional[int] = Field(default=None, description="총 미결제약정 (계약 수)")

    noncomm_long: Optional[int] = Field(default=None, description="비상업(투기) 롱 (계약 수)")
    noncomm_short: Optional[int] = Field(default=None, description="비상업(투기) 숏 (계약 수)")
    noncomm_spread: Optional[int] = Field(default=None, description="비상업 스프레드 (계약 수)")
    net_noncomm: Optional[int] = Field(
        default=None,
        description="비상업 순포지션 = 롱 − 숏 (계약 수). 음수 = 순숏 = 엔 약세 베팅",
    )
    net_noncomm_pct_oi: Optional[float] = Field(
        default=None, description="순포지션 / 미결제약정 (%) — 계약 규모 변화에 중립적인 정규화 지표"
    )

    comm_long: Optional[int] = Field(default=None, description="상업(헤지) 롱 (계약 수)")
    comm_short: Optional[int] = Field(default=None, description="상업(헤지) 숏 (계약 수)")
    net_comm: Optional[int] = Field(default=None, description="상업 순포지션 = 롱 − 숏 (계약 수)")

    net_change_1w: Optional[int] = Field(
        default=None,
        description="순포지션 주간 변화 (계약 수). 순숏 축소 = 양수. **언와인드 속도의 핵심 지표**",
    )
    net_change_4w: Optional[int] = Field(
        default=None, description="순포지션 4주 변화 (계약 수) — 단주 노이즈를 걸러낸 추세"
    )
    net_zscore: Optional[float] = Field(
        default=None,
        description="순포지션의 과거 구간 대비 z-score (기본 156주). |z|>2 면 포지션 쏠림 극단",
    )
