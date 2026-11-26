"""산업 카탈로그 기본 행 — 산업 → 데이터셋 → 계열, 관련 기업 업종 연결.

commands/industry/datasets.py 가 처음 읽을 때 DB 에 없는 산업만 넣는다 (있는 행은 건드리지 않는다).
데이터셋은 KOSIS 모델(/api/data/kosis/<model>)만 쓴다 — category · measure 값은 그 모델의 코드 맵
(data_fetcher/providers/api/kosis/utils/helpers.py) 에 있는 키여야 한다 (tests/test_industry_catalog.py 가 본다).

    dataset  (dataset_id, group, name, model, params, unit, source, note, series)
    series   (series_code, label, series_params)   — series_params 는 쿼리스트링
    sectors  (market, match_field, sector_name)    — 종목 마스터 mbs_in_stbd_mst 의 값 그대로
"""

KOSIS = "kosis"
SRC_INDEX = "국가데이터처 (광공업동향조사)"
SRC_UTIL = "국가데이터처 (제조업 가동률)"
SRC_ICT = "과학기술정보통신부 (ICT 수출입)"
SRC_TRADE = "한국무역협회 (품목별 수출입)"

INDEX = "2020=100"
MEASURES_ALL = [("production", "생산"), ("shipment", "출하"), ("inventory", "재고")]


def _ds(dataset_id, group, name, model, series, *, params="", unit, source, note=""):
    return {
        "dataset_id": dataset_id, "group": group, "name": name, "model": model, "params": params,
        "unit": unit, "source": source, "note": note,
        "series": [{"series_code": c, "label": l, "series_params": p} for c, l, p in series],
    }


def _index_by_measure(prefix, category, label, measures=MEASURES_ALL):
    """한 산업의 생산 · 출하 · 재고지수 (계열 = 지수 종류)."""
    return _ds(
        f"{prefix}-production", "생산", f"{label} 생산 · 출하 · 재고지수 (월)", "mining_manufacturing_index",
        [(m, l, f"measure={m}") for m, l in measures],
        params=f"category={category}", unit=INDEX, source=SRC_INDEX, note="원지수 · 전국",
    )


def _utilization(prefix, series, label):
    """가동률지수 (계열 = 산업)."""
    return _ds(
        f"{prefix}-utilization", "생산", f"{label} 가동률지수 (월)", "capacity_utilization",
        [(c, l, f"category={c}") for c, l in series],
        params="measure=utilization", unit=INDEX, source=SRC_UTIL, note="원지수",
    )


