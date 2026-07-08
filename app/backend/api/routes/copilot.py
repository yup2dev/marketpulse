"""
Copilot — AI 어시스턴트 (OpenBB Copilot 스타일). Claude / Gemini 멀티 프로바이더.

프론트엔드 우측 채팅 패널이 POST /api/copilot/chat 으로 대화를 보내면,
LLM이 도구(tool use)로 MarketPulse 내부 API를 직접 호출해 데이터를 조회·가공하고,
add_widget 도구로 대시보드에 위젯 추가를 지시한다. 응답은 SSE로 스트리밍.

- LLM 키는 'API 키 관리'(Settings → /api/keys, provider=anthropic|gemini)에 저장된
  사용자 키를 우선 사용하고, 없으면 서버 .env(ANTHROPIC_API_KEY/GEMINI_API_KEY) 폴백.
  둘 다 등록돼 있으면 anthropic 우선(요청 body의 provider로 강제 선택 가능).
- Gemini는 무료 티어(aistudio.google.com 키)로 동작하며, SDK 없이 REST(v1beta
  streamGenerateContent?alt=sse)로 호출한다.
- 데이터 조회는 별도 커넥터 없이 '이 서버 자신의 REST API'를 in-process(ASGI)로 호출한다.
  요청자의 Bearer 토큰을 그대로 전달하므로 인증/사용자 컨텍스트(Fetcher 위임 포함)가 유지된다.
- 위젯 추가는 서버가 직접 할 수 없으므로 SSE `widget` 이벤트로 프론트에 위임한다.
  합성 데이터셋(create_dataset_widget)도 같은 방식 — 서버 저장소 없이 rows 전체가
  SSE로 프론트에 전달되고 localStorage(copilot-ds:{id})에 보관된다.
"""
import json
import logging
import uuid
from typing import Any, AsyncIterator, Optional

import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.backend.core.auth.dependencies import get_current_active_user
from app.backend.core.config import settings
from app.backend.services import user_key_service
from index_analyzer.models.orm import User

log = logging.getLogger(__name__)

router = APIRouter()

MAX_TOOL_ITERATIONS = 8          # tool-use 왕복 상한 (폭주 방지)
MAX_TOOL_RESULT_CHARS = 15000    # tool 결과가 컨텍스트를 잠식하지 않도록 축약
MAX_LIST_ITEMS = 40

# create_dataset_widget 한도 — 데이터는 SSE→localStorage로 가므로 과대 페이로드 방지
MAX_DATASET_ROWS = 300
MAX_DATASET_CHARS = 300_000
_CHART_TYPES = {"line", "area", "bar", "stackedBar", "pie", "donut"}

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"

# ── get_data 화이트리스트 — GET 전용, 이 prefix 밖은 거부 ─────────────────────
_ALLOWED_PREFIXES = (
    "/api/stock/",
    "/api/data/",
    "/api/macro/",
    "/api/news",
    "/api/portfolio/",
    "/api/user-portfolio/",
    "/api/screener/presets",
    "/api/screener/sectors",
    "/api/providers",
    "/api/quantitative/",
    "/api/quantlib/",
    "/api/v1/",
    "/api/reports",
)

