"""Standard Model: Carry Funding Stress (엔 조달 스트레스 대체 지표)

⚠️ **이건 크로스커런시 베이시스가 아니다.** 무료 대체 지표 묶음이다.

원래 보고 싶은 지표는 USD/JPY 3개월 크로스커런시 베이시스다. 베이시스가 마이너스로
벌어지면 달러 조달 프리미엄이 붙는 것이고, 엔 조달로 달러 자산을 산 캐리 포지션이
디레버리징 중이라는 직접 증거가 된다. 계산하려면 CIP 편차 =
(3M 포워드 포인트 내재금리) − (금리차) 가 필요한데, **3개월 FX 포워드 포인트를 무료
API로 제공하는 소스가 없다**. FRED·yfinance·CFTC 어디에도 없고, 은행/BIS 데이터는
유료이거나 분기 시차다.

그래서 이 모델은 조달 스트레스의 **간접 신호 3종**을 한 화면에 모은다:
  1. `cb_swap_musd` — 연준 중앙은행 유동성 스왑 잔액(H.4.1, 주간). 달러 조달이 실제로
     막히면 BOJ 등이 이 라인을 끌어 쓴다. 평시엔 0에 가깝고, **급증하면 이미 급성
     스트레스**다. 즉 조기 경보가 아니라 확인 신호다.
  2. `rate_diff` — 미–일 3개월 금리차. 캐리의 총수익(gross carry) 그 자체. 좁혀지면
     캐리 유인이 줄어 포지션 청산 압력이 커진다.
  3. `vix` — 글로벌 위험선호. 캐리 언와인드는 예외 없이 VIX 급등과 동반한다.

잃는 것: **평시의 완만한 베이시스 확대를 전혀 못 잡는다.** 실제 베이시스는 분기말
규제 대차대조표 압박으로 상시 출렁이는데 여기엔 그 정보가 없다. 스왑라인은 위기가
터진 뒤에야 켜진다. 선행성이 필요하면 유료 베이시스 데이터가 답이다.

한 행 = 하루 (주간/월간 시리즈는 직전값으로 전진 채움).
"""
from datetime import date as date_type
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class CarryFundingStressQueryParams(BaseQueryParams):
    """엔 조달 스트레스 대체 지표 조회 표준 파라미터"""

    start_date: Optional[date_type] = Field(default=None, description="시작일")
    end_date: Optional[date_type] = Field(default=None, description="종료일")


class CarryFundingStressData(BaseData):
    """일자별 조달 스트레스 대체 지표 (한 행 = 하루)"""

    date: Optional[str] = Field(default=None, description="날짜 (YYYY-MM-DD)")

    usdjpy: Optional[float] = Field(default=None, description="USD/JPY 환율 (FRED DEXJPUS)")
    us_3m: Optional[float] = Field(default=None, description="미국 3개월 국채 수익률 (%) — DGS3MO")
    jp_3m: Optional[float] = Field(
        default=None, description="일본 3개월 인터뱅크 금리 (%) — IR3TIB01JPM156N (월간, 전진 채움)"
    )
    rate_diff: Optional[float] = Field(
        default=None,
        description="미–일 3개월 금리차 (%p) = us_3m − jp_3m. **캐리의 총수익.** 축소 = 캐리 유인 감소",
    )
    cb_swap_musd: Optional[float] = Field(
        default=None,
        description="연준 중앙은행 유동성 스왑 잔액 (백만 달러, 주간·전진 채움). "
                    "**급증 = 달러 조달 경색 확인 신호** (선행 아님)",
    )
    vix: Optional[float] = Field(default=None, description="VIX 지수 — 글로벌 위험선호")
