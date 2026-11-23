"""기본 제공 위젯의 처음 행 — DB 에 그 위젯이 없을 때 한 번 넣는 값.

위젯 정의의 주인은 DB(user_widgets 계열, user_id NULL)다. 이 파일은 없는 위젯을 채우는
시드일 뿐이고, 화면은 여기를 읽지 않는다 — 넣은 뒤의 변경은 DB 행을 고친다.
(BuiltinWidgetService.list 가 widget_id 가 DB 에 없는 것만 넣는다. 있는 행은 건드리지 않는다.
 그래서 위젯을 빼려면 행을 지우지 말고 use_yn=N 으로 둔다.)

한 위젯의 모양 (키 이름 = 컬럼 이름):
    master   widget_id · name · description · group_name · title · view_type · endpoint · data_path ·
             source · source_note · transform · quote_key · refresh_sec · live_yn · default_symbol ·
             empty_text · size (w, h, min_w, min_h)
    params   헤더 선택지 — (param_name, label, 기본값, [(값, 라벨, option_params)])
    fields   (field_role, field_name, format, label, width, sub_field, quote_field)
    tabs     (tab_code, label, filter, empty_text, [(symbol, name)])
    options  { opt_name: opt_value } — 뷰 옵션. 'extra.<이름>' 은 보조 요청,
             'tab.<탭 코드>.<이름>' 은 그 탭만의 값 (view · endpoint · transform · controls · 뷰 옵션),
             'provider' 는 데이터 소스의 처음 값, 'optionsFrom.<컨트롤>' 은 선택지를 채울 요청 '경로|값|이름[|keep]',
             'shared' 는 화면 변수 이름(같은 이름을 쓰는 위젯이 값을 같이 따른다), 'select' 는 표의 행 클릭 → '변수:행 필드'

머리줄 컨트롤(params)은 이름과 선택지로 모양이 정해진다: date·*_date = 기준일 칩 · 선택지 4개 이하 = 한 줄 버튼 ·
더 많거나 optionsFrom = 드롭다운 · 선택지 없음 = '옵션' 버튼 안의 입력칸. 데이터 소스 선택은 모든 위젯에 항상 있다 —
endpoint 에 {provider} 가 있으면 바꿀 수 있고, 없으면 실제로 답한 소스를 보여 주기만 한다.
    screens  (screen, tab, x, y, w, h) — 위치가 있으면 그 화면·탭의 기본 배치, '*' 는 모든 화면의 메뉴
"""

HISTORY = "/stock/history/{symbol}"
FRED = "/data/{provider}"                      # 게이트웨이 — {provider} 는 머리줄의 데이터 소스 선택
GATEWAY = FRED                                 # 같은 게이트웨이 (종목 위젯 — 그 모델을 구현한 provider 중에서 고른다)
AS_OF = ("date", "기준일", None, [])            # 기준일 칩 (비우면 최신). 요청에는 ?date={date}
ALL = ("*", None, None, None, None, None)   # 모든 화면의 위젯 메뉴에 내놓는다 (배치는 없음)


def _field(role, name, fmt="text", label=None, width=None, sub=None, quote=None):
    return {"field_role": role, "field_name": name, "format": fmt, "label": label,
            "width": width, "sub_field": sub, "quote_field": quote}


# 주요 일정 표의 컬럼·옵션 — 이미 있는 DB 행을 표로 바꾸는 마이그레이션(f6a1c8d3e9b5)에도 같은 값이 적혀 있다
KEY_EVENT_FIELDS = [
    _field("COLUMN", "time", "muted", "시간", width=62),
    _field("COLUMN", "_cc", "muted", "국가", width=38),
    _field("COLUMN", "event", "text", "지표"),          # 폭을 안 적은 열이 나머지를 갖는다
    _field("COLUMN", "actual", "value", "실제", width=60),
    _field("COLUMN", "consensus", "value_muted", "예상", width=60),
    _field("COLUMN", "previous", "value_muted", "이전", width=68),
]
KEY_EVENT_OPTIONS = {"rowHeight": "28", "fixed": "true", "minWidth": "0"}