# ── 시스템 프롬프트 (정적 — prompt cache 대상. 동적 컨텍스트는 user 턴에 주입) ──
SYSTEM_PROMPT = """You are MarketPulse Copilot, an AI assistant embedded in the MarketPulse financial dashboard web app.

Your job:
1. Answer questions about stocks, macro data, portfolios, and markets by fetching REAL data through the `get_data` tool (never invent numbers).
2. Process/aggregate the fetched data and explain it clearly (tables, bullet summaries, computed ratios, YoY changes, index rebasing, etc.).
3. When a visualization or persistent view would help — or when the user asks — put it on the user's dashboard: `add_widget` for standard catalog widgets, `create_dataset_widget` for data YOU fetched and combined.
4. Help the user navigate/use the app (widgets can be added via the "+ Widget" button; pages: / dashboard, /stock, /macro, /portfolios, /screener, /quantlib, /backtest).

Always respond in the same language the user writes in (usually Korean).

## get_data — internal REST API catalog (GET only, path starts with /api)

### Universal Data Gateway (preferred for raw data)
- /api/data/{provider}/{model}?param=value — e.g.:
  - /api/data/yahoo/quote?symbol=AAPL — realtime quote
  - /api/data/yahoo/stock_price?symbol=AAPL&period=1y — OHLCV history
  - /api/data/fmp/company_profile?symbol=AAPL
  - /api/data/fmp/income_statement?symbol=AAPL
  - /api/data/fmp/analyst_estimates?symbol=AAPL
  - /api/data/fmp/gainers, /api/data/fmp/losers, /api/data/fmp/most_actives
  - /api/data/fred/gdp?period=5y, /api/data/fred/cpi?period=5y, /api/data/fred/unemployment?period=5y
  - /api/data/fred/yield_curve, /api/data/fred/yield_curve_history?period=5y
  - /api/data/fred/inflation_momentum?period=3y, /api/data/fred/pmi?period=5y
  - /api/data/fred/fed_balance_sheet?period=10y, /api/data/fred/real_rates?period=5y
  - /api/data/fred/labor_dashboard, /api/data/fred/financial_conditions, /api/data/fred/sentiment_composite
  - /api/data/fred/jobs_breakdown?period=5y, /api/data/fred/initial_claims?period=2y, /api/data/fred/inflation_sector?period=5y
- /api/providers — lists every provider and which data models each supports (use for discovery when unsure).

### Stock endpoints
- /api/stock/dividends/{symbol}, /api/stock/splits/{symbol}, /api/stock/filings/{symbol}
- /api/stock/earnings/{symbol}, /api/stock/insider-trading/{symbol}, /api/stock/holders/{symbol}
- /api/stock/management/{symbol}, /api/stock/swot/{symbol}, /api/stock/moat/{symbol}
- /api/stock/scorecard/{symbol}, /api/stock/sentiment/{symbol}, /api/stock/financials/{symbol}
- /api/stock/ranking?market=all&sort_by=gainers&period=1d&limit=50

### Other
- /api/news?symbol=AAPL&limit=20 — financial news
- /api/portfolio/13f/institutions?use_dynamic=false — 20 featured 13F institutions
- /api/portfolio/13f/{institution_key} — holdings of one institution (berkshire, ark, bridgewater, ...)
- /api/user-portfolio/portfolios — the user's own portfolios (then /{id}/holdings, /{id}/transactions, /{id}/summary)
- /api/quantitative/summary|normality|capm|rolling|unitroot?symbol=AAPL&target=close&start_date=...&end_date=...

If a call fails with 404/422, adjust params or consult /api/providers. Prefer few, well-chosen calls over many.

## Choosing how to present data
- Quick answer / analysis → get_data, then answer in chat (markdown).
- The user wants a STANDARD catalog widget as-is → add_widget.
- The user wants to SEE combined/derived/custom data — merging multiple sources, computed metrics,
  cross-symbol comparisons, rebased series, anything no single standard widget shows —
  → fetch the pieces with get_data, compute the final rows YOURSELF, then call create_dataset_widget.
  NEVER satisfy such requests by just dropping a standard widget on the dashboard.

## create_dataset_widget — dashboard widget from YOUR computed data
- rows: flat objects with consistent keys (≤300 rows). Keys become table columns; use clear snake_case names.
- chart (optional): {type: line|area|bar|stackedBar|pie|donut, x_key, y_keys} — the widget opens as a chart
  (user can toggle to table). Omit chart for list-like results.
- Example: "AAPL이랑 MSFT 매출 비교해서 보여줘" → get_data income statements for both →
  rows=[{"period": "2024", "aapl_revenue": 391.0, "msft_revenue": 245.1}, ...] →
  create_dataset_widget(title="AAPL vs MSFT Revenue", rows=..., chart={"type": "bar", "x_key": "period", "y_keys": ["aapl_revenue", "msft_revenue"]}).

## add_widget — widget_type catalog
Static types: dividend, stock-splits, company-filings, earnings, insider, ownership-institutional, holder-breakdown, management, swot, economic-moat, investment-scorecard, stock-sentiment, financials, news-feed, research-reports, institutional-portfolios, market-ranking, watchlist, screener, alerts, sparkline, comparison, heatmap, correlation, economic-calendar, notes, gdp-forecast, inflation-momentum, initial-claims, jobs-breakdown, yield-curve-snapshot, yield-trends, real-rates, fed-balance-sheet, inflation-trends, labor-market-dashboard, pmi, fin-conditions-tab, sentiment-tab, quant-summary, quant-capm, quant-rolling, option-pricing.
Dynamic types: "data/{provider}/{model}" renders any Universal Data Gateway model as an auto table/chart widget (e.g. "data/fred/cpi", "data/yahoo/stock_price").
The widget is added to the dashboard pane the user is currently viewing. After adding, tell the user what was added.

## Style
- Lead with the answer/summary, then supporting detail.
- Use markdown tables for numeric comparisons. Keep it readable, not exhaustive.
- Never fabricate data; if a fetch fails, say so and suggest an alternative."""

