"""(provider, model) 실행 위치 — DB 표 data_model_routes (models/orm/data_catalog.DataModelRoute).

    Y  로컬 전용 — 로그인 사용자의 PC Fetcher 로 위임 (서버에서 실행하지 않는다)
    N  서버 fetcher 로 직접 실행

실행 계층은 메모리의 표만 본다 (요청마다 DB 를 읽지 않는다). 기동할 때 sync_routes 가 등록된 쌍의 행을 맞추고
load 가 읽어 둔다. 관리자가 바꾸면 set_route 가 DB 와 메모리를 함께 고친다.

새 쌍의 처음 값: INITIAL_LOCAL_MODELS 에 있으면 Y, 아니면 같은 provider 의 다른 행이 모두 Y 면 Y
(예: yahoo 에 새 모델이 생겨도 서버에서 긁지 않게), provider 의 첫 행이면 INITIAL_LOCAL_PROVIDERS.
그 뒤로는 표가 주인이다 — INITIAL_* 을 고쳐도 있는 행은 바뀌지 않는다.
"""
import logging
import re
import threading
from datetime import datetime
from typing import Dict, Iterable, Optional, Set, Tuple

from sqlalchemy.orm import Session

log = logging.getLogger(__name__)

Pair = Tuple[str, str]

# 처음 한 번만 쓰는 값 — 예전 QueryExecutor 에 고정돼 있던 규칙 그대로
#   yahoo: 비공식 스크래핑(yfinance) — 서버 고정 IP 는 막힌다
#   sec 13F 원본 파싱: 메모리를 크게 써 작은 운영 서버를 죽인다 (조회는 배치가 적재한 db provider 로)
INITIAL_LOCAL_PROVIDERS: Set[str] = {"yahoo"}
INITIAL_LOCAL_MODELS: Set[Pair] = {
    ("sec", "institutional_13f"), ("sec", "institutions_list"), ("sec", "13f_institutions"),
}

_LOCK = threading.Lock()
_routes: Dict[Pair, bool] = {}           # (provider, model) → 로컬 전용
_provider_default: Dict[str, bool] = {}  # 표에 없는 쌍 — 같은 provider 의 다른 행이 모두 Y 면 Y


def _initial(provider: str, model: str, existing: Dict[Pair, str]) -> str:
    if (provider, model) in INITIAL_LOCAL_MODELS:
        return "Y"
    siblings = [yn for (p, m), yn in existing.items() if p == provider and (p, m) not in INITIAL_LOCAL_MODELS]
    if siblings:
        return "Y" if all(yn == "Y" for yn in siblings) else "N"
    return "Y" if provider in INITIAL_LOCAL_PROVIDERS else "N"


def registered_pairs() -> Iterable[Pair]:
    import data_fetcher.providers_init  # noqa: F401 — 등록 보장
    from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry

    for name, prov in ProviderRegistry.get_all().items():
        for model in prov.fetcher_dict:
            yield name, model


def sync_routes(db: Session, pairs: Optional[Iterable[Pair]] = None) -> int:
    """등록된 (provider, model) 중 표에 없는 쌍을 넣는다. 있는 행은 건드리지 않는다. 넣은 수."""
    from app.backend.models.orm import DataModelRoute

    existing = {(r.provider, r.model): r.local_yn for r in db.query(DataModelRoute).all()}
    added = 0
    for provider, model in sorted(set(pairs if pairs is not None else registered_pairs())):
        if (provider, model) in existing:
            continue
        yn = _initial(provider, model, existing)
        db.add(DataModelRoute(provider=provider, model=model, local_yn=yn))
        existing[(provider, model)] = yn
        added += 1
    if added:
        db.commit()
        log.info("[routes] 새 실행 위치 %d건", added)
    return added


def load(db: Session) -> None:
    """DB 표 → 메모리."""
    from app.backend.models.orm import DataModelRoute

    rows = {(r.provider, r.model): r.local_yn == "Y" for r in db.query(DataModelRoute).all()}
    by_provider: Dict[str, Set[bool]] = {}
    for (p, _m), local in rows.items():
        by_provider.setdefault(p, set()).add(local)
    with _LOCK:
        _routes.clear()
        _routes.update(rows)
        _provider_default.clear()
        _provider_default.update({p: vals == {True} for p, vals in by_provider.items()})


def sync_and_load() -> None:
    """기동할 때 한 번 — 실패하면 처음 값 규칙으로만 판단한다 (앱은 뜬다)."""
    from app.backend.core.db import get_db_sync

    db = get_db_sync()
    try:
        sync_routes(db)
        load(db)
    except Exception as exc:  # noqa: BLE001
        log.warning("[routes] 실행 위치 표를 읽지 못했어요 — 처음 값 규칙으로 판단: %s", exc)
    finally:
        db.close()


def _snake(name: str) -> str:
    s = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", name)
    return re.sub(r"([a-z\d])([A-Z])", r"\1_\2", s).lower()


def is_local(provider: str, model: str) -> bool:
    """로컬 전용(Y)인가. 표에 없으면 같은 provider 의 값, 그것도 없으면 처음 값 규칙.
    모델 이름은 PascalCase 도 받는다 (fetcher_dict 키는 snake_case)."""
    key = (provider, model)
    if key not in _routes and (provider, _snake(model)) in _routes:
        key = (provider, _snake(model))
    if key in _routes:
        return _routes[key]
    if provider in _provider_default:
        return _provider_default[provider]
    return provider in INITIAL_LOCAL_PROVIDERS or key in INITIAL_LOCAL_MODELS


def set_route(db: Session, provider: str, model: str, local: bool, user_id: Optional[str] = None) -> None:
    """관리자가 바꾼다 — DB 와 메모리를 함께."""
    from app.backend.models.orm import DataModelRoute

    row = db.get(DataModelRoute, (provider, model))
    if row is None:
        row = DataModelRoute(provider=provider, model=model)
        db.add(row)
    row.local_yn = "Y" if local else "N"
    row.updated_by = user_id
    row.updated_at = datetime.utcnow()
    db.commit()
    with _LOCK:
        _routes[(provider, model)] = local


def snapshot() -> Dict[Pair, bool]:
    return dict(_routes)
