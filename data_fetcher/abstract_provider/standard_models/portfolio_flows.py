"""Standard Model: Portfolio Flows (대외·대내 증권투자 주간 플로우)

일본 재무성(MOF)이 매주 목요일 공표하는 「対外及び対内証券売買契約等の状況(週次)」.
지정보고기관(대형 은행·증권·생보·신탁 등) 기준이라 일본 기관투자자 자금 흐름의
사실상 유일한 고빈도 공식 통계다. 한 행 = 한 주.

엔 캐리 맥락에서 왜 중요한가:
  IMM 선물 포지션(→ [[cot_positioning]])은 헤지펀드의 **빠른 돈**이고, 이 통계의
  「대외 중장기채 순매매」는 생보·연금·은행의 **느린 돈(sticky money)**이다. 빠른 돈은
  자주 뒤집히지만 느린 돈은 한 번 방향을 틀면 오래 간다. 일본 투자자의 중장기 외채
  순매도가 여러 주 연속되면 구조적 본국 송금(repatriation)이며, 이게 캐리 언와인드의
  진짜 임계점이다.

부호 규약 (MOF 원문 Note 3):
  **플러스(+) = 취득초과(net acquisition), 마이너스(−) = 처분초과(net disposition).**
  즉 `assets_lt_debt_net`이 음수면 일본 투자자가 외국 중장기채를 **순매도**한 것이고,
  이는 엔 매수(본국 송금) 압력이다.

⚠️ 한계:
  1. **주간 공표 시차** — 기준 주 종료 후 그 주 목요일 공표. 최대 ~10일 지연.
  2. **2014년 1월 구조 변화** — 오픈엔드형 계약형 투자신탁이 「중장기채」에서
     「주식·투자펀드지분」으로 재분류됐다. 2014년 전후 중장기채 시계열을 직접 비교하면
     안 된다(원문 Note 1).
  3. **지정보고기관 한정** — 전체 일본 투자자가 아니라 대형 지정기관만 집계한다.
  4. **환헤지 여부 불명** — 외채 매수가 환헤지부라면 엔 매도 압력이 아니다. 이 통계만으로
     엔 수급 방향을 단정할 수 없고, 방향 전환의 '규모와 지속성'을 보는 용도다.
  5. 단위는 억엔(100 million JPY). 반올림 때문에 소계 합이 안 맞을 수 있다(원문 Note 2).
"""
from datetime import date as date_type
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class PortfolioFlowsQueryParams(BaseQueryParams):
    """증권투자 주간 플로우 조회 표준 파라미터"""

    weeks: int = Field(
        default=104,
        description="반환할 최근 주 수. **start_date가 주어지면 무시된다**(날짜 구간이 우선)",
    )
    start_date: Optional[date_type] = Field(
        default=None,
        description="구간 시작일(집계 주 시작일 기준). 원본은 2005년 첫 주부터. "
                    "파생값(4주 합계·연속 순매도 주수)은 전체 시계열에서 계산한 뒤 자르므로 "
                    "구간을 좁혀도 값이 달라지지 않는다",
    )
    end_date: Optional[date_type] = Field(default=None, description="구간 종료일")


class PortfolioFlowsData(BaseData):
    """주간 증권투자 플로우 (한 행 = 한 주). 단위: 억엔(100M JPY). +취득초과 / −처분초과"""

    period_start: Optional[str] = Field(default=None, description="집계 주 시작일 (YYYY-MM-DD)")
    period_label: Optional[str] = Field(default=None, description="원문 기간 표기 (예: '2026．8．2〜8．8')")

    # ── 1. 대외증권투자 (Portfolio Investment Assets) — 거주자의 외국 증권 취득·처분 ──
    assets_equity_net: Optional[float] = Field(
        default=None, description="대외 주식·투자펀드지분 순매매 (억엔)"
    )
    assets_lt_debt_net: Optional[float] = Field(
        default=None,
        description="**대외 중장기채 순매매 (억엔) — sticky money 핵심 지표.** "
                    "음수 = 일본 투자자의 외국 중장기채 순매도 = 본국 송금 압력",
    )
    assets_st_debt_net: Optional[float] = Field(
        default=None, description="대외 단기채 순매매 (억엔) — 변동이 커 신호로는 약함"
    )
    assets_total_net: Optional[float] = Field(
        default=None, description="대외증권투자 합계 순매매 (억엔)"
    )

    # ── 2. 대내증권투자 (Portfolio Investment Liabilities) — 비거주자의 일본 증권 취득·처분 ──
    liab_equity_net: Optional[float] = Field(
        default=None, description="대내 주식·투자펀드지분 순매매 (억엔) — 외국인의 일본주 순매수"
    )
    liab_lt_debt_net: Optional[float] = Field(
        default=None, description="대내 중장기채 순매매 (억엔)"
    )
    liab_st_debt_net: Optional[float] = Field(
        default=None, description="대내 단기채 순매매 (억엔)"
    )
    liab_total_net: Optional[float] = Field(
        default=None, description="대내증권투자 합계 순매매 (억엔)"
    )

    # ── 파생 지표 ────────────────────────────────────────────────────────────
    assets_lt_debt_net_4w: Optional[float] = Field(
        default=None, description="대외 중장기채 순매매 4주 합계 (억엔) — 주간 노이즈 제거"
    )
    consecutive_sell_weeks: Optional[int] = Field(
        default=None,
        description="대외 중장기채가 연속으로 순매도(음수)인 주 수. "
                    "0이면 해당 주는 순매수. **연속 주수가 늘어나는 게 임계점 신호**",
    )
    net_yen_flow: Optional[float] = Field(
        default=None,
        description="대내 합계 − 대외 합계 (억엔). 양수 = 증권투자 경로의 엔 유입 우위 "
                    "(환헤지 미반영이므로 방향의 참고치)",
    )