# ── 도구 정의 — Anthropic 형식 ────────────────────────────────────────────────
ANTHROPIC_TOOLS = [
    {
        "name": "get_data",
        "description": (
            "Fetch data from MarketPulse's internal REST API (GET). "
            "Use the catalog in the system prompt. `path` must start with /api. "
            "Query params go in `params` (they are appended to the URL)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "API path, e.g. /api/data/yahoo/quote or /api/stock/dividends/AAPL",
                },
                "params": {
                    "type": "object",
                    "description": "Optional query parameters, e.g. {\"symbol\": \"AAPL\", \"period\": \"1y\"}",
                },
            },
            "required": ["path"],
        },
    },
    {
        "name": "add_widget",
        "description": (
            "Add a widget to the user's current dashboard pane. "
            "`widget_type` must be a static type or a dynamic 'data/{provider}/{model}' type "
            "from the catalog in the system prompt."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "widget_type": {"type": "string", "description": "Widget type id, e.g. 'dividend' or 'data/fred/cpi'"},
                "title": {"type": "string", "description": "Optional label shown to the user in the confirmation"},
                "w": {"type": "integer", "description": "Grid width 1-12 (default 6)"},
                "h": {"type": "integer", "description": "Grid height in rows (default 5)"},
            },
            "required": ["widget_type"],
        },
    },
    {
        "name": "create_dataset_widget",
        "description": (
            "Create a dashboard widget from data YOU computed — merged/derived from get_data results. "
            "Use this when the user wants to SEE combined or computed data that no standard widget covers. "
            "Rows must be flat objects with consistent keys (keys become table columns)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Widget header title, e.g. 'AAPL vs MSFT Revenue'"},
                "rows": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": "Result rows, e.g. [{\"period\": \"2024\", \"aapl_revenue\": 391.0, \"msft_revenue\": 245.1}]",
                },
                "chart": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string", "enum": sorted(_CHART_TYPES)},
                        "x_key": {"type": "string", "description": "x-axis column name"},
                        "y_keys": {"type": "array", "items": {"type": "string"}, "description": "y-series column names"},
                    },
                    "description": "Optional — when given, the widget opens as a chart (user can toggle to table)",
                },
                "w": {"type": "integer", "description": "Grid width 1-12 (default 6)"},
                "h": {"type": "integer", "description": "Grid height in rows (default 6)"},
            },
            "required": ["title", "rows"],
        },
    },
]