BUILTIN_WIDGETS = [
    # ── 지수 / 환율·원자재 타일 ──
    {
        "widget_id": "index-tiles",
        "name": "Indices",
        "description": "Index / FX · commodity tiles with sparklines",
        "view_type": "tiles",
        "source": "yahoo",
        "quote_key": "symbol",
        "size": (8, 3, 4, 2),
        "tabs": [
            ("index", "지수", None, None, [
                ("^GSPC", "S&P 500"), ("^NDX", "Nasdaq 100"), ("^DJI", "Dow 30"), ("^RUT", "Russell 2000"),
                ("^KS11", "KOSPI"), ("^KQ11", "KOSDAQ"), ("^N225", "Nikkei 225"), ("^VIX", "VIX"),
            ]),
            ("fxcmd", "환율 · 원자재", None, None, [
                ("KRW=X", "USD/KRW"), ("JPY=X", "USD/JPY"), ("EURUSD=X", "EUR/USD"), ("DX-Y.NYB", "Dollar Index"),
                ("GC=F", "Gold"), ("CL=F", "WTI"), ("BTC-USD", "Bitcoin"), ("^TNX", "US 10Y"),
            ]),
        ],
        "fields": [_field("SYMBOL", "symbol"), _field("LABEL", "name")],
        "options": {"series": f"{HISTORY}?period=2d&interval=5m"},
        "screens": [("/", "overview", 0, 0, 8, 3), ALL],
    },
    # ── 주요 일정 (오늘의 경제 캘린더 표: 시간 · 국가 · 지표 · 실제 · 예상 · 이전) ──
    {
        "widget_id": "key-events",
        "name": "Key Events",
        "description": "Today's economic events at a glance",
        "title": "주요 일정",
        "view_type": "table",
        "endpoint": "/data/nasdaq/economic_calendar?date={today}",
        "source": "nasdaq",
        "transform": "events_by_time",
        "empty_text": "오늘 일정이 없어요",
        "size": (4, 3, 3, 2),
        "fields": KEY_EVENT_FIELDS,
        "options": KEY_EVENT_OPTIONS,
        "screens": [("/", "overview", 8, 0, 4, 3), ALL],
    },
    # ── 실시간 랭킹 ──
    {
        "widget_id": "live-ranking",
        "name": "Live Ranking",
        "description": "Trade value · gainers · losers with 1D trend",
        "title": "실시간 랭킹",
        "view_type": "table",
        "endpoint": "/stock/ranking/live?market=all&sort_by={sortBy}&limit=30&provider={provider}",   # 데이터 소스 선택 (yahoo · kis · db)
        "source": "$provider",
        "live_yn": "Y",
        "transform": "rank_sort",
        "quote_key": "stk_cd",
        "empty_text": "표시할 종목이 없어요",
        "size": (8, 6, 5, 4),
        "params": [
            ("sortBy", "정렬 기준", "trade_value", [
                ("trade_value", "거래대금", None),
                ("gainers", "급상승", None),
                ("losers", "급하락", None),
            ]),
        ],
        "fields": [
            _field("COLUMN", "rank", "rank", "순위", width=56),
            _field("COLUMN", "stk_cd", "stock", "종목", sub="stk_nm"),
            _field("COLUMN", "close_price", "price", "현재가", sub="curr", quote="price"),
            _field("COLUMN", "change_rate", "change", "등락률", quote="change_percent"),
            _field("COLUMN", "volume", "compact", "거래량", quote="volume"),
            _field("COLUMN", "stk_cd", "trend", "1일", width=96, sub="change_rate"),
            _field("COLUMN", "sector", "tag", "산업", width=112),
        ],
        # 데이터 소스 후보(yahoo · kis · db)는 정렬과 무관하다 — 정렬 탭을 바꿔도 고른 소스를 유지
        "options": {"series": f"{HISTORY}?period=1d&interval=5m", "keepProvider": "true"},
        "screens": [("/", "overview", 0, 3, 8, 6), ALL],
    },
    # ── 미니 차트 (한 종목 캔들) ──
    {
        "widget_id": "mini-chart",
        "name": "Mini Chart",
        "description": "Candles + volume for one symbol (1m · 5m · 15m · 1D)",
        "title": "미니 차트",
        "view_type": "candles",
        "endpoint": f"{HISTORY}?period={{period}}&interval={{interval}}",
        "source": "yahoo",
        "source_note": "{note}",
        "transform": "bars_window",
        "quote_key": "$symbol",
        "default_symbol": "NVDA",
        "empty_text": "{symbol} 차트 데이터가 없어요",
        "size": (4, 6, 3, 4),
        "params": [
            ("bar", "봉 간격", "5m", [
                ("1m", "1분", "period=1d&interval=1m&take=90&note=1분봉"),
                ("5m", "5분", "period=5d&interval=5m&session=true&note=5분봉"),
                ("15m", "15분", "period=5d&interval=15m&take=80&note=15분봉"),
                ("1d", "일", "period=6mo&interval=1d&take=90&note=일봉"),
            ]),
        ],
        "screens": [("/", "overview", 8, 3, 4, 6), ALL],
    },
    # ── 섹터 히트맵 ──
    {
        "widget_id": "sector-heatmap",
        "name": "Sector Heatmap",
        "description": "Market-cap treemap colored by change",
        "title": "섹터 히트맵",
        "view_type": "treemap",
        "endpoint": "/stock/sector-performance",
        "source": "$provider",
        "live_yn": "Y",
        "source_note": "시가총액 기준",
        "transform": "flatten_sectors",
        "quote_key": "symbol",
        "empty_text": "섹터 데이터가 없어요",
        "size": (5, 5, 3, 4),
        "fields": [
            _field("VALUE", "market_cap"), _field("LABEL", "symbol"),
            _field("CHANGE", "change_pct", quote="change_percent"),
            _field("GROUP", "sector"), _field("LINK", "symbol"),
        ],
        "options": {"perSector": "8"},   # 섹터마다 시가총액 상위 N개 — 타일에 글자가 들어갈 만큼만
        "screens": [("/", "overview", 0, 9, 5, 5), ALL],
    },
    # ── 속보 / 관심종목 뉴스 ──
    {
        "widget_id": "breaking-news",
        "name": "Breaking News",
        "description": "One-line headlines · watchlist news",
        "view_type": "list",
        "endpoint": "/news?limit=50&period=1w",
        "source": "polygon",
        "transform": "news_rows",
        "refresh_sec": 120,
        "live_yn": "Y",
        "empty_text": "뉴스가 없어요",
        "size": (7, 5, 4, 3),
        "tabs": [
            ("breaking", "속보", None, None, []),
            ("watch", "관심종목 뉴스", "watchlist_tickers", "관심 종목 관련 뉴스가 아직 없어요", []),
        ],
        "fields": [
            _field("TIME", "_time"), _field("TITLE", "title"),
            _field("HREF", "article_url"), _field("TAG", "_tag"),
        ],
        "options": {"tagSymbol": "true", "extra.favorites": "/watchlist/my-tickers"},
        "screens": [("/", "overview", 5, 9, 7, 5), ALL],
    },

    # ══ 매크로 (/macro · Overview) ══════════════════════════════════════════════
    # ── 요약 줄: 금리 · 물가 · 고용 · 심리 (머리줄 없는 한 줄) ──
    {
        "widget_id": "macro-summary",
        "name": "Macro Summary",
        "description": "10Y · 2Y · CPI · core CPI · unemployment · VIX · Fear & Greed in one line",
        "group_name": "Macro",
        "title": "주요 지표",
        "view_type": "stats",
        "endpoint": f"{FRED}/inflation_decomposition?date={{date}}",   # 물가(헤드라인·근원)는 이 응답의 metadata
        "source": "$provider",
        "transform": "macro_kpis",
        "empty_text": "지표를 불러오지 못했어요",
        "size": (12, 1, 6, 1),
        "params": [AS_OF],
        "options": {
            "provider": "fred",
            "extra.yields": f"{FRED}/yield_curve?date={{date}}",
            "extra.labor": f"{FRED}/labor_dashboard?date={{date}}",
            "extra.sentiment": f"{FRED}/sentiment_composite?date={{date}}",
        },
        "screens": [("/macro", "overview", 0, 0, 12, 1), ALL],
    },
    # ── 국채 수익률: 곡선(만기별 최신) / 추이(만기 칩 최대 4개 비교) ──
    {
        "widget_id": "yield-curve",
        "name": "Treasury Yields",
        "description": "Yield curve snapshot · maturity trends (compare up to 4)",
        "group_name": "Macro",
        "view_type": "lines",
        "endpoint": f"{FRED}/yield_curve?date={{date}}",
        "source": "$provider",
        "transform": "yield_points",
        "empty_text": "수익률 데이터가 없어요",
        "size": (7, 6, 4, 4),
        "params": [
            AS_OF,
            ("period", "기간", "3mo", [
                ("1mo", "1M", None), ("3mo", "3M", None), ("1y", "1Y", None), ("5y", "5Y", None),
            ]),
        ],
        "tabs": [
            ("curve", "국채 수익률 곡선", None, None, []),
            ("trend", "추이", None, None, []),
        ],
        "options": {
            "provider": "fred",
            "x": "_label", "series": "value:수익률", "labels": "true", "unit": "%",
            "tab.curve.controls": "date",                       # 곡선은 한 시점 — 기준일
            "tab.trend.controls": "period",                     # 추이는 기간
            "tab.trend.endpoint": f"{FRED}/yield_curve_history?period={{period}}",
            "tab.trend.x": "date",
            "tab.trend.series": "m3:3M,m6:6M,y1:1Y,y2:2Y,y5:5Y,y10:10Y,y30:30Y",
            "tab.trend.pick": "y2,y10",
            "tab.trend.labels": "false",
        },
        "screens": [("/macro", "overview", 0, 1, 7, 6), ALL],
    },
    # ── CPI 구성: 가중치 도넛 + 항목별 상승률 · 기여도 ──
    {
        "widget_id": "cpi-breakdown",
        "name": "CPI Breakdown",
        "description": "CPI weights donut with YoY and contribution by component",
        "group_name": "Macro",
        "title": "CPI 구성",
        "view_type": "donut",
        "endpoint": f"{FRED}/inflation_decomposition?date={{date}}",
        "source": "$provider",
        "source_note": "{asOf} · 전년 대비",
        "transform": "cpi_breakdown",
        "empty_text": "CPI 데이터가 없어요",
        "size": (5, 6, 4, 4),
        "fields": [
            _field("VALUE", "weight"), _field("LABEL", "category"), _field("CHANGE", "yoy_change"),
        ],
        "params": [AS_OF],
        "options": {
            "provider": "fred",
            "centerLabel": "CPI", "labelHeader": "항목 · 가중치", "changeHeader": "상승률",
            "detail": "contribution", "detailHeader": "기여",
        },
        "screens": [("/macro", "overview", 7, 1, 5, 6), ALL],
    },
    # ── 고용: 주요 지표 목록 / 신규 실업수당 추이 ──
    {
        "widget_id": "labor-overview",
        "name": "Labor Overview",
        "description": "Key labor metrics · weekly initial claims with 4-week average",
        "group_name": "Macro",
        "view_type": "kv",
        "endpoint": f"{FRED}/labor_dashboard?date={{date}}",
        "source": "$provider",
        "transform": "labor_summary",
        "empty_text": "고용 데이터가 없어요",
        "size": (7, 6, 4, 4),
        "tabs": [
            ("summary", "고용", None, None, []),
            ("claims", "신규 실업수당", None, None, []),
        ],
        "params": [
            AS_OF,
            ("period", "기간", "1y", [
                ("3mo", "3M", None), ("6mo", "6M", None), ("1y", "1Y", None), ("5y", "5Y", None),
            ]),
        ],
        "options": {
            "provider": "fred",
            "tab.summary.controls": "date",
            "tab.claims.controls": "period",
            "tab.claims.view": "lines",
            "tab.claims.endpoint": f"{FRED}/initial_claims?period={{period}}",
            "tab.claims.x": "date",
            "tab.claims.series": "claims:신규 청구,ma_4w:4주 평균",
            "tab.claims.unit": "K",
            "tab.claims.digits": "0",
        },
        "screens": [("/macro", "overview", 0, 7, 7, 6), ALL],
    },
    # ── 공포 · 탐욕: 반원 게이지 하나 (VIX · HY 스프레드 · 10Y 로 계산한 합성 지수) ──
    {
        "widget_id": "fear-greed",
        "name": "Fear & Greed",
        "description": "Composite sentiment gauge (VIX · HY spread · 10Y)",
        "group_name": "Macro",
        "title": "공포 · 탐욕 지수",
        "view_type": "gauge",
        "endpoint": f"{FRED}/sentiment_composite?date={{date}}",
        "source": "$provider",
        "source_note": "VIX · HY 스프레드 · 10Y 합성",
        "transform": "fear_greed",
        "empty_text": "심리 지표가 없어요",
        "size": (5, 6, 3, 4),
        "fields": [_field("VALUE", "value")],
        "params": [AS_OF],
        "options": {"provider": "fred", "label": "Fear & Greed"},
        "screens": [("/macro", "overview", 7, 7, 5, 6), ALL],
    },
]


