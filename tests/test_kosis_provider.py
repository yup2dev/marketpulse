"""KOSIS provider — 통계청 국가통계포털 통계표 시계열 (providers/kosis, OpenBB fred 구조).

HTTP 는 models/series.py 의 KOSISSeriesFetcher 한 곳 — 지표 모델은 그걸 부른다.
네트워크는 쓰지 않는다 — provider_helpers.amake_json_request 를 대체한다.
응답 모양은 개발가이드(통계자료 출력변수 · 1.4 에러메시지)를 따른다:
  정상 = 행 배열 [{PRD_DE, DT, ITM_ID, ITM_NM, C1, C1_NM, UNIT_NM, ...}], 오류 = {"err": "30", "errMsg": "..."}.
"""
from datetime import date

import pytest

from data_fetcher.abstract_provider.abstract.annotated_result import AnnotatedResult
from data_fetcher.providers.kosis.models.capacity_utilization import KOSISCapacityUtilizationFetcher
from data_fetcher.providers.kosis.models.ict_exports import KOSISIctExportsFetcher
from data_fetcher.providers.kosis.models.mining_manufacturing_index import KOSISMiningManufacturingIndexFetcher
from data_fetcher.providers.kosis.models.product_trade import KOSISProductTradeFetcher
from data_fetcher.providers.kosis.models.series import KOSISSeriesFetcher
from data_fetcher.providers.kosis.utils.helpers import add_changes, from_period, to_period
from data_fetcher.utils.api_keys import CredentialsError
from data_fetcher.utils.http_client import RateLimitError

CREDS = {"api_key": "k"}


@pytest.fixture(autouse=True)
def _no_throttle(monkeypatch):
    """호출 간격(sleep 0.3s)은 테스트에서 건너뛴다."""
    async def no_sleep(_):
        return None
    monkeypatch.setattr("data_fetcher.providers.kosis.models.series.asyncio.sleep", no_sleep)


def _patch(monkeypatch, response, seen=None):
    async def fake(url, params=None, **kwargs):
        if seen is not None:
            seen.append((url, params))
        return response
    monkeypatch.setattr("data_fetcher.utils.provider_helpers.amake_json_request", fake)


def _monthly(code_key, code, values, start=(2024, 1), **extra):
    """연속된 월 행 [{PRD_DE, DT, code_key: code}] — values 순서대로 start 부터."""
    y, m = start
    out = []
    for v in values:
        out.append({"PRD_SE": "M", "PRD_DE": f"{y}{m:02d}", "DT": str(v), code_key: code, **extra})
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


# ── helpers (순수 함수) ────────────────────────────────────────────────────────

@pytest.mark.parametrize("d,prd_se,expected", [
    (date(2024, 3, 15), "M", "202403"),
    (date(2024, 5, 1), "Q", "202402"),   # KOSIS 분기는 YYYYQQ
    (date(2024, 12, 31), "Y", "2024"),
])
def test_to_period(d, prd_se, expected):
    assert to_period(d, prd_se) == expected


@pytest.mark.parametrize("raw,prd_se,expected", [
    ("202403", "M", date(2024, 3, 1)),
    ("202402", "Q", date(2024, 4, 1)),
    ("2024", "Y", date(2024, 1, 1)),
    ("", "M", None),
    ("2024AB", "M", None),
])
def test_from_period(raw, prd_se, expected):
    assert from_period(raw, prd_se) == expected


def test_add_changes_uses_dates_not_positions():
    """빠진 달이 있어도 1년 전 · 직전 '날짜' 와 비교한다 — 없으면 None."""
    rows = [
        {"date": date(2024, 1, 1), "value": 100.0, "category": "a"},
        {"date": date(2024, 3, 1), "value": 110.0, "category": "a"},   # 2월 빠짐
        {"date": date(2025, 1, 1), "value": 120.0, "category": "a"},
        {"date": date(2025, 1, 1), "value": 50.0, "category": "b"},
    ]
    out = {(r["category"], r["date"]): r for r in add_changes(rows, "M")}
    assert out[("a", date(2024, 3, 1))]["mom"] is None            # 직전(2월)이 없다
    assert out[("a", date(2025, 1, 1))]["yoy"] == 20.0             # 2024-01 대비
    assert out[("b", date(2025, 1, 1))]["yoy"] is None             # 다른 category 와 섞지 않는다