# ── 도구 정의 — Gemini functionDeclarations ──────────────────────────────────
# Gemini는 properties가 비어 있는 OBJECT 필드를 거부하므로 params는 JSON 문자열로 받는다.
GEMINI_TOOL_DECLS = [
    {
        "name": "get_data",
        "description": (
            "Fetch data from MarketPulse's internal REST API (GET). "
            "Use the catalog in the system instruction. `path` must start with /api. "
            "`params` is a JSON object string of query parameters."
        ),
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "path": {
                    "type": "STRING",
                    "description": "API path, e.g. /api/data/yahoo/quote or /api/stock/dividends/AAPL",
                },
                "params": {
                    "type": "STRING",
                    "description": "Optional query parameters as a JSON object string, e.g. \"{\\\"symbol\\\": \\\"AAPL\\\", \\\"period\\\": \\\"1y\\\"}\"",
                },
            },
            "required": ["path"],
        },
    },
    {
        "name": "add_widget",
        "description": (
            "Add a widget to the user's current dashboard pane. "
            "`widget_type` must be a static type or a dynamic 'data/{provider}/{model}' type "
            "from the catalog in the system instruction."
        ),
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "widget_type": {"type": "STRING", "description": "Widget type id, e.g. 'dividend' or 'data/fred/cpi'"},
                "title": {"type": "STRING", "description": "Optional label shown to the user"},
                "w": {"type": "INTEGER", "description": "Grid width 1-12 (default 6)"},
                "h": {"type": "INTEGER", "description": "Grid height in rows (default 5)"},
            },
            "required": ["widget_type"],
        },
    },
    {
        "name": "create_dataset_widget",
        "description": (
            "Create a dashboard widget from data YOU computed — merged/derived from get_data results. "
            "Use this when the user wants to SEE combined or computed data that no standard widget covers. "
            "`rows_json` is a JSON array string of flat row objects (keys become table columns)."
        ),
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "title": {"type": "STRING", "description": "Widget header title, e.g. 'AAPL vs MSFT Revenue'"},
                "rows_json": {
                    "type": "STRING",
                    "description": "JSON array string of row objects, e.g. \"[{\\\"period\\\": \\\"2024\\\", \\\"revenue\\\": 391.0}]\"",
                },
                "chart_type": {"type": "STRING", "description": "Optional: line|area|bar|stackedBar|pie|donut — opens the widget as a chart"},
                "x_key": {"type": "STRING", "description": "Optional: x-axis column name"},
                "y_keys": {"type": "STRING", "description": "Optional: comma-separated y-series column names"},
                "w": {"type": "INTEGER", "description": "Grid width 1-12 (default 6)"},
                "h": {"type": "INTEGER", "description": "Grid height in rows (default 6)"},
            },
            "required": ["title", "rows_json"],
        },
    },
]


class ChatMessage(BaseModel):
    role: str                 # 'user' | 'assistant'
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    context: Optional[dict] = None     # {symbol, path, section} — 현재 화면 상태
    provider: Optional[str] = None     # 'anthropic' | 'gemini' — 미지정 시 자동 선택


# ── 공통 유틸 ─────────────────────────────────────────────────────────────────

