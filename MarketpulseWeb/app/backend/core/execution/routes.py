"""(provider, model) 실행 위치 — fetcher 의 target 이 정한다. DB 표 data_model_routes 는 로컬 → 서버 긴급 전환만.

    target="local"   로그인 사용자의 PC Fetcher 로 위임 (서버에서 실행하지 않는다)
                     표에 행(local_yn='N')이 있으면 긴급 전환 — 서버에서 실행한다 (서버에는 모든 fetcher 코드가 있다)
    target="server"  서버 fetcher 로 직접 실행. 표로 로컬로 돌릴 수 없다 — PC Worker 는 local fetcher 만 실행한다

평소 표는 비어 있다. 실행 계층은 메모리의 전환 목록만 본다 (요청마다 DB 를 읽지 않는다). 기동할 때 cleanup_and_load 가
기본값과 같아 뜻이 없는 행을 지우고 전환 목록을 읽어 둔다. 관리자가 바꾸면 set_route 가 DB 와 메모리를 함께 고친다.
"""
import logging
import re
import threading
from datetime import datetime
from typing import Dict, Iterable, List, Optional, Set, Tuple

from sqlalchemy.orm import Session

log = logging.getLogger(__name__)

Pair = Tuple[str, str]

_LOCK = threading.Lock()
_overrides: Set[Pair] = set()   # 긴급 전환 중 — target="local" 이지만 서버에서 실행


class RouteError(ValueError):
    """허용되지 않는 실행 위치 변경 (예: target="server" fetcher 를 로컬로)."""


_target_cache: Dict[str, object] = {}


def _targets() -> Dict[Pair, str]:
    """등록된 (provider, model) → fetcher.target. 등록 수가 바뀔 때만 다시 만든다 (요청마다 부르므로)."""
    import data_fetcher.providers_init  # noqa: F401 — 등록 보장
    from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry

    providers = ProviderRegistry.get_all()
    size = sum(len(p.fetcher_dict) for p in providers.values())
    if _target_cache.get("size") != size:
        _target_cache["map"] = {(name, model): getattr(fetcher, "target", "server")
                                for name, prov in providers.items()
                                for model, fetcher in prov.fetcher_dict.items()}
        _target_cache["size"] = size
    return _target_cache["map"]  # type: ignore[return-value]


def registered_pairs() -> Iterable[Pair]:
    return _targets().keys()


def snake_case(name: str) -> str:
    s = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", name)
    return re.sub(r"([a-z\d])([A-Z])", r"\1_\2", s).lower()


def _key(provider: str, model: str, targets: Dict[Pair, str]) -> Pair:
    """모델 이름은 PascalCase 도 받는다 (fetcher_dict 키는 snake_case)."""
    if (provider, model) not in targets and (provider, snake_case(model)) in targets:
        return provider, snake_case(model)
    return provider, model


def target_of(provider: str, model: str) -> Optional[str]:
    """등록된 fetcher 의 target — 등록되지 않았으면 None."""
    targets = _targets()
    return targets.get(_key(provider, model, targets))


def is_local(provider: str, model: str) -> bool:
    """사용자 PC Fetcher 로 위임하는가 — target="local" 이고 긴급 전환 중이 아닐 때."""
    targets = _targets()
    key = _key(provider, model, targets)
    return targets.get(key) == "local" and key not in _overrides


def cleanup(db: Session) -> int:
    """뜻이 없는 행을 지운다 — 기본값과 같은 행(local 이 Y · server 가 N)과 등록되지 않은 쌍. 지운 수.

    target="server" 인데 Y 인 행은 지우지 않고 경고만 남긴다 (관리자가 남긴 값 — 무시된다).
    """
    from app.backend.models.orm import DataModelRoute

    targets = _targets()
    removed = 0
    for row in db.query(DataModelRoute).all():
        target = targets.get((row.provider, row.model))
        if target is None or (target == "local") == (row.local_yn == "Y"):
            db.delete(row)
            removed += 1
        elif target == "server":
            log.warning("[routes] %s/%s 는 target='server' 라 로컬 행(Y)을 무시합니다", row.provider, row.model)
    if removed:
        db.commit()
        log.info("[routes] 기본값과 같은 실행 위치 행 %d건 정리", removed)
    return removed


def load(db: Session) -> None:
    """DB 표 → 메모리 (긴급 전환 목록)."""
    from app.backend.models.orm import DataModelRoute

    targets = _targets()
    rows = {(r.provider, r.model) for r in db.query(DataModelRoute).filter(DataModelRoute.local_yn == "N")}
    with _LOCK:
        _overrides.clear()
        _overrides.update(k for k in rows if targets.get(k) == "local")


def cleanup_and_load() -> None:
    """기동할 때 한 번 — 실패하면 전환 없이 target 만으로 판단한다 (앱은 뜬다)."""
    from app.backend.core.db import get_db_sync

    db = get_db_sync()
    try:
        cleanup(db)
        load(db)
    except Exception as exc:  # noqa: BLE001
        log.warning("[routes] 실행 위치 표를 읽지 못했어요 — fetcher target 만으로 판단: %s", exc)
    finally:
        db.close()


def set_route(db: Session, provider: str, model: str, local: bool, user_id: Optional[str] = None) -> None:
    """관리자가 바꾼다 — DB 와 메모리를 함께.

    target="local":  local=False → 긴급 전환(행 local_yn='N'), local=True → 전환 해제(행 삭제)
    target="server": local=True 는 거부 (RouteError), local=False 는 할 일 없음
    등록되지 않은 쌍은 KeyError.
    """
    from app.backend.models.orm import DataModelRoute

    target = target_of(provider, model)
    if target is None:
        raise KeyError(f"{provider}/{model}")
    if target == "server":
        if local:
            raise RouteError(f"'{provider}/{model}' 는 서버 fetcher(target='server')라 로컬로 돌릴 수 없다 "
                             "— PC Fetcher 에서 실행하려면 fetcher 의 target 을 바꾸고 exe 를 다시 배포한다")
        return

    row = db.get(DataModelRoute, (provider, model))
    if local:
        if row is not None:
            db.delete(row)
    else:
        if row is None:
            row = DataModelRoute(provider=provider, model=model)
            db.add(row)
        row.local_yn = "N"
        row.updated_by = user_id
        row.updated_at = datetime.utcnow()
    db.commit()
    with _LOCK:
        (_overrides.discard if local else _overrides.add)((provider, model))


def view(db: Session, provider: Optional[str] = None) -> List[dict]:
    """관리 화면용 — 등록된 쌍마다 target · 긴급 전환 여부 · 실제 실행 위치."""
    from app.backend.models.orm import DataModelRoute

    rows = {(r.provider, r.model): r for r in db.query(DataModelRoute).filter(DataModelRoute.local_yn == "N")}
    out = []
    for (p, m), target in sorted(_targets().items()):
        if provider and p != provider:
            continue
        row = rows.get((p, m)) if target == "local" else None
        out.append({
            "provider": p, "model": m, "target": target,
            "emergency_server": row is not None,
            "local": target == "local" and row is None,
            "updated_at": row.updated_at.isoformat() if row is not None and row.updated_at else None,
            "updated_by": row.updated_by if row is not None else None,
        })
    return out


def snapshot() -> Set[Pair]:
    """긴급 전환 중인 (provider, model)."""
    return set(_overrides)