# ══ 지표 개념 (/macro · Global Indicators) ═══════════════════════════════════════
# provider 무관 지표 — 국가를 고르면 내 키로 쓸 수 있는 provider 를 서버가 고르고(/api/concepts),
# 머리줄의 데이터 소스 선택에서 다른 후보로 바꿀 수 있다. 코드 레지스트리의 같은 id 위젯을 대신한다.
def _concept(widget_id, concept, name, title, description, pos, country="USA"):
    return {
        "widget_id": widget_id,
        "name": name,
        "description": description,
        "group_name": "Macro",
        "title": title,
        "view_type": "lines",
        "endpoint": f"/concepts/{concept}?country={{country}}&period={{period}}&provider={{provider}}",
        "source": "$provider",
        "empty_text": "이 국가의 데이터가 없어요",
        "size": (6, 7, 4, 4),
        "params": [
            # 선택지는 그 개념이 지원하는 국가로 채운다 (optionsFrom) — 아래 둘은 못 불러왔을 때의 목록
            ("country", "국가", country, [("USA", "United States", None), ("KOR", "Korea", None)]),
            ("period", "기간", "10y", [
                ("1y", "1Y", None), ("3y", "3Y", None), ("5y", "5Y", None), ("10y", "10Y", None),
            ]),
        ],
        "options": {
            "x": "date", "series": f"value:{title}", "unit": "%",
            "optionsFrom.country": f"/concepts/{concept}/countries|code|label",
        },
        "screens": [("/macro", "global", *pos)],
    }


BUILTIN_WIDGETS += [
    _concept("concept-cpi", "cpi_yoy", "CPI Inflation", "CPI 상승률",
             "CPI YoY — pick a country and a data source", (0, 0, 6, 7)),
    _concept("concept-policy-rate", "policy_rate", "Policy Rate", "기준금리",
             "Central bank policy rate — pick a country and a data source", (6, 0, 6, 7), country="KOR"),
    _concept("concept-unemployment", "unemployment_rate", "Unemployment Rate", "실업률",
             "Seasonally adjusted unemployment — pick a country and a data source", (0, 7, 6, 7)),
    _concept("concept-long-rate", "long_rate_10y", "10Y Government Bond Yield", "10년 국채 금리",
             "10Y government bond yield — pick a country and a data source", (6, 7, 6, 7)),
    _concept("concept-gdp-growth", "real_gdp_growth", "Real GDP Growth", "실질 GDP 성장률",
             "Real GDP YoY — pick a country and a data source", (0, 14, 12, 7)),
]