def _sse(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


def _shrink(obj: Any, max_items: int = MAX_LIST_ITEMS) -> Any:
    """리스트를 앞쪽 max_items개로 줄이고 생략 사실을 남긴다(중첩 포함)."""
    if isinstance(obj, list):
        if len(obj) > max_items:
            return [_shrink(x, max_items) for x in obj[:max_items]] + [
                f"... ({len(obj) - max_items} more items truncated)"
            ]
        return [_shrink(x, max_items) for x in obj]
    if isinstance(obj, dict):
        return {k: _shrink(v, max_items) for k, v in obj.items()}
    return obj


def _tool_result_text(payload: Any) -> str:
    text = json.dumps(payload, ensure_ascii=False, default=str)
    if len(text) > MAX_TOOL_RESULT_CHARS:
        text = json.dumps(_shrink(payload), ensure_ascii=False, default=str)
    if len(text) > MAX_TOOL_RESULT_CHARS:
        text = text[:MAX_TOOL_RESULT_CHARS] + "... (truncated)"
    return text


async def _exec_get_data(request: Request, auth_header: str, tool_input: dict) -> tuple[str, bool]:
    """내부 API를 in-process ASGI로 호출. 반환: (result_text, is_error)."""
    path = str(tool_input.get("path", "")).strip()
    params = tool_input.get("params") or {}
    if isinstance(params, str):
        # Gemini는 params를 JSON 문자열로 보낸다
        try:
            params = json.loads(params) if params.strip() else {}
        except ValueError:
            params = {}
    if not isinstance(params, dict):
        params = {}

    if not path.startswith("/api"):
        path = "/api" + (path if path.startswith("/") else "/" + path)
    if ".." in path or not any(path.startswith(p) for p in _ALLOWED_PREFIXES):
        return f"Error: path '{path}' is not allowed. Use catalog endpoints only.", True

    transport = httpx.ASGITransport(app=request.app)
    try:
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://marketpulse.internal",
            headers={"Authorization": auth_header},
            timeout=90.0,
        ) as client:
            resp = await client.get(path, params={k: v for k, v in params.items() if v is not None})
    except Exception as exc:
        return f"Error calling {path}: {exc}", True

    if resp.status_code >= 400:
        detail = resp.text[:500]
        return f"HTTP {resp.status_code} from {path}: {detail}", True

    try:
        payload = resp.json()
    except ValueError:
        return resp.text[:MAX_TOOL_RESULT_CHARS], False
    return _tool_result_text(payload), False


def _build_dataset_payload(tool_input: dict) -> tuple[Optional[dict], Optional[str]]:
    """create_dataset_widget 입력 검증/정규화. 반환: (payload, error).

    저장소는 없다 — 검증된 페이로드가 SSE `widget` 이벤트로 프론트에 전달되고
    프론트가 localStorage(copilot-ds:{id})에 보관한다.
    """
    title = str(tool_input.get("title") or "").strip() or "Copilot Dataset"

    rows = tool_input.get("rows")
    if rows is None and tool_input.get("rows_json"):
        # Gemini는 rows를 JSON 문자열로 보낸다
        try:
            rows = json.loads(tool_input["rows_json"])
        except ValueError as exc:
            return None, f"rows_json is not valid JSON: {exc}"
    if not isinstance(rows, list) or not rows:
        return None, "rows must be a non-empty array of objects."

    clean_rows = []
    for r in rows[:MAX_DATASET_ROWS]:
        if not isinstance(r, dict):
            continue
        clean_rows.append({
            str(k): (v if v is None or isinstance(v, (str, int, float, bool))
                     else json.dumps(v, ensure_ascii=False, default=str))
            for k, v in r.items()
        })
    if not clean_rows:
        return None, 'rows items must be objects, e.g. [{"period": "2024", "value": 1.2}].'

    # chart 힌트 — Anthropic은 chart 객체, Gemini는 chart_type/x_key/y_keys 평면 필드
    chart = tool_input.get("chart") if isinstance(tool_input.get("chart"), dict) else {}
    chart_type = str(chart.get("type") or tool_input.get("chart_type") or "").strip()
    x_key = str(chart.get("x_key") or tool_input.get("x_key") or "").strip()
    y_keys = chart.get("y_keys")
    if not isinstance(y_keys, list):
        y_keys = [s.strip() for s in str(tool_input.get("y_keys") or "").split(",") if s.strip()]
    chart_hint = None
    if chart_type in _CHART_TYPES:
        chart_hint = {"type": chart_type}
        if x_key:
            chart_hint["x_key"] = x_key
        if y_keys:
            chart_hint["y_keys"] = [str(k) for k in y_keys]

    payload = {"title": title, "rows": clean_rows, "chart_hint": chart_hint}
    if len(json.dumps(payload, ensure_ascii=False, default=str)) > MAX_DATASET_CHARS:
        return None, "Dataset too large — reduce rows/columns (keep the columns the user actually needs)."
    return payload, None


