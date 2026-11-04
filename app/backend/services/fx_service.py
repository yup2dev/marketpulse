"""환율 조회·통화 환산 서비스.

환율은 일일 배치(scripts/collect_fx.py → mbs_in_fx_stbd)가 적재한 값만 쓴다.
요청 시 외부 API를 호출하지 않으므로 Fetcher 가용 여부와 무관하게 동작한다.

방향: mbs_in_fx_stbd 의 rate 는 base_curr 1단위당 quote_curr.
      저장된 쌍의 역방향(KRW→USD)은 1/rate 로 계산한다.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Iterable, Mapping, Optional

from sqlalchemy.orm import Session

from marketpulse_common.models.orm import MBS_IN_FX_STBD


class FXRateNotFound(LookupError):
    """요청 통화쌍의 적재된 환율이 없음 (배치 미실행 등)."""


@dataclass(frozen=True)
class FXRate:
    base_curr: str
    quote_curr: str
    rate: float              # 1 base_curr = rate quote_curr
    base_ymd: Optional[date]
    change_rate: Optional[float] = None
    inverted: bool = False   # 저장된 쌍의 역방향으로 계산했는지

    def convert(self, amount: Optional[float]) -> Optional[float]:
        return None if amount is None else float(amount) * self.rate

    def as_dict(self) -> dict:
        return {
            "pair": f"{self.base_curr}{self.quote_curr}",
            "base_curr": self.base_curr,
            "quote_curr": self.quote_curr,
            "rate": self.rate,
            "change_rate": self.change_rate,
            "as_of": self.base_ymd.isoformat() if self.base_ymd else None,
            "inverted": self.inverted,
        }


def _latest_row(db: Session, fx_cd: str, on_or_before: Optional[date]) -> Optional[MBS_IN_FX_STBD]:
    q = db.query(MBS_IN_FX_STBD).filter(MBS_IN_FX_STBD.fx_cd == fx_cd)
    if on_or_before is not None:
        q = q.filter(MBS_IN_FX_STBD.base_ymd <= on_or_before)
    return q.order_by(MBS_IN_FX_STBD.base_ymd.desc()).first()


def get_rate(db: Session, base: str, quote: str, on_or_before: Optional[date] = None) -> FXRate:
    """base → quote 환율 (on_or_before 이전 가장 최근 영업일). 같은 통화면 1."""
    base, quote = base.upper(), quote.upper()
    if base == quote:
        return FXRate(base, quote, 1.0, on_or_before)

    row = _latest_row(db, f"{base}{quote}", on_or_before)
    if row is not None:
        return FXRate(base, quote, float(row.rate), row.base_ymd,
                      float(row.change_rate) if row.change_rate is not None else None)

    row = _latest_row(db, f"{quote}{base}", on_or_before)
    if row is not None and float(row.rate):
        # 역방향 등락률: (1/r1)/(1/r0) - 1 = r0/r1 - 1 = 1/(1+c) - 1
        chg = None
        if row.change_rate is not None:
            c = float(row.change_rate) / 100
            chg = round((1 / (1 + c) - 1) * 100, 4) if c != -1 else None
        return FXRate(base, quote, 1 / float(row.rate), row.base_ymd, chg, inverted=True)

    raise FXRateNotFound(f"{base}{quote} 환율이 적재되어 있지 않습니다 (scripts/collect_fx.py 실행 필요)")


def convert_fields(data: Mapping, fields: Iterable[str], fx: FXRate) -> dict:
    """data 의 금액 필드만 환산한 사본. 비율(%)·수량 필드는 넘기지 말 것."""
    out = dict(data)
    for f in fields:
        if out.get(f) is not None:
            out[f] = round(fx.convert(out[f]), 2)
    return out