# ══ 종목 (/stock · Overview) ═════════════════════════════════════════════════════
# 페이지에서 고른 종목({symbol})을 따른다. 게이트웨이 요청은 머리줄에서 데이터 소스를 바꿀 수 있다.
BUILTIN_WIDGETS += [
    # ── 요약 줄: 현재가 · 1년 최고/최저 · 베타 · 연 변동성 · 최근 배당 · 시가총액 (머리줄 없는 한 줄) ──
    {
        "widget_id": "stock-summary",
        "name": "Stock Summary",
        "description": "Price · 52-week high/low · beta · volatility · last dividend in one line",
        "group_name": "Stock",
        "title": "종목 요약",
        "view_type": "stats",
        "endpoint": f"{GATEWAY}/key_metrics?symbol={{symbol}}",
        "source": "$provider",
        "transform": "stock_kpis",
        "quote_key": "$symbol",
        "default_symbol": "AAPL",
        "empty_text": "{symbol} 지표를 불러오지 못했어요",
        "size": (12, 1, 6, 1),
        "options": {
            "provider": "yahoo",
            "extra.quote": "/stock/quote/{symbol}",
            "extra.history": f"{HISTORY}?period=1y&interval=1d",      # 연 변동성 (+ 1년 최고/최저의 대체 값)
            "extra.dividends": "/stock/dividends/{symbol}?period=2y",
        },
        "screens": [("/stock", "overview", 0, 0, 12, 1), ALL],
    },
    # ── 차트: 캔들 + 거래량 + 5봉 이동평균 ──
    {
        "widget_id": "stock-chart",
        "name": "Stock Chart",
        "description": "Candles + volume with a 5-bar moving average (5m · 1D · 1W · 1M)",
        "group_name": "Stock",
        "title": "차트",
        "view_type": "candles",
        "endpoint": f"{HISTORY}?period={{period}}&interval={{interval}}",
        "source": "yahoo",
        "source_note": "{note} · 이동평균 5",
        "transform": "bars_window",
        "quote_key": "$symbol",
        "default_symbol": "AAPL",
        "empty_text": "{symbol} 차트 데이터가 없어요",
        "size": (8, 7, 4, 4),
        "params": [
            ("bar", "봉 간격", "1d", [
                ("5m", "5분", "period=5d&interval=5m&session=true&note=5분봉"),
                ("1d", "일", "period=6mo&interval=1d&take=90&note=일봉"),
                ("1wk", "주", "period=2y&interval=1wk&take=90&note=주봉"),
                ("1mo", "월", "period=10y&interval=1mo&take=90&note=월봉"),
            ]),
        ],
        "options": {"headline": "false", "ma": "5"},   # 종목·현재가는 요약 줄이 보여 준다
        "screens": [("/stock", "overview", 0, 1, 8, 7), ALL],
    },
    # ── 기관 보유: 보유 가치 큰 순, 막대 = 1위 대비 ──
    {
        "widget_id": "stock-holders",
        "name": "Top Holders",
        "description": "Largest institutional holders by value",
        "group_name": "Stock",
        "title": "기관 보유",
        "view_type": "bars",
        "endpoint": f"{GATEWAY}/holders?symbol={{symbol}}",
        "source": "$provider",
        "source_note": "{asOf}",
        "transform": "holders_top",
        "default_symbol": "AAPL",
        "empty_text": "{symbol} 기관 보유 데이터가 없어요",
        "size": (4, 7, 3, 4),
        "fields": [_field("LABEL", "name"), _field("VALUE", "value")],
        "options": {"provider": "yahoo", "prefix": "$", "format": "compact", "digits": "2"},
        "screens": [("/stock", "overview", 8, 1, 4, 7), ALL],
    },
    # ── 뉴스 · 공시: 한 목록(최신 순) / 뉴스만 / 공시만 ──
    {
        "widget_id": "stock-feed",
        "name": "News & Filings",
        "description": "Company news and SEC filings in one list",
        "group_name": "Stock",
        "view_type": "list",
        # 공시(SEC — 키 없이 된다)가 주 요청, 뉴스(Polygon 키 필요)는 보조 요청 — 키가 없으면 공시만 나온다
        "endpoint": "/data/sec/filings?symbol={symbol}&form_type=10-K,10-Q,8-K&limit=20",
        "source": "$provider",
        "transform": "feed_rows",
        "default_symbol": "AAPL",
        "empty_text": "{symbol} 뉴스 · 공시가 없어요",
        "size": (8, 5, 4, 3),
        "tabs": [
            ("all", "뉴스 · 공시", None, None, []),
            ("news", "뉴스", "feed_news", "{symbol} 뉴스가 없어요", []),
            ("filings", "공시", "feed_filings", "{symbol} 공시가 없어요", []),
        ],
        "fields": [
            _field("TIME", "_time"), _field("TITLE", "title"),
            _field("HREF", "_href"), _field("TAG", "_tag"),
        ],
        "options": {
            "rowHeight": "40",
            "extra.news": "/news/?symbol={symbol}&limit=30&period=1mo",
        },
        "screens": [("/stock", "overview", 0, 8, 8, 5), ALL],
    },
    # ── 배당: 주당 배당금 세로 막대 ──
    {
        "widget_id": "stock-dividends",
        "name": "Dividend History",
        "description": "Dividend per share by payment",
        "group_name": "Stock",
        "title": "배당",
        "view_type": "columns",
        "endpoint": f"{GATEWAY}/dividends?symbol={{symbol}}&period={{period}}&end_date={{today}}",
        "source": "$provider",
        "source_note": "주당 · {currency}",
        "transform": "dividend_bars",
        "default_symbol": "AAPL",
        "empty_text": "{symbol} 배당 내역이 없어요",
        "size": (4, 5, 3, 3),
        "params": [
            ("period", "기간", "1y", [
                ("1y", "1Y", None), ("3y", "3Y", None), ("5y", "5Y", None), ("10y", "10Y", None),
            ]),
        ],
        "fields": [_field("LABEL", "_label"), _field("VALUE", "dividend")],
        "options": {"provider": "yahoo", "prefix": "$", "digits": "2"},
        "screens": [("/stock", "overview", 8, 8, 4, 5), ALL],
    },
]


# ══ 종목 (/stock · News & Filings) ═══════════════════════════════════════════════
BUILTIN_WIDGETS += [
    # ── 뉴스: 발행처 · 시각 · 감성 / 제목 / 요약 / 관련 종목 ──
    {
        "widget_id": "stock-news",
        "name": "Stock News",
        "description": "Company news with summary, sentiment and related tickers",
        "group_name": "Stock",
        "title": "뉴스",
        "view_type": "articles",
        "endpoint": "/news/?symbol={symbol}&limit=50&period={period}",
        "source": "$provider",
        "transform": "news_articles",
        "default_symbol": "AAPL",
        "empty_text": "{symbol} 뉴스가 없어요",
        "size": (7, 11, 4, 4),
        "params": [
            ("period", "기간", "1w", [("1w", "1W", None), ("1mo", "1M", None), ("3mo", "3M", None)]),
        ],
        "options": {
            "source": "publisher", "time": "_time", "title": "title", "summary": "description",
            "href": "article_url", "tags": "tickers", "sentiment": "sentiment",
            "sentiments": "positive:긍정,negative:부정,neutral:중립",
            "tones": "positive:up,negative:down",
        },
        "screens": [("/stock", "news", 0, 0, 7, 11), ALL],
    },
    # ── SEC 공시 표: 제출일 · 유형 · 내용 (전체 / 정기 / 수시) ──
    {
        "widget_id": "stock-filings",
        "name": "SEC Filings",
        "description": "Filings table — date, form type and subject",
        "group_name": "Stock",
        "view_type": "table",
        # form_type 을 안 적으면 내부자 거래(Form 4)가 목록을 채운다 — 정기 · 수시 보고서만 받는다
        "endpoint": f"{GATEWAY}/filings?symbol={{symbol}}&form_type=10-K,10-Q,8-K&limit=100&period={{period}}",
        "source": "$provider",
        "transform": "filing_rows",
        "default_symbol": "AAPL",
        "empty_text": "{symbol} 공시가 없어요",
        "size": (5, 11, 3, 4),
        "params": [
            ("period", "기간", "1y", [("3mo", "3M", None), ("1y", "1Y", None), ("3y", "3Y", None), ("5y", "5Y", None)]),
        ],
        "tabs": [
            ("all", "SEC 공시", None, None, []),
            ("periodic", "10-K · 10-Q", "filings_periodic", "{symbol} 정기 보고서가 없어요", []),
            ("current", "8-K", "filings_current", "{symbol} 수시 보고서가 없어요", []),
        ],
        "fields": [
            _field("COLUMN", "_date", "muted", "제출일", width=92),
            _field("COLUMN", "report_type", "badge", "유형", width=72, sub="_tone"),
            _field("COLUMN", "_subject", "link", "내용", sub="report_url"),
        ],
        "options": {"provider": "sec", "rowHeight": "36", "fixed": "true", "minWidth": "0"},
        "screens": [("/stock", "news", 7, 0, 5, 11), ALL],
    },
]