INDUSTRIES = [
    {
        "industry_code": "automobile", "name": "자동차·타이어",
        "datasets": [
            _ds("auto-exports", "수출", "자동차 수출: 차종별 (월)", "product_trade",
                [("passenger_car", "승용차", "category=passenger_car"), ("truck", "화물·특수차", "category=truck")],
                params="flow=export", unit="USD", source=SRC_TRADE, note="SITC 781 · 782, 천달러를 달러로 환산"),
            _ds("tire-exports", "수출", "타이어 수출: 차종별 (월)", "product_trade",
                [("tire_passenger", "승용차용", "category=tire_passenger"), ("tire_truck", "버스·화물차용", "category=tire_truck")],
                params="flow=export", unit="USD", source=SRC_TRADE, note="SITC 6251 · 6252"),
            _ds("auto-production", "생산", "자동차 생산지수: 완성차 · 부품 (월)", "mining_manufacturing_index",
                [("automobile", "완성차", "category=automobile"), ("auto_parts", "부품", "category=auto_parts")],
                params="measure=production", unit=INDEX, source=SRC_INDEX, note="원지수 · 전국"),
            _utilization("auto", [("automobile", "완성차"), ("auto_parts", "부품")], "자동차"),
        ],
        "sectors": [
            ("KR", "sector", "자동차용 엔진 및 자동차 제조업"), ("KR", "sector", "자동차 신품 부품 제조업"),
            ("KR", "sector", "고무제품 제조업"),
            ("US", "industry", "Automobile Manufacturers"), ("US", "industry", "Automotive Parts & Equipment"),
        ],
    },
    {
        "industry_code": "semiconductor", "name": "반도체",
        "datasets": [
            _ds("semi-exports", "수출", "반도체 수출: 품목별 (월)", "ict_exports",
                [("semiconductor", "반도체 전체", "category=semiconductor"), ("memory", "메모리", "category=memory"),
                 ("dram", "DRAM", "category=dram"), ("flash", "플래시", "category=flash"),
                 ("system_semiconductor", "시스템반도체", "category=system_semiconductor")],
                unit="USD", source=SRC_ICT, note="통관 기준"),
            _index_by_measure("semi", "semiconductor", "반도체"),
            _utilization("semi", [("semiconductor", "반도체")], "반도체"),
        ],
        "sectors": [
            ("KR", "sector", "반도체 제조업"),
            ("US", "industry", "Semiconductors"), ("US", "industry", "Semiconductor Materials & Equipment"),
        ],
    },
    {
        "industry_code": "battery", "name": "2차전지", "new": True,
        "datasets": [
            _ds("battery-exports", "수출", "축전지 수출 (월)", "product_trade",
                [("battery", "축전지", "category=battery"), ("battery_parts", "축전지 부분품", "category=battery_parts")],
                params="flow=export", unit="USD", source=SRC_TRADE, note="SITC 77812 · 77819"),
            _index_by_measure("battery", "battery", "축전지"),
            _utilization("battery", [("battery", "축전지")], "축전지"),
        ],
        "sectors": [("KR", "sector", "일차전지 및 이차전지 제조업")],
    },
    {
        "industry_code": "shipbuilding", "name": "조선",
        "datasets": [
            _ds("ship-exports", "수출", "선박 수출 (월)", "product_trade",
                [("ship", "선박", "category=ship")],
                params="flow=export", unit="USD", source=SRC_TRADE, note="SITC 793 · 인도 시점 통관 기준이라 월별 변동이 크다"),
            # 선박은 재고지수가 없다 (KOSIS 원 데이터)
            _index_by_measure("ship", "shipbuilding", "선박", [("production", "생산"), ("shipment", "출하")]),
            _utilization("ship", [("shipbuilding", "선박")], "선박"),
        ],
        "sectors": [("KR", "sector", "선박 및 보트 건조업")],
    },
    {
        "industry_code": "steel", "name": "철강",
        "datasets": [
            _index_by_measure("steel", "steel", "1차 철강"),
            _utilization("steel", [("steel", "1차 철강")], "철강"),
        ],
        "sectors": [("KR", "sector", "1차 철강 제조업"), ("US", "industry", "Steel")],
    },
    {
        "industry_code": "chemicals", "name": "화학",
        "datasets": [
            _index_by_measure("chem", "chemicals", "화학"),
            _utilization("chem", [("chemicals", "화학")], "화학"),
        ],
        "sectors": [
            ("KR", "sector", "기초 화학물질 제조업"), ("KR", "sector", "합성고무 및 플라스틱 물질 제조업"),
            ("US", "industry", "Commodity Chemicals"), ("US", "industry", "Specialty Chemicals"),
        ],
    },
    {
        "industry_code": "petroleum", "name": "에너지·정유",
        "datasets": [
            _index_by_measure("petro", "petroleum", "석유 정제품"),
            _utilization("petro", [("petroleum", "석유 정제품")], "정유"),
        ],
        "sectors": [
            ("KR", "sector", "석유 정제품 제조업"),
            ("US", "industry", "Oil & Gas Refining & Marketing"), ("US", "industry", "Integrated Oil & Gas"),
        ],
    },
    # 데이터셋 준비 중 — 목록에는 보이고 '준비하고 있어요' 상태로 나온다
    {"industry_code": "bio", "name": "바이오", "datasets": [], "sectors": [("KR", "sector", "의약품 제조업")]},
    {"industry_code": "internet_game", "name": "인터넷·게임", "datasets": [], "sectors": []},
    {"industry_code": "consumer", "name": "유통·소비재", "datasets": [], "sectors": []},
    {"industry_code": "cosmetics", "name": "화장품", "new": True, "datasets": [], "sectors": []},
    {"industry_code": "finance", "name": "금융", "datasets": [], "sectors": []},
    {"industry_code": "construction", "name": "건설·부동산", "datasets": [], "sectors": []},
    {"industry_code": "transport", "name": "운송", "datasets": [], "sectors": [("KR", "sector", "해상 운송업"), ("KR", "sector", "항공 여객 운송업")]},
]
