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
             'provider' 는 데이터 소스의 처음 값, 'optionsFrom.<컨트롤>' 은 선택지를 채울 요청 '경로|값|이름'

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
        "endpoint": "/stock/ranking/live?market=all&sort_by={sortBy}&limit=30",
        "source": "$provider,live",
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
        "options": {"series": f"{HISTORY}?period=1d&interval=5m"},
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
        "source": "$provider,live",
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
        "source": "sec,polygon",
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

# 모든 기본 제공 위젯의 메뉴 분류 (group_name 을 따로 적지 않은 것)
DEFAULT_GROUP = "Home"