# ══ 기관 13F (/stock · Institutional Holdings) ═══════════════════════════════════
# 고른 기관은 화면 변수(institution)다 — 순위 표에서 행을 누르거나 머리줄에서 고르면 네 위젯이 같이 따른다.
# 13F 는 로컬 배치가 적재한 값만 읽는다 (서버에서 원본을 파싱하지 않는다).
INSTITUTION = ("institution", "기관", "berkshire", [("berkshire", "Berkshire Hathaway", None)])
INSTITUTION_OPTIONS = {
    "shared": "institution",
    "optionsFrom.institution": "/portfolio/13f/institutions|key|name",
}

BUILTIN_WIDGETS += [
    # ── 고른 기관 요약 줄 (머리줄 없는 한 줄) ──
    {
        "widget_id": "inst-summary",
        "name": "Institution Summary",
        "description": "Selected 13F filer — value, holdings, QoQ change, turnover in one line",
        "group_name": "Institutions",
        "title": "기관 요약",
        "view_type": "kpis",
        "endpoint": "/portfolio/13f/{institution}?summary_only=true",
        "source": "$provider",
        "transform": "inst_kpis",
        "empty_text": "13F 데이터가 없어요",
        "size": (12, 1, 6, 1),
        "params": [INSTITUTION],
        "options": dict(INSTITUTION_OPTIONS),
        "screens": [("/stock", "institutional", 0, 0, 12, 1), ALL],
    },
    # ── 기관 순위: 행을 누르면 그 기관을 고른다 ──
    {
        "widget_id": "inst-ranking",
        "name": "Institution Ranking",
        "description": "13F filers ranked by value, holdings or QoQ change — click a row to select",
        "group_name": "Institutions",
        "title": "기관 순위",
        "view_type": "table",
        "endpoint": "/portfolio/13f/summaries",
        "source": "$provider",
        "source_note": "13F · 일 배치 적재",
        "transform": "inst_rank",
        "empty_text": "적재된 13F 가 없어요",
        "size": (8, 8, 5, 4),
        "params": [
            ("sortBy", "정렬 기준", "total_value", [
                ("total_value", "보유가치", None),
                ("num_holdings", "종목 수", None),
                ("value_change_pct", "전분기 대비", None),
            ]),
        ],
        "fields": [
            _field("COLUMN", "rank", "rank", "순위", width=52),
            _field("COLUMN", "_name", "entity", "기관"),
            _field("COLUMN", "total_value", "money", "보유가치"),
            _field("COLUMN", "num_holdings", "number", "종목 수"),
            _field("COLUMN", "value_change_pct", "pill", "전분기 대비"),
            _field("COLUMN", "turnover", "bar", "회전율", width=128),
            _field("COLUMN", "filing_date", "muted", "제출일", width=96),
        ],
        "options": {"shared": "institution", "select": "institution:institution_key", "minWidth": "640"},
        "screens": [("/stock", "institutional", 0, 1, 8, 8), ALL],
    },
    # ── 펀드 성과 (13F 로 추정): 분기 수익률 막대 / 표 ──
    {
        "widget_id": "inst-performance",
        "name": "Fund Performance (est.)",
        "description": "Quarterly return estimated from 13F holdings — not actual NAV",
        "group_name": "Institutions",
        "view_type": "columns",
        "endpoint": "/portfolio/13f/{institution}/performance?quarters=8",
        "source": "$provider",
        "source_note": "누적 {cumulative} · {quarters}분기 · 13F 추정 (실제 NAV 아님)",
        "transform": "fund_perf",
        "empty_text": "추정 수익률이 적재돼 있지 않아요",
        "size": (4, 8, 3, 4),
        "params": [INSTITUTION],
        "tabs": [
            ("chart", "펀드 성과 (추정)", None, None, []),
            ("table", "분기별", None, None, []),
        ],
        "fields": [
            _field("LABEL", "_label"), _field("VALUE", "return_pct"),
            # '분기별' 탭의 표 컬럼
            _field("COLUMN", "period", "muted", "분기말"),
            _field("COLUMN", "return_pct", "change", "수익률"),
            _field("COLUMN", "total_value", "money", "보유가치"),
        ],
        "options": {
            **INSTITUTION_OPTIONS,
            "tone": "true", "digits": "1",
            "tab.table.view": "table",
            "tab.table.transform": "fund_perf_table",
            "tab.table.minWidth": "0",
            "tab.table.rowHeight": "32",
        },
        "screens": [("/stock", "institutional", 8, 1, 4, 8), ALL],
    },
    # ── 고른 기관의 보유 종목 / 청산 종목 ──
    {
        "widget_id": "inst-holdings",
        "name": "Institution Holdings",
        "description": "Top 13F positions of the selected filer with weight and share change",
        "group_name": "Institutions",
        "view_type": "table",
        "endpoint": "/portfolio/13f/{institution}?limit=50",
        "source": "$provider",
        "transform": "inst_stocks",
        "empty_text": "보유 종목이 없어요",
        "size": (12, 8, 5, 4),
        "params": [INSTITUTION],
        "tabs": [
            ("stocks", "상위 보유 종목", None, None, []),
            ("sold", "청산", None, "이번 분기에 청산한 종목이 없어요", []),
        ],
        "fields": [
            _field("COLUMN", "rank", "rank", "순위", width=52),
            # 13F 의 symbol 은 티커가 아니라 CUSIP 앞자리다 — 종목 화면으로 잇지 않고 이름만 보여 준다
            _field("COLUMN", "name", "entity", "종목"),
            _field("COLUMN", "value", "money", "보유가치"),
            _field("COLUMN", "weight", "bar", "비중", width=128),
            _field("COLUMN", "shares", "compact", "주식 수"),
            _field("COLUMN", "share_change_pct", "pill", "주식 수 변화"),
            _field("COLUMN", "_move", "badge", "매매", width=72, sub="_tone"),
        ],
        "options": {**INSTITUTION_OPTIONS, "minWidth": "680", "tab.sold.transform": "inst_sold"},
        "screens": [("/stock", "institutional", 0, 9, 12, 8), ALL],
    },
]


# ══ 백테스트 결과 (/backtest · Results) ══════════════════════════════════════════
# 결과 위젯은 머리줄 전략 드롭다운(StrategyPicker)이 고른 전략을 화면 변수로 따른다 (기간 · 벤치마크 · 비용은 서버 기본값).
# 전략은 웹에서 만들고(/api/strategies), 서버가 월별 패널(mbs_in_quant_panel)로 바로 계산한다
RUN_VARS = "strategy,bt_start,bt_end,bt_bench,bt_cost,bt_rev"
RUN_OPTIONS = {"shared": RUN_VARS}
RUN_ENDPOINT = ("/strategies/result?strategy={strategy}&start={bt_start}&end={bt_end}"
                "&benchmark={bt_bench}&cost={bt_cost}&rev={bt_rev}")