async def _run_tool(
    name: str, tool_input: dict, request: Request, auth_header: str
) -> tuple[str, bool, list[tuple[str, dict]]]:
    """도구 실행. 반환: (result_text, is_error, 추가 SSE 이벤트 [(event, data), ...])."""
    events: list[tuple[str, dict]] = []
    if name == "get_data":
        result_text, is_error = await _exec_get_data(request, auth_header, tool_input)
        events.append(("tool_result", {
            "name": name, "ok": not is_error, "path": tool_input.get("path"),
        }))
        return result_text, is_error, events

    if name == "add_widget":
        widget_type = str(tool_input.get("widget_type", "")).strip()
        if not widget_type:
            return "Error: widget_type is required.", True, events
        # 실제 추가는 프론트가 수행 — SSE 이벤트로 위임
        events.append(("widget", {
            "widget_type": widget_type,
            "title": tool_input.get("title") or widget_type,
            "w": tool_input.get("w") or 6,
            "h": tool_input.get("h") or 5,
        }))
        return f"Widget '{widget_type}' add request sent to the dashboard.", False, events

    if name == "create_dataset_widget":
        payload, err = _build_dataset_payload(tool_input)
        if err:
            return f"Error: {err}", True, events
        dataset_id = uuid.uuid4().hex[:12]
        events.append(("widget", {
            "widget_type": f"copilot/{dataset_id}",
            "title": payload["title"],
            "rows": payload["rows"],
            "chart_hint": payload["chart_hint"],
            "w": tool_input.get("w") or 6,
            "h": tool_input.get("h") or 6,
        }))
        return (
            f"Dataset widget '{payload['title']}' ({len(payload['rows'])} rows) "
            "sent to the dashboard.",
            False, events,
        )

    return f"Unknown tool: {name}", True, events


def _context_prefix(context: Optional[dict]) -> str:
    if not context:
        return ""
    parts = []
    if context.get("path"):
        parts.append(f"page={context['path']}")
    if context.get("symbol"):
        parts.append(f"symbol={context['symbol']}")
    if context.get("section"):
        parts.append(f"tab={context['section']}")
    if not parts:
        return ""
    return f"[current view: {', '.join(parts)}]\n\n"


# ── LLM 키 해석 — API 키 관리(사용자 DB) 우선, .env 폴백 ─────────────────────

def _resolve_llm(user_id: str, requested: Optional[str]) -> tuple[Optional[str], Optional[str], dict]:
    """반환: (provider, api_key, 사용가능 providers dict {name: True})."""
    available: dict[str, str] = {}
    for prov, env_key in (("anthropic", settings.ANTHROPIC_API_KEY),
                          ("gemini", settings.GEMINI_API_KEY)):
        creds = user_key_service.get_credentials(user_id, prov) or {}
        key = (creds.get("api_key") or "").strip() or (env_key or "").strip()
        if key:
            available[prov] = key

    if requested and requested in available:
        return requested, available[requested], available
    for prov in ("anthropic", "gemini"):   # 둘 다 있으면 anthropic 우선
        if prov in available:
            return prov, available[prov], available
    return None, None, available


# ── Anthropic (Claude) 스트리밍 tool 루프 ────────────────────────────────────

