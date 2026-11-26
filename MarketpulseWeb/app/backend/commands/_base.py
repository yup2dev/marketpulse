"""command 공용 — 행 타입과 작은 계산 도우미. 조회는 하지 않는다 (CommandRunner 가 inputs 를 받아 온다)."""
from typing import Any, Dict, List, Optional, Tuple

from app.backend.platform.obbject import OBBject

Rows = List[Dict[str, Any]]


def pct_change(cur: Optional[float], prev: Optional[float]) -> Optional[float]:
    """직전 대비 변화율 (%). 값이 없거나 직전이 0 이면 None."""
    if cur is None or prev is None or prev == 0:
        return None
    return (cur - prev) / prev * 100


def latest_two(rows: Rows, date_key: str = "date") -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """날짜 순으로 최신 · 직전 행. fetcher 마다 정렬 방향이 달라도 날짜로 고른다."""
    dated = sorted((r for r in rows if r.get(date_key) is not None), key=lambda r: str(r[date_key]))
    if not dated:
        return None, None
    return dated[-1], (dated[-2] if len(dated) > 1 else None)


def unwrap(raw: Any) -> Any:
    """fetcher 결과에서 데이터만 (직렬화 없이) — OBBject.unwrap."""
    return OBBject.unwrap(raw)


_KR_SUFFIX = {'KOSPI': '.KS', 'KOSDAQ': '.KQ'}


def to_quote_symbol(ticker_cd: str, exchange: str = '', curr: str = '') -> str:
    """DB의 원시 종목코드를 시세 조회(yfinance) 표준 심볼로 정규화.

    KR 종목은 DB에 접미사 없는 숫자 코드(예: '279570')로 저장되지만, yfinance는
    거래소별 접미사(.KS=KOSPI, .KQ=KOSDAQ)가 있어야 시세를 반환한다.
    """
    code = (ticker_cd or '').strip()
    if not code or '.' in code:
        return code
    if curr == 'KRW' or (exchange or '').upper() in _KR_SUFFIX:
        return code + _KR_SUFFIX.get((exchange or '').upper(), '.KS')
    return code