# ── 등록 ──────────────────────────────────────────────────────────────────────

def test_provider_registered():
    import data_fetcher.providers_init  # noqa: F401
    from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry

    kosis = ProviderRegistry.get("kosis")
    assert kosis.credentials == ["api_key"] and kosis.metadata["group"] == "macro"
    assert set(kosis.fetcher_dict) == {
        "series", "mining_manufacturing_index", "capacity_utilization", "ict_exports", "product_trade",
    }
    assert kosis.fetcher_dict["series"] is KOSISSeriesFetcher


# ── series (HTTP 하는 유일한 곳) ─────────────────────────────────────────────

async def test_series_maps_rows_and_metadata(monkeypatch):
    seen = []
    _patch(monkeypatch, [
        {"PRD_SE": "M", "PRD_DE": "202410", "DT": "-", "ITM_ID": "T1", "ITM_NM": "생산지수", "C1": "C", "C1_NM": "제조업",
         "LST_CHN_DE": "2024-11-29"},
        {"PRD_SE": "M", "PRD_DE": "202409", "DT": "1,234.5", "ITM_ID": "T1", "ITM_NM": "생산지수",
         "C1": "C", "C1_NM": "제조업", "UNIT_NM": "2020=100", "TBL_NM": "광업제조업동향조사", "LST_CHN_DE": "2024-10-31"},
    ], seen)
    out = await KOSISSeriesFetcher.fetch_data(
        {"org_id": "101", "tbl_id": "DT_X", "itm_id": "T1+T2", "start_date": "2024-09-01", "end_date": "2024-10-31"},
        credentials=CREDS,
    )
    assert isinstance(out, AnnotatedResult) and len(seen) == 1             # 요청 한 번
    _, params = seen[0]
    assert params["orgId"] == "101" and params["tblId"] == "DT_X" and params["itmId"] == "T1+T2"
    assert params["objL1"] == "ALL" and params["objL2"] == "" and params["prdSe"] == "M"
    assert (params["startPrdDe"], params["endPrdDe"]) == ("202409", "202410")
    assert params["format"] == "json" and params["jsonVD"] == "Y" and params["apiKey"] == "k"
    # 시점순 정렬 · 콤마 제거 · 통계부호('-')는 None
    assert [(r.date, r.value, r.category_name, r.unit) for r in out.result] == [
        (date(2024, 9, 1), 1234.5, "제조업", "2020=100"),
        (date(2024, 10, 1), None, "제조업", None),
    ]
    assert out.metadata["table_name"] == "광업제조업동향조사" and out.metadata["updated_at"] == "2024-11-29"
    assert out.metadata["units"] == {"T1": "2020=100"}


async def test_series_default_range_is_last_10_years(monkeypatch):
    seen = []
    _patch(monkeypatch, [], seen)
    await KOSISSeriesFetcher.fetch_data({"org_id": "101", "tbl_id": "DT_X", "prd_se": "y"}, credentials=CREDS)
    _, params = seen[0]
    assert params["prdSe"] == "Y" and params["startPrdDe"] == str(date.today().year - 10)


async def test_series_rejects_unsupported_cycle():
    with pytest.raises(Exception, match="prd_se"):
        await KOSISSeriesFetcher.fetch_data({"org_id": "101", "tbl_id": "DT_X", "prd_se": "D"}, credentials=CREDS)


async def test_series_error_codes(monkeypatch):
    params = {"org_id": "101", "tbl_id": "DT_X"}
    # 30 조회결과 없음 → 빈 결과 (예외면 게이트웨이가 400 으로 바꿔 위젯이 '오류'를 띄운다)
    _patch(monkeypatch, {"err": "30", "errMsg": "조회결과 없음"})
    assert (await KOSISSeriesFetcher.fetch_data(params, credentials=CREDS)).result == []

    _patch(monkeypatch, {"err": "11", "errMsg": "인증키 기간만료"})
    with pytest.raises(CredentialsError, match="11"):
        await KOSISSeriesFetcher.fetch_data(params, credentials=CREDS)

    _patch(monkeypatch, {"err": "40", "errMsg": "호출가능건수 제한"})
    with pytest.raises(RateLimitError):
        await KOSISSeriesFetcher.fetch_data(params, credentials=CREDS)

    _patch(monkeypatch, {"err": "21", "errMsg": "잘못된 요청변수"})
    with pytest.raises(ValueError, match="21"):
        await KOSISSeriesFetcher.fetch_data(params, credentials=CREDS)