async def _stream_anthropic(
    api_key: str, messages: list[dict], request: Request, auth_header: str
) -> AsyncIterator[str]:
    import anthropic

    client = anthropic.AsyncAnthropic(api_key=api_key)
    system = [{
        "type": "text",
        "text": SYSTEM_PROMPT,
        "cache_control": {"type": "ephemeral"},
    }]

    try:
        for _iteration in range(MAX_TOOL_ITERATIONS):
            async with client.messages.stream(
                model=settings.COPILOT_MODEL,
                max_tokens=8192,
                system=system,
                thinking={"type": "adaptive"},
                tools=ANTHROPIC_TOOLS,
                messages=messages,
            ) as stream:
                async for event in stream:
                    if (
                        event.type == "content_block_delta"
                        and event.delta.type == "text_delta"
                    ):
                        yield _sse("text", {"delta": event.delta.text})
                    elif (
                        event.type == "content_block_start"
                        and event.content_block.type == "tool_use"
                    ):
                        yield _sse("tool_start", {"name": event.content_block.name})
                response = await stream.get_final_message()

            if response.stop_reason == "pause_turn":
                messages.append({"role": "assistant", "content": response.content})
                continue

            if response.stop_reason != "tool_use":
                yield _sse("done", {"stop_reason": response.stop_reason})
                return

            # ── tool 실행 ─────────────────────────────────────────────────
            messages.append({"role": "assistant", "content": response.content})
            tool_results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue
                yield _sse("tool", {"name": block.name, "input": block.input})
                result_text, is_error, extra = await _run_tool(
                    block.name, block.input or {}, request, auth_header
                )
                for ev, data in extra:
                    yield _sse(ev, data)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result_text,
                    "is_error": is_error,
                })
            messages.append({"role": "user", "content": tool_results})

        yield _sse("error", {"message": "도구 호출 횟수 제한에 도달했습니다. 질문을 좁혀서 다시 시도해 주세요."})

    except anthropic.AuthenticationError:
        yield _sse("error", {"message": "Anthropic API 키가 유효하지 않습니다. API 키 관리에서 확인하세요."})
    except anthropic.RateLimitError:
        yield _sse("error", {"message": "Anthropic API rate limit에 걸렸습니다. 잠시 후 다시 시도하세요."})
    except anthropic.APIStatusError as exc:
        log.exception("copilot: Anthropic API error")
        yield _sse("error", {"message": f"Anthropic API 오류 ({exc.status_code}): {exc.message}"})
    except anthropic.APIConnectionError:
        yield _sse("error", {"message": "Anthropic API에 연결할 수 없습니다. 네트워크를 확인하세요."})


# ── Gemini 스트리밍 tool 루프 (REST v1beta, 무료 티어 OK) ─────────────────────

def _gemini_error_message(status_code: int, body: str) -> str:
    try:
        detail = json.loads(body).get("error", {}).get("message", "")[:300]
    except ValueError:
        detail = body[:300]
    if status_code == 429:
        return "Gemini 무료 티어 한도(분당 요청 수)에 걸렸습니다. 잠시 후 다시 시도하세요."
    if status_code in (401, 403):
        return "Gemini API 키가 유효하지 않습니다. API 키 관리에서 확인하세요."
    return f"Gemini API 오류 ({status_code}): {detail}"


