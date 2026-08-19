"""MOF Portfolio Flows Fetcher — 일본 재무성 대외·대내 증권투자 주간 통계.

소스: https://www.mof.go.jp/policy/international_policy/reference/
      itn_transactions_in_securities/week.csv
      「対外及び対内証券売買契約等の状況(週次・指定報告機関ベース)」
      API 키 불필요. 2005년 첫 주부터 전체 주간 시계열(약 1,100주)을 담은 단일 CSV.

⚠️ CSV 파싱 주의사항 (원본이 사람이 읽는 엑셀 표를 그대로 내보낸 형식이다):
  - **인코딩은 CP932(Shift-JIS)** — UTF-8로 읽으면 깨진다. aiohttp의 자동 인코딩
    추정에 맡기지 않고 바이트를 받아 명시적으로 디코딩한다.
  - 상단 14줄은 다국어 다단 헤더, 하단 6줄은 각주다. 열 이름으로는 행을 구분할 수
    없어서 **1열이 기간 표기 패턴인 행만** 데이터로 취급한다.
  - 기간 표기가 전각이다: '2026．8．2〜8．8'. 2005년 초기 행은 '2005．1．2〜 1．8'처럼
    물결표 뒤 공백이 있는 등 표기가 흔들려서 NFKC 정규화 후 정규식으로 시작일만 뽑는다.
  - 수치는 '"1,689 "' 처럼 천단위 콤마 + 뒤쪽 공백이 붙는다. 음수는 데이터 행에서는
    ASCII '-'지만 각주는 전각 '−'를 쓰므로 양쪽 모두 처리한다.

부호 규약과 2014년 재분류 등 해석상의 함정은 standard model 도큐스트링 참조.
"""
import csv
import io
import logging
import re
import unicodedata
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.portfolio_flows import (
    PortfolioFlowsData,
    PortfolioFlowsQueryParams,
)

log = logging.getLogger(__name__)

MOF_WEEKLY_CSV = (
    "https://www.mof.go.jp/policy/international_policy/reference/"
    "itn_transactions_in_securities/week.csv"
)

#: 데이터 행 판별 + 시작일 추출. NFKC 정규화 뒤 'YYYY.M.D' 형태가 앞에 오는 행만 데이터다.
_PERIOD_RE = re.compile(r"^(\d{4})\.(\d{1,2})\.(\d{1,2})")

#: CSV 열 인덱스 → 표준 필드명. (0열은 기간 표기)
#: 1~11 = 대외증권투자(Assets), 12~22 = 대내증권투자(Liabilities).
#: 각 블록은 [주식 취득/처분/네트, 중장기채 취득/처분/네트, 소계, 단기채 취득/처분/네트, 합계].
_COLUMNS: Dict[int, str] = {
    3:  "assets_equity_net",
    6:  "assets_lt_debt_net",
    10: "assets_st_debt_net",
    11: "assets_total_net",
    14: "liab_equity_net",
    17: "liab_lt_debt_net",
    21: "liab_st_debt_net",
    22: "liab_total_net",
}


def _as_float(value: Any) -> Optional[float]:
    """'"1,689 "' → 1689.0 / '-1,034' → -1034.0 / '' → None."""
    if value is None:
        return None
    text = unicodedata.normalize("NFKC", str(value)).strip()
    # 전각 마이너스(−, U+2212)와 일본식 음수 기호(△)를 ASCII '-'로 통일
    text = text.replace("−", "-").replace("△", "-").replace("Δ", "-")
    text = text.replace(",", "").replace(" ", "")
    if not text or text in {"-", "."}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


async def _read_cp932(response, _session) -> str:
    """응답 본문을 바이트로 받아 CP932로 디코딩 (자동 인코딩 추정 우회)."""
    raw = await response.read()
    return raw.decode("cp932", errors="replace")


class MOFPortfolioFlowsQueryParams(PortfolioFlowsQueryParams):
    """MOF 주간 플로우 조회 파라미터 (standard PortfolioFlows 경유)."""


class MOFPortfolioFlowsData(PortfolioFlowsData):
    """MOF 주간 플로우 (standard PortfolioFlows 경유)."""


class MOFPortfolioFlowsFetcher(
    ApiFetcher[MOFPortfolioFlowsQueryParams, MOFPortfolioFlowsData]
):
    """일본 투자자의 주간 대외/대내 증권 순매매 — sticky money 추적용."""

    api_name = "MOF"
    require_credentials = False
    response_callback = staticmethod(_read_cp932)
    request_kwargs = {"timeout": 60}

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> MOFPortfolioFlowsQueryParams:
        return MOFPortfolioFlowsQueryParams(**params)

    @staticmethod
    def build_url(query: MOFPortfolioFlowsQueryParams, api_key: Optional[str]) -> str:
        return MOF_WEEKLY_CSV

    @staticmethod
    def transform_data(
        query: MOFPortfolioFlowsQueryParams,
        data: str,
        **kwargs: Any,
    ) -> List[MOFPortfolioFlowsData]:
        if not isinstance(data, str) or not data.strip():
            raise ValueError("MOF weekly CSV: empty response")

        rows: List[Dict[str, Any]] = []
        for cells in csv.reader(io.StringIO(data)):
            if not cells:
                continue
            label = str(cells[0]).strip()
            match = _PERIOD_RE.match(unicodedata.normalize("NFKC", label))
            if not match:
                continue  # 헤더/각주/공백 행
            year, month, day = (int(g) for g in match.groups())

            row: Dict[str, Any] = {
                "period_start": f"{year:04d}-{month:02d}-{day:02d}",
                "period_label": label,
            }
            for idx, field in _COLUMNS.items():
                row[field] = _as_float(cells[idx]) if idx < len(cells) else None
            rows.append(row)

        if not rows:
            raise ValueError(
                "MOF weekly CSV: no data rows parsed — 원본 표 형식이 바뀌었을 수 있다"
            )

        rows.sort(key=lambda r: r["period_start"])

        # ── 파생 지표 ────────────────────────────────────────────────────────
        lt = [r["assets_lt_debt_net"] for r in rows]
        streak = 0
        for i, row in enumerate(rows):
            window = [v for v in lt[max(0, i - 3):i + 1] if v is not None]
            row["assets_lt_debt_net_4w"] = round(sum(window), 1) if len(window) == 4 else None

            current = lt[i]
            # 순매도(음수)가 이어진 주 수. 순매수가 나오면 0으로 리셋.
            streak = streak + 1 if (current is not None and current < 0) else 0
            row["consecutive_sell_weeks"] = streak

            assets_total, liab_total = row["assets_total_net"], row["liab_total_net"]
            row["net_yen_flow"] = (
                round(liab_total - assets_total, 1)
                if (assets_total is not None and liab_total is not None) else None
            )

        # 파생값(4주 합계·연속 순매도 주수)은 위에서 전체 시계열 기준으로 이미 계산했다.
        # 여기서 자르는 건 표시 구간일 뿐이라 구간을 좁혀도 값이 달라지지 않는다.
        if query.start_date:
            start_iso = query.start_date.isoformat()
            end_iso = query.end_date.isoformat() if query.end_date else None
            trimmed = [
                r for r in rows
                if r["period_start"] >= start_iso
                and (end_iso is None or r["period_start"] <= end_iso)
            ]
        else:
            trimmed = rows[-int(query.weeks):] if query.weeks else rows
        return [MOFPortfolioFlowsData(**r) for r in trimmed]
