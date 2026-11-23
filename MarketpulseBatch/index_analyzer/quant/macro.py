"""매크로 시장 지표 — 웹의 포트폴리오 매크로 조건(예: 금리 하락 + 구리가 12개월 평균 위)이 쓰는 월말 값.

월별 패널(mbs_in_quant_panel)에 벤치마크 지수와 같은 모양의 '^' 행으로 넣는다 (close = 월말 값,
fwd_ret = 다음 달 변화율). 서버는 '^' 행을 지수 · 지표로 따로 모으므로 새 테이블이 필요 없다.
월말 시장 값이라 발표 지연이 없다 — 그 달 말에 이미 알 수 있는 값이다.

id 는 웹 서버(services/quant_strategy_service.MACRO_SERIES)와 같아야 한다 (tests 가 맞춰 본다).
"""
from __future__ import annotations

from typing import List, Tuple

# (패널 코드, Yahoo 코드, 이름, 종류: rate = 금리·지수 포인트 · price = 가격)
MACRO_SERIES: List[Tuple[str, str, str, str]] = [
    ("^TNX", "^TNX", "미국 10년물 금리", "rate"),
    ("^IRX", "^IRX", "미국 3개월물 금리", "rate"),
    ("^DXY", "DX-Y.NYB", "달러 지수", "price"),
    ("^HG", "HG=F", "구리 선물", "price"),
    ("^VIX", "^VIX", "VIX 변동성", "rate"),
    ("^SOX", "^SOX", "필라델피아 반도체 지수", "price"),
]
MACRO_IDS = [m[0] for m in MACRO_SERIES]
YAHOO_TO_ID = {m[1]: m[0] for m in MACRO_SERIES}