RUN_EMPTY = "전략 계산 재료(월별 패널)가 아직 없어요 — 로컬에서 build_quant.py 를 실행한 뒤 동기화해 주세요"
WINDOW = ("window", "기간", "all", [
    ("all", "전체", "months=0"), ("5y", "5Y", "months=60"), ("3y", "3Y", "months=36"), ("1y", "1Y", "months=12"),
])

BUILTIN_WIDGETS += [
    # ── 성과 요약 줄 (머리줄 없는 한 줄) ──
    {
        "widget_id": "bt-run-summary",
        "name": "Backtest Summary",
        "description": "Return, CAGR, Sharpe, drawdown, win rate vs the benchmark in one line",
        "group_name": "Backtest",
        "title": "성과 요약",
        "view_type": "kpis",
        "endpoint": RUN_ENDPOINT,
        "source": "$provider",
        "transform": "bt_kpis",
        "empty_text": RUN_EMPTY,
        "size": (12, 1, 6, 1),
        "options": dict(RUN_OPTIONS),
        "screens": [("/backtest", "results", 0, 2, 12, 1), ALL],
    },
    # ── 누적 수익 · 낙폭 ──
    {
        "widget_id": "bt-run-equity",
        "name": "Equity & Drawdown",
        "description": "Cumulative return vs the benchmark with the drawdown pane",
        "group_name": "Backtest",
        "title": "누적 수익 · 낙폭",
        "view_type": "curve",
        "endpoint": RUN_ENDPOINT,
        "source": "$provider",
        "source_note": "비용 차감 후",
        "transform": "bt_equity",
        "empty_text": RUN_EMPTY,
        "size": (8, 7, 4, 4),
        "params": [WINDOW],
        "options": {
            **RUN_OPTIONS,
            "x": "date", "series": "strategy:전략,benchmark:벤치마크", "drawdown": "drawdown",
            "excess": "true", "unit": "%", "digits": "1",
        },
        "screens": [("/backtest", "results", 0, 3, 8, 7), ALL],
    },
    # ── 월별 수익률 격자 ──
    {
        "widget_id": "bt-run-monthly",
        "name": "Monthly Returns",
        "description": "Year × month return grid with annual totals",
        "group_name": "Backtest",
        "title": "월별 수익률",
        "view_type": "heatmap",
        "endpoint": RUN_ENDPOINT,
        "source": "$provider",
        "source_note": "전략 · %",
        "transform": "bt_monthly",
        "empty_text": RUN_EMPTY,
        "size": (4, 7, 3, 4),
        "options": {**RUN_OPTIONS, "row": "year", "col": "month", "value": "value"},
        "screens": [("/backtest", "results", 8, 3, 4, 7), ALL],
    },
    # ── 거래 내역 ──
    {
        "widget_id": "bt-run-trades",
        "name": "Backtest Trades",
        "description": "Each holding: added / removed, months held and return",
        "group_name": "Backtest",
        "title": "거래 내역",
        "view_type": "table",
        "endpoint": RUN_ENDPOINT,
        "source": "$provider",
        "transform": "bt_trades",
        "empty_text": "이 기간에 거래가 없어요",
        "size": (7, 6, 4, 3),
        "params": [WINDOW],
        "fields": [
            _field("COLUMN", "symbol", "text", "종목", width=72),
            _field("COLUMN", "_entry", "muted", "편입일", width=96),
            _field("COLUMN", "entryPrice", "number", "편입가"),
            _field("COLUMN", "_exit", "muted", "편출일", width=96),
            _field("COLUMN", "exitPrice", "number", "편출가"),
            _field("COLUMN", "bars", "number", "보유 개월"),
            _field("COLUMN", "returnPct", "change", "수익률"),
            _field("COLUMN", "_state", "badge", "상태", width=72, sub="_tone"),
        ],
        "options": {**RUN_OPTIONS, "rowHeight": "36", "minWidth": "560"},
        "screens": [("/backtest", "results", 0, 10, 7, 6), ALL],
    },
    # ── 롤링 샤프 (점선 = 1.0) ──
    {
        "widget_id": "bt-run-rolling",
        "name": "Rolling Sharpe",
        "description": "Rolling annualized Sharpe of the strategy",
        "group_name": "Backtest",
        "title": "롤링 샤프",
        "view_type": "curve",
        "endpoint": RUN_ENDPOINT,
        "source": "$provider",
        "source_note": "창 {window} · 점선 = 1.0",
        "transform": "bt_rolling",
        "empty_text": "롤링 샤프를 계산하기에는 실행 기간이 짧아요",
        "size": (5, 6, 3, 3),
        "options": {
            **RUN_OPTIONS,
            "x": "date", "series": "sharpe:롤링 샤프", "refs": "1", "unit": "", "digits": "2", "signed": "false",
        },
        "screens": [("/backtest", "results", 7, 10, 5, 6), ALL],
    },
    # ── 전략별 손익: 같은 조건(기간 · 벤치마크 · 비용)으로 전략마다 실행 — 칩으로 골라 겹쳐 본다 ──
    # 계열(전략 목록)은 응답에서 온다 (transform 이 meta.series 로) — 내 전략이 늘어도 행을 고치지 않는다
    {
        "widget_id": "bt-compare",
        "name": "Strategy P&L",
        "description": "Cumulative return of each strategy under the same period, benchmark and cost — pick which to overlay",
        "group_name": "Backtest",
        "title": "전략별 손익",
        "view_type": "lines",
        "endpoint": "/strategies/compare?start={bt_start}&end={bt_end}&benchmark={bt_bench}&cost={bt_cost}&rev={bt_rev}",
        "source": "$provider",
        "source_note": "비용 차감 후 · 전략마다 첫 달 = 0",
        "transform": "bt_compare",
        "empty_text": RUN_EMPTY,
        "size": (12, 7, 6, 4),
        "tabs": [
            ("pnl", "누적 손익", None, None, []),
            ("table", "성과 비교", None, None, []),
        ],
        "fields": [
            _field("COLUMN", "name", "text", "전략"),
            _field("COLUMN", "_kind", "badge", "점수", width=72, sub="_tone"),
            _field("COLUMN", "totalReturn", "change", "누적 수익률"),
            _field("COLUMN", "cagr", "change", "CAGR"),
            _field("COLUMN", "_sharpe", "value", "샤프"),
            _field("COLUMN", "maxDrawdown", "change", "최대 낙폭"),
            _field("COLUMN", "_vol", "muted", "변동성"),
            _field("COLUMN", "_turnover", "muted", "회전율"),
            _field("COLUMN", "_period", "muted", "기간", width=128),
        ],
        "options": {
            **RUN_OPTIONS,
            "x": "date", "max": "6", "unit": "%", "digits": "1",
            "tab.table.view": "table",
            "tab.table.transform": "bt_compare_table",
            "tab.table.rowHeight": "36",
            "tab.table.minWidth": "720",
        },
        "screens": [("/backtest", "results", 0, 16, 12, 7), ALL],
    },
]