# ── 지표 모델 (코드 맵 → KOSISSeriesFetcher 한 번 → 정규화) ─────────────────────

async def test_mining_manufacturing_index_codes_and_lookback(monkeypatch):
    seen = []
    # 2025-01 ~ 2026-02 (14개월) — 요청은 2026-01 부터
    _patch(monkeypatch, _monthly("C2", "C261", range(100, 114), start=(2025, 1),
                                 C1="00", C2_NM="반도체 제조업", ITM_ID="T20", TBL_NM="시도/산업별 광공업생산지수"), seen)
    out = await KOSISMiningManufacturingIndexFetcher.fetch_data(
        {"category": "semiconductor,shipbuilding", "seasonally_adjusted": True,
         "start_date": "2026-01-15", "end_date": "2026-02-28"},
        credentials=CREDS,
    )
    assert len(seen) == 1                                                      # 산업 2개도 요청 한 번
    _, params = seen[0]
    assert params["tblId"] == "DT_1F02001" and params["itmId"] == "T20"         # 생산 · 계절조정
    assert params["objL1"] == "00" and params["objL2"] == "C261+C311"          # 전국 × 산업
    assert params["startPrdDe"] == "202501"                                    # 증감률용 1년 앞부터
    # 요청 기간만 남고, 첫 시점의 yoy 도 채워진다
    assert [(r.date, r.category, r.measure, r.category_name) for r in out.result] == [
        (date(2026, 1, 1), "semiconductor", "production", "반도체 제조업"),
        (date(2026, 2, 1), "semiconductor", "production", "반도체 제조업"),
    ]
    assert out.result[0].yoy == 12.0 and out.result[0].mom == round((112 / 111 - 1) * 100, 2)
    assert out.metadata["tbl_id"] == "DT_1F02001"                              # series 의 metadata 를 넘긴다


async def test_capacity_utilization_uses_obj_l1(monkeypatch):
    seen = []
    _patch(monkeypatch, _monthly("C1", "C282", [80, 81]), seen)
    out = await KOSISCapacityUtilizationFetcher.fetch_data(
        {"category": "battery", "start_date": "2024-01-01", "end_date": "2024-02-28"}, credentials=CREDS,
    )
    _, params = seen[0]
    assert params["tblId"] == "DT_1F32001" and params["itmId"] == "T20" and params["objL1"] == "C282"
    assert [r.category for r in out.result] == ["battery", "battery"] and out.result[0].measure == "utilization"


async def test_unknown_category_is_rejected():
    with pytest.raises(Exception, match="category"):
        await KOSISCapacityUtilizationFetcher.fetch_data({"category": "nope"}, credentials=CREDS)


async def test_ict_exports_prefix_and_monthly_only(monkeypatch):
    seen = []
    _patch(monkeypatch, _monthly("C1", "13102131003A.AF11111100", [1e9, 2e9], C1_NM="DRAM"), seen)
    out = await KOSISIctExportsFetcher.fetch_data(
        {"category": "dram", "start_date": "2024-01-01", "end_date": "2024-02-28"}, credentials=CREDS,
    )
    _, params = seen[0]
    assert params["orgId"] == "127" and params["objL1"] == "13102131003A.AF11111100" and params["prdSe"] == "M"
    assert [(r.category, r.category_id, r.value, r.unit) for r in out.result][0] == ("dram", "AF11111100", 1e9, "USD")
    with pytest.raises(Exception, match="prd_se"):
        await KOSISIctExportsFetcher.fetch_data({"prd_se": "Q"}, credentials=CREDS)


async def test_product_trade_converts_thousand_usd(monkeypatch):
    seen = []
    _patch(monkeypatch, _monthly("C1", "13102112831A.781", [5_704_763], C1_NM="승용자동차 및 기타의 차량 "), seen)
    out = await KOSISProductTradeFetcher.fetch_data(
        {"category": "passenger_car", "flow": "import", "start_date": "2024-01-01", "end_date": "2024-01-31"},
        credentials=CREDS,
    )
    _, params = seen[0]
    assert params["orgId"] == "360" and params["itmId"] == "13103112831T2"     # 수입액
    r = out.result[0]
    assert (r.value, r.unit, r.flow, r.category_name) == (5_704_763_000, "USD", "import", "승용자동차 및 기타의 차량")
