"""기본 제공 위젯의 처음 행 — DB 가 비어 있을 때 한 번 넣는 값.

위젯 정의의 주인은 DB(user_widgets 계열, user_id NULL)다. 이 파일은 새 DB 를 채우는
시드일 뿐이고, 화면은 여기를 읽지 않는다 — 넣은 뒤의 변경은 DB 행을 고친다.
(BuiltinWidgetService.list 가 기본 제공 행이 하나도 없을 때 이 목록을 넣는다.)

한 위젯의 모양 (키 이름 = 컬럼 이름):
    master   widget_id · name · description · group_name · title · view_type · endpoint · data_path ·
             source · source_note · transform · quote_key · refresh_sec · live_yn · default_symbol ·
             empty_text · size (w, h, min_w, min_h)
    params   헤더 선택지 — (param_name, label, 기본값, [(값, 라벨, option_params)])
    fields   (field_role, field_name, format, label, width, sub_field, quote_field)
    tabs     (tab_code, label, filter, empty_text, [(symbol, name)])
    options  { opt_name: opt_value }
    screens  (screen, tab, x, y, w, h) — 위치가 있으면 그 화면·탭의 기본 배치, '*' 는 모든 화면의 메뉴
"""

HISTORY = "/stock/history/{symbol}"
ALL = ("*", None, None, None, None, None)   # 모든 화면의 위젯 메뉴에 내놓는다 (배치는 없음)


def _field(role, name, fmt="text", label=None, width=None, sub=None, quote=None):
    return {"field_role": role, "field_name": name, "format": fmt, "label": label,
            "width": width, "sub_field": sub, "quote_field": quote}


BUILTIN_WIDGETS = [
    # ── 지수 / 환율·원자재 타일 ──
    {
        "widget_id": "index-tiles",
        "name": "Indices",
        "description": "Index / FX · commodity tiles with sparklines",
        "view_type": "tiles",
        "source": "yahoo",
        "quote_key": "symbol",
        "size": (9, 3, 4, 2),
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
        "screens": [("/", "overview", 0, 0, 9, 3), ALL],
    },
    # ── 주요 일정 (오늘의 경제 캘린더) ──
    {
        "widget_id": "key-events",
        "name": "Key Events",
        "description": "Today's economic events at a glance",
        "title": "주요 일정",
        "view_type": "list",
        "endpoint": "/data/nasdaq/economic_calendar?date={today}",
        "source": "nasdaq",
        "transform": "events_by_time",
        "empty_text": "오늘 일정이 없어요",
        "size": (3, 3, 3, 2),
        "fields": [
            _field("TIME", "time"), _field("TITLE", "event"), _field("SUB", "country"),
            _field("VALUE", "_value"), _field("VALUE_MUTED", "_muted"), _field("DOT", "_dot"),
        ],
        "options": {"rowHeight": "30", "consensusLabel": "예상"},
        "screens": [("/", "overview", 9, 0, 3, 3), ALL],
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
]

# 모든 기본 제공 위젯의 메뉴 분류 (group_name 을 따로 적지 않은 것)
DEFAULT_GROUP = "Home"