# ══ 퀀트 (/quantlib · Factors & ML) ══════════════════════════════════════════════
# 팩터 → 예측 모델 → 시그널 융합. 계산은 로컬 배치(MarketpulseBatch/jobs/build_quant.py)가 하고
# 서버는 적재된 값(mbs_in_quant_snapshot)을 읽기만 한다. 적재 전에는 빈 화면 문구가 나온다.
QUANT = "/quant/{dataset}?universe={universe}"
QUANT_EMPTY = "퀀트 산출물이 아직 적재되지 않았어요 — 로컬에서 build_quant.py 를 실행해 주세요"
UNIVERSE = ("universe", "유니버스", "sp500", [("sp500", "S&P 500", None)])
# 팩터 id 는 배치(index_analyzer/quant/factors.py)의 FACTORS 와 같다
FACTOR_SERIES = "composite:합성,mom_12_1:모멘텀 12-1,mom_6_1:모멘텀 6-1,rev_1m:단기 반전,lowvol:저변동성,high52:52주 고가,trend:추세"


def _quant(dataset):
    return QUANT.replace("{dataset}", dataset)


BUILTIN_WIDGETS += [
    # ── 팩터: 정보계수(IC) · ICIR · 적중률 · 연 롱숏 ──
    {
        "widget_id": "quant-factors",
        "name": "Factors",
        "description": "Price factors with rank IC, ICIR, hit rate and long-short return",
        "group_name": "Quant",
        "title": "팩터",
        "view_type": "table",
        "endpoint": _quant("factors"),
        "source": "$provider",
        "source_note": "{used} · 동일 비중 · {members}종목",
        "transform": "quant_factors",
        "empty_text": QUANT_EMPTY,
        "size": (4, 7, 4, 4),
        "params": [UNIVERSE],
        # 스위치로 끈 팩터는 화면 변수 quant_off 에 모인다 — 머리줄 '백테스트로 보내기'가 켠 팩터로 전략을 만든다
        "fields": [
            _field("COLUMN", "_toggle", "switch", "", width=44, sub="quant_off"),
            _field("COLUMN", "name", "text", "팩터"),
            _field("COLUMN", "_w", "value_muted", "비중", width=48),
            _field("COLUMN", "_ic", "value", "IC", width=60),
            _field("COLUMN", "_icir", "value_muted", "ICIR", width=52),
            _field("COLUMN", "ls_ann", "change", "연 롱숏", width=72),
            _field("COLUMN", "_kind", "badge", "", width=52, sub="_tone"),
        ],
        "options": {"shared": "universe,quant_off", "rowHeight": "40", "minWidth": "400",
                    "muteBy": "_off", "highlight": "quant_step:factor"},
        "screens": [("/quantlib", "factors", 0, 0, 4, 7), ALL],
    },
    # ── 팩터 성과: 롱숏 누적 수익(계열 칩 비교) / 합성 점수 분위 수익률 ──
    {
        "widget_id": "quant-factor-returns",
        "name": "Factor Performance",
        "description": "Long-short cumulative return by factor · quintile returns of the composite score",
        "group_name": "Quant",
        "view_type": "lines",
        "endpoint": _quant("factor_returns"),
        "source": "$provider",
        "source_note": "상위 20% 롱 · 하위 20% 숏 · 최근 5년 · 비용 없음",
        "transform": "quant_meta",
        "empty_text": QUANT_EMPTY,
        "size": (8, 7, 4, 4),
        "params": [UNIVERSE],
        "tabs": [
            ("ls", "롱숏 누적 수익", None, None, []),
            ("q", "분위 수익률", None, None, []),
        ],
        "fields": [_field("LABEL", "q"), _field("VALUE", "value")],
        "options": {
            "shared": "universe", "highlight": "quant_step:factor",
            "x": "date", "series": FACTOR_SERIES, "pick": "composite,mom_12_1,lowvol", "max": "4",
            "unit": "%", "digits": "1",
            "tab.q.view": "columns",
            "tab.q.endpoint": _quant("quantiles"),
            "tab.q.transform": "quant_meta",
            "tab.q.tone": "true",
        },
        "screens": [("/quantlib", "factors", 4, 0, 8, 7), ALL],
    },
    # ── 예측 모델: 표본 밖 정확도 · AUC · 샤프 · 스태킹 비중 / 시장 국면 띠 ──
    {
        "widget_id": "quant-models",
        "name": "ML Models",
        "description": "Walk-forward out-of-sample accuracy, AUC and Sharpe per model · market regime",
        "group_name": "Quant",
        "view_type": "table",
        "endpoint": _quant("models"),
        "source": "$provider",
        "source_note": "워크포워드 표본 밖 {oos}개월 · 타깃: 다음 달 수익률 > 중앙값",
        "transform": "quant_models",
        "empty_text": QUANT_EMPTY,
        "size": (7, 6, 4, 3),
        "params": [UNIVERSE],
        "tabs": [
            ("models", "ML 모델", None, None, []),
            ("regime", "시장 국면", None, None, []),
        ],
        "fields": [
            _field("COLUMN", "name", "text", "모델", width=132),
            _field("COLUMN", "kind", "muted", "종류"),
            _field("COLUMN", "_acc", "value", "정확도", width=68),
            _field("COLUMN", "_auc", "value", "AUC", width=64),
            _field("COLUMN", "_sharpe", "value", "샤프", width=56),
            _field("COLUMN", "weight", "bar", "스태킹 비중", width=132),
            _field("COLUMN", "_kind", "badge", "", width=52, sub="_tone"),
        ],
        "options": {
            "shared": "universe", "highlight": "quant_step:ml",
            "rowHeight": "40", "minWidth": "640", "fixed": "true",
            "tab.regime.view": "strip",
            "tab.regime.endpoint": _quant("regimes"),
            "tab.regime.transform": "quant_meta",
            "tab.regime.x": "date", "tab.regime.state": "state",
            "tab.regime.states": "bull:강세,side:횡보,bear:약세",
            "tab.regime.value": "p", "tab.regime.valueLabel": "확률",
        },
        "screens": [("/quantlib", "factors", 0, 7, 7, 6), ALL],
    },
    # ── 시그널 융합: 종목별 다음 달 초과수익 확률 (단순 평균 / 스태킹) ──
    {
        "widget_id": "quant-signals",
        "name": "Signal Fusion",
        "description": "Stocks ranked by fused probability of beating the median next month",
        "group_name": "Quant",
        "title": "시그널 융합",
        "view_type": "table",
        "endpoint": _quant("signals"),
        "source": "$provider",
        "source_note": "{signalDate} · 상위 10% 매수 · 하위 10% 매도",
        "transform": "quant_signals",
        "empty_text": QUANT_EMPTY,
        "size": (5, 6, 4, 3),
        "params": [
            UNIVERSE,
            ("method", "융합 방식", "stack", [("avg", "단순 평균", None), ("stack", "스태킹", None)]),
        ],
        "fields": [
            _field("COLUMN", "rank", "rank", "#", width=44),
            _field("COLUMN", "symbol", "stock", "종목", sub="name"),
            _field("COLUMN", "_score", "bar", "확률", width=128),
            _field("COLUMN", "_signal", "badge", "시그널", width=64, sub="_tone"),
        ],
        "options": {"shared": "universe", "highlight": "quant_step:fusion", "rowHeight": "38", "minWidth": "420"},
        "screens": [("/quantlib", "factors", 7, 7, 5, 6), ALL],
    },
]