async def _stream_gemini(
    api_key: str, messages: list[dict], request: Request, auth_header: str
) -> AsyncIterator[str]:
    model = settings.COPILOT_GEMINI_MODEL
    url = f"{GEMINI_BASE}/models/{model}:streamGenerateContent"

    contents = [
        {
            "role": "user" if m["role"] == "user" else "model",
            "parts": [{"text": m["content"]}],
        }
        for m in messages
    ]

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as http:
            for _iteration in range(MAX_TOOL_ITERATIONS):
                body = {
                    "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
                    "contents": contents,
                    "tools": [{"functionDeclarations": GEMINI_TOOL_DECLS}],
                    "generationConfig": {"maxOutputTokens": 8192},
                }
                acc_text = ""
                fn_calls: list[dict] = []

                async with http.stream(
                    "POST", url,
                    params={"alt": "sse"},
                    headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
                    json=body,
                ) as resp:
                    if resp.status_code >= 400:
                        err_body = (await resp.aread()).decode("utf-8", "replace")
                        yield _sse("error", {"message": _gemini_error_message(resp.status_code, err_body)})
                        return

                    async for line in resp.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        raw = line[5:].strip()
                        if not raw:
                            continue
                        try:
                            chunk = json.loads(raw)
                        except ValueError:
                            continue
                        cand = (chunk.get("candidates") or [{}])[0]
                        for part in (cand.get("content") or {}).get("parts", []):
                            if part.get("thought"):
                                continue  # thinking 요약은 표시하지 않음
                            if "text" in part:
                                acc_text += part["text"]
                                yield _sse("text", {"delta": part["text"]})
                            elif "functionCall" in part:
                                fn_calls.append(part["functionCall"])
                                yield _sse("tool_start", {"name": part["functionCall"].get("name")})

                if not fn_calls:
                    yield _sse("done", {"stop_reason": "end_turn"})
                    return

                # ── tool 실행 → functionResponse로 이어붙여 루프 계속 ─────────
                model_parts = ([{"text": acc_text}] if acc_text else []) + [
                    {"functionCall": fc} for fc in fn_calls
                ]
                contents.append({"role": "model", "parts": model_parts})

                response_parts = []
                for fc in fn_calls:
                    name = fc.get("name", "")
                    args = fc.get("args") or {}
                    yield _sse("tool", {"name": name, "input": args})
                    result_text, is_error, extra = await _run_tool(
                        name, args, request, auth_header
                    )
                    for ev, data in extra:
                        yield _sse(ev, data)
                    response_parts.append({
                        "functionResponse": {
                            "name": name,
                            "response": (
                                {"error": result_text} if is_error else {"result": result_text}
                            ),
                        }
                    })
                contents.append({"role": "user", "parts": response_parts})

            yield _sse("error", {"message": "도구 호출 횟수 제한에 도달했습니다. 질문을 좁혀서 다시 시도해 주세요."})

    except httpx.HTTPError as exc:
        log.exception("copilot: Gemini connection error")
        yield _sse("error", {"message": f"Gemini API에 연결할 수 없습니다: {exc}"})


# ── 라우트 ────────────────────────────────────────────────────────────────────

@router.get("/copilot/status")
async def copilot_status(user: User = Depends(get_current_active_user)):
    provider, _key, available = _resolve_llm(str(user.user_id), None)
    return {
        "enabled": provider is not None,
        "provider": provider,
        "providers": sorted(available.keys()),
        "model": (
            settings.COPILOT_MODEL if provider == "anthropic"
            else settings.COPILOT_GEMINI_MODEL if provider == "gemini"
            else None
        ),
    }


@router.post("/copilot/chat")
async def copilot_chat(
    body: ChatRequest,
    request: Request,
    user: User = Depends(get_current_active_user),
):
    auth_header = request.headers.get("authorization", "")
    provider, api_key, _available = _resolve_llm(str(user.user_id), body.provider)

    async def event_stream():
        if provider is None:
            yield _sse("error", {
                "message": (
                    "LLM API 키가 없습니다. 설정 → API 키 관리에서 "
                    "Google Gemini(무료) 또는 Anthropic Claude 키를 등록하세요."
                ),
            })
            return

        # 대화 이력(텍스트만; tool 왕복은 턴 내부에서만 유지) + 현재 화면 컨텍스트 주입
        messages: list[dict] = []
        for i, m in enumerate(body.messages):
            content = m.content
            if i == len(body.messages) - 1 and m.role == "user":
                content = _context_prefix(body.context) + content
            messages.append({"role": m.role, "content": content})
        if not messages or messages[-1]["role"] != "user":
            yield _sse("error", {"message": "마지막 메시지는 user여야 합니다."})
            return

        yield _sse("meta", {"provider": provider})

        try:
            if provider == "anthropic":
                async for chunk in _stream_anthropic(api_key, messages, request, auth_header):
                    yield chunk
            else:
                async for chunk in _stream_gemini(api_key, messages, request, auth_header):
                    yield chunk
        except Exception as exc:  # 스트림 중 예외는 SSE로 전달 (500 응답 불가 시점)
            log.exception("copilot: unexpected error")
            yield _sse("error", {"message": f"예상치 못한 오류: {exc}"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # nginx 프록시 버퍼링 방지
        },
    )
