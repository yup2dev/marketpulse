"""위젯이 쓰는 데이터 API — (provider, model) 출처 목록과 데이터 API 호출 허용 확인.

위젯 종류마다 정의 모양이 달라도 출처는 여기 한 곳에서 같은 모양((provider, model) 집합)으로 뽑는다.
호출 허용 확인 · 참조 검사는 위젯 종류를 몰라도 이 목록만 본다.

    사용자 정의 위젯   provider · model 칸
    코드 위젯          화면을 코드로 그리는 위젯(widgetEndpoints.js 의 component)이 부르는 데이터 — CODE_WIDGET_SOURCES
    기본 제공 위젯     endpoint 가 /data/{provider}/{model} 이면 그 쌍. provider 자리가 '{provider}' 면 헤더의
                      provider 선택이므로 그 모델을 주는 모든 provider. 그 밖의 endpoint(command · concepts · admin …)는
                      데이터 API(/api/data) 호출이 아니라 출처가 없다.

새 위젯 종류가 데이터 API 를 다른 모양으로 가리키게 되면 sources_of 에 그 해석을 더한다.

호출 허용(settings.WIDGET_API_GATE):
    off      확인하지 않는다
    log      허용 밖 호출을 로그로만 남긴다 (기본 — 어떤 화면이 등록 없이 부르는지 운영에서 모으는 단계)
    enforce  허용 밖 호출을 404 api_not_registered 로 막는다
허용 = 기본 제공 위젯(use_yn Y) + 코드 위젯 + 요청 사용자의 위젯(use_yn Y) 의 출처.
"""
import logging
import re
import threading
from typing import Dict, Iterable, Optional, Set, Tuple

log = logging.getLogger(__name__)

Pair = Tuple[str, str]

DATA_ENDPOINT = re.compile(r"^/data/([^/?]+)/([^/?]+)")
PROVIDER_SLOT = "{provider}"


# 코드 위젯이 부르는 데이터 API — 위젯 id → 출처. 정의 행이 없는 위젯이라 여기 적는다.
# 위젯 코드에 /data/<provider>/<model> 을 적으면 여기에도 적어야 한다 (tests/test_widget_gate.py 가 대조).
CODE_WIDGET_SOURCES: Dict[str, Set[Pair]] = {
    "chart-studio": {
        ("yahoo", "stock_price"),    # 봉 · 비교 종목
        ("fred", "series"),          # 거시 지표 겹쳐 그리기
        ("polygon", "earnings"),     # 실적 발표 표시
        ("yahoo", "dividends"),      # 배당락 표시
    },
}


def code_widget_pairs() -> Set[Pair]:
    return set().union(*CODE_WIDGET_SOURCES.values()) if CODE_WIDGET_SOURCES else set()


class ApiNotRegisteredError(LookupError):
    """요청 사용자의 위젯 어디에도 없는 데이터 API 호출 — 404 api_not_registered."""


def providers_of(model: str) -> Set[str]:
    """이 모델을 주는 등록 provider."""
    import data_fetcher.providers_init  # noqa: F401 — 등록 보장
    from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry

    return {name for name, prov in ProviderRegistry.get_all().items() if model in prov.fetcher_dict}


def endpoint_sources(endpoint: Optional[str]) -> Set[Pair]:
    """기본 제공 위젯 endpoint → 데이터 API 출처."""
    m = DATA_ENDPOINT.match((endpoint or "").strip())
    if not m:
        return set()
    provider, model = m.group(1), m.group(2)
    if provider == PROVIDER_SLOT:
        return {(p, model) for p in providers_of(model)}
    return {(provider, model)}


def sources_of(widget) -> Set[Pair]:
    """위젯 하나(UserWidget 행)의 데이터 API 출처."""
    if widget.provider and widget.model:
        return {(widget.provider, widget.model)}
    return endpoint_sources(widget.endpoint)


def _collect(widgets: Iterable) -> Set[Pair]:
    out: Set[Pair] = set()
    for w in widgets:
        out |= sources_of(w)
    return out


# ── 호출 허용 — 사용자별 허용 집합 캐시 ──────────────────────────────────────

_LOCK = threading.Lock()
_builtin: Dict[str, Set[Pair]] = {}          # "pairs" → 기본 제공 위젯 출처
_by_user: Dict[str, Set[Pair]] = {}           # user_id → 그 사용자 위젯 출처


def invalidate(user_id: Optional[str] = None) -> None:
    """위젯이 바뀌면 부른다. user_id 가 없으면 전부 (기본 제공 위젯이 바뀐 경우)."""
    with _LOCK:
        if user_id is None:
            _builtin.clear()
            _by_user.clear()
        else:
            _by_user.pop(user_id, None)


def allowed_pairs(db, user_id: Optional[str]) -> Set[Pair]:
    from app.backend.models.orm import UserWidget

    with _LOCK:
        builtin = _builtin.get("pairs")
        mine = _by_user.get(user_id) if user_id else set()
    if builtin is None:
        builtin = _collect(db.query(UserWidget).filter(UserWidget.user_id.is_(None), UserWidget.use_yn == "Y"))
        with _LOCK:
            _builtin["pairs"] = builtin
    if mine is None:
        mine = _collect(db.query(UserWidget).filter(UserWidget.user_id == user_id, UserWidget.use_yn == "Y"))
        with _LOCK:
            _by_user[user_id] = mine
    return builtin | code_widget_pairs() | mine


def _default_db():
    from app.backend.core.db import get_db_sync

    return get_db_sync()


def check_data_call(provider: str, model: str, user_id: Optional[str], mode: str, db_factory=None) -> None:
    """데이터 API 호출 허용 확인. mode 가 enforce 면 허용 밖 호출에 ApiNotRegisteredError."""
    if mode not in ("log", "enforce"):
        return
    from app.backend.core.execution.routes import snake_case

    db = (db_factory or _default_db)()
    try:
        allowed = allowed_pairs(db, user_id)
    finally:
        db.close()
    if (provider, model) in allowed or (provider, snake_case(model)) in allowed:
        return
    if mode == "log":
        log.warning("[widget-gate] 위젯에 없는 데이터 API 호출 user=%s %s/%s (enforce 면 404)", user_id, provider, model)
        return
    raise ApiNotRegisteredError(f"'{provider}/{model}' 는 내 위젯이나 기본 위젯에 등록된 데이터가 아닙니다")