# 모든 기본 제공 위젯의 메뉴 분류 (group_name 을 따로 적지 않은 것)
DEFAULT_GROUP = "Home"


# ══ 운영 모니터링 (/admin · Monitoring) — 관리자만 (API 가 require_admin) ═══════════════════
# 값은 서버 프로세스 메모리에 있다 (services/monitor_service.py) — 재시작하면 처음부터 다시 쌓인다.
# 다른 화면의 메뉴에는 내놓지 않는다 (관리자가 아니면 403 이라 빈 위젯만 생긴다).
MONITOR = "/admin/monitor/"
MONITOR_EMPTY = "아직 쌓인 값이 없어요 — 15초쯤 뒤에 채워져요"
MONITOR_TAB = ("/admin", "monitor")

BUILTIN_WIDGETS += [
    # ── 요약 줄: 가동 · 부하 · CPU · 메모리 · 스왑 · 컨테이너 · 요청 · p95 · 처리 중 ──
    {
        "widget_id": "ops-summary",
        "name": "Server Summary",
        "description": "Uptime, load, CPU, memory, swap, container memory, requests, p95 and in-flight in one line",
        "group_name": "Operations",
        "title": "서버 상태",
        "view_type": "kpis",
        "endpoint": MONITOR + "summary",
        "source": "$provider",
        "refresh_sec": 10,
        "live_yn": "Y",
        "empty_text": MONITOR_EMPTY,
        "size": (12, 1, 6, 1),
        "screens": [(*MONITOR_TAB, 0, 0, 12, 1)],
    },
    # ── 자원 추이 (15초 표본 · 최근 2시간) ──
    {
        "widget_id": "ops-system",
        "name": "Server Resources",
        "description": "CPU, I/O wait, memory, swap and container memory every 15 seconds (last 2 hours)",
        "group_name": "Operations",
        "view_type": "lines",
        "endpoint": MONITOR + "system",
        "source": "$provider",
        "source_note": "15초 표본 · 최근 2시간",
        "refresh_sec": 15,
        "empty_text": MONITOR_EMPTY,
        "size": (8, 6, 4, 4),
        "tabs": [
            ("res", "사용률", None, None, []),
            ("mem", "메모리", None, None, []),
            ("load", "부하 · 스왑 I/O", None, None, []),
        ],
        "options": {
            "x": "time", "max": "6",
            "tab.res.series": "cpu_pct:CPU,iowait_pct:I/O 대기,app_cpu_pct:앱 CPU,mem_pct:메모리,swap_pct:스왑,cg_pct:컨테이너",
            "tab.res.pick": "cpu_pct,iowait_pct,mem_pct,cg_pct",
            "tab.res.unit": "%", "tab.res.digits": "0",
            "tab.mem.series": "mem_mb:호스트 사용,cg_mb:컨테이너,rss_mb:앱 RSS,swap_mb:스왑",
            "tab.mem.unit": "MB", "tab.mem.digits": "0",
            "tab.load.series": "load1:부하 1분,load5:부하 5분,inflight:처리 중,threads:스레드,swap_in_kbs:스왑 in KB/s,swap_out_kbs:스왑 out KB/s",
            "tab.load.pick": "load1,inflight,threads,swap_in_kbs",
            "tab.load.digits": "1",
        },
        "screens": [(*MONITOR_TAB, 0, 1, 8, 6)],
    },
    # ── 지금 처리 중인 요청 · 최근 느린 요청 / 5xx ──
    {
        "widget_id": "ops-requests",
        "name": "Live Requests",
        "description": "Requests in flight (longest first) and recent slow (>1s) or 5xx requests",
        "group_name": "Operations",
        "view_type": "table",
        "endpoint": MONITOR + "inflight",
        "source": "$provider",
        "refresh_sec": 5,
        "live_yn": "Y",
        "size": (4, 6, 3, 4),
        "tabs": [
            ("inflight", "처리 중", None, "지금 처리 중인 요청이 없어요", []),
            ("slow", "느린 요청 · 오류", None, "1초 넘게 걸린 요청이나 5xx 가 없어요", []),
        ],
        "fields": [
            _field("COLUMN", "time", "muted", "시각", width=72),
            _field("COLUMN", "path", "text", "경로"),
            _field("COLUMN", "elapsed_ms", "number", "ms", width=60),
            _field("COLUMN", "_state", "badge", "", width=56, sub="_tone"),
        ],
        "options": {
            "rowHeight": "30", "fixed": "true", "minWidth": "0",
            "tab.slow.endpoint": MONITOR + "slow",
        },
        "screens": [(*MONITOR_TAB, 8, 1, 4, 6)],
    },
    # ── 분 단위 요청 수 · 응답 시간 ──
    {
        "widget_id": "ops-traffic",
        "name": "Traffic & Latency",
        "description": "Requests and errors per minute · p95 and average latency (last 2 hours)",
        "group_name": "Operations",
        "view_type": "lines",
        "endpoint": MONITOR + "traffic",
        "source": "$provider",
        "source_note": "분 단위 · /health · OPTIONS · 이 화면의 요청 제외",
        "refresh_sec": 30,
        "empty_text": MONITOR_EMPTY,
        "size": (6, 6, 4, 4),
        "tabs": [
            ("count", "요청 수", None, None, []),
            ("lat", "응답 시간", None, None, []),
        ],
        "options": {
            "x": "time", "digits": "0",
            "tab.count.series": "count:요청,errors:오류 (5xx)",
            "tab.lat.series": "p95_ms:p95,avg_ms:평균",
            "tab.lat.unit": "ms",
        },
        "screens": [(*MONITOR_TAB, 0, 7, 6, 6)],
    },
    # ── 경로별 누계 — 서버를 가장 오래 붙잡은 경로부터 ──
    {
        "widget_id": "ops-endpoints",
        "name": "Endpoints",
        "description": "Per-route count, average / p95 / max latency, total time and errors since start",
        "group_name": "Operations",
        "title": "경로별 성능",
        "view_type": "table",
        "endpoint": MONITOR + "endpoints",
        "source": "$provider",
        "source_note": "앱 시작 후 누계 · 쓴 시간 합이 큰 순",
        "refresh_sec": 30,
        "empty_text": MONITOR_EMPTY,
        "size": (6, 6, 4, 4),
        "fields": [
            _field("COLUMN", "route", "text", "경로"),
            _field("COLUMN", "count", "number", "횟수", width=56),
            _field("COLUMN", "avg_ms", "value", "평균 ms", width=64),
            _field("COLUMN", "p95_ms", "value_muted", "p95", width=56),
            _field("COLUMN", "max_ms", "value_muted", "최대", width=60),
            _field("COLUMN", "total_s", "value_muted", "합 (초)", width=60),
            _field("COLUMN", "errors", "number", "오류", width=44),
        ],
        "options": {"rowHeight": "30", "fixed": "true", "minWidth": "520"},
        "screens": [(*MONITOR_TAB, 6, 7, 6, 6)],
    },
]
