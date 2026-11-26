"""데이터 카탈로그 — Fetcher 등록 정보 → DB 표 (models/orm/data_catalog.py), 깨진 위젯 점검.

    sync_catalog(db)         등록된 provider · model 의 파라미터 · 필드를 표에 맞춘다. 지우지 않고 use_yn='N'.
                             (provider, model) 마다 지문(schema_hash)을 두고 바뀐 쌍만 다시 적는다.
    find_broken_widgets(db)  provider/model 로 만든 위젯 중 빠진 API · 필드 · 파라미터를 쓰는 것.
                             endpoint 로 부르는 기본 제공 위젯은 카탈로그 밖이라 보지 않는다.
    list_catalog(db) · get_entry(db, provider, model)   위젯 만들기 화면이 읽는 목록 · 상세

동적 선택지(resolve_param_choices — DB · 네트워크를 탈 수 있다)는 부르지 않고 dynamic_yn='Y' 로만 적는다.
화면은 그런 파라미터의 선택지를 /api/data/{provider}/{model}/schema 에서 받는다.
"""
import hashlib
import json
import logging
import threading
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.backend.models.orm import (
    DataModel, DataModelField, DataModelParam, DataModelProvider, DataSource, UserWidget,
)
from data_fetcher.core.model_schema import has_dynamic_choices, model_schema

log = logging.getLogger(__name__)

_LOCK = threading.Lock()   # 기동 시 동기화와 관리자 요청이 겹치지 않게


def _yn(v: bool) -> str:
    return "Y" if v else "N"


def _hash(entry: dict) -> str:
    text = json.dumps(entry, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# ── 등록 정보 읽기 ────────────────────────────────────────────────────────────

def read_registry() -> Tuple[Dict[str, dict], Dict[Tuple[str, str], dict]]:
    """(출처, (provider, model) → {params, fields}). 읽지 못한 모델은 건너뛴다 (로그만)."""
    import data_fetcher.providers_init  # noqa: F401 — 등록 보장 (이미 됐으면 no-op)
    from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry
    from data_fetcher.provider_catalog import provider_info

    sources: Dict[str, dict] = {}
    pairs: Dict[Tuple[str, str], dict] = {}
    for name, prov in sorted(ProviderRegistry.get_all().items()):
        info = provider_info(name)
        try:
            key = bool(prov.requires_credentials())
        except Exception:  # noqa: BLE001
            key = False
        sources[name] = {"name": info.get("label") or name, "description": info.get("desc") or None, "key": key}
        for model, fetcher_cls in sorted(prov.fetcher_dict.items()):
            try:
                schema = model_schema(fetcher_cls, dynamic=False)
            except Exception as exc:  # noqa: BLE001
                log.warning("[catalog] %s/%s 의 스키마를 읽지 못했어요: %s", name, model, exc)
                continue
            dynamic = has_dynamic_choices(fetcher_cls)
            pairs[(name, model)] = {
                "params": [
                    {
                        "name": p["name"], "kind": p["kind"], "required": bool(p.get("required")),
                        "default": None if p.get("default") is None else str(p["default"]),
                        "choices": p.get("options"), "dynamic": dynamic and p["kind"] != "date",
                        "hint": p.get("hint"),
                    }
                    for p in schema["params"]
                ],
                "fields": [
                    {"name": f["name"], "kind": f["kind"], "description": f.get("description")}
                    for f in schema["fields"]
                ],
            }
    return sources, pairs


# ── 동기화 ────────────────────────────────────────────────────────────────────

def sync_catalog(db: Session, registry: Optional[tuple] = None) -> dict:
    """등록 정보와 표를 맞춘다. 돌려주는 값: 새로 생긴 · 바뀐 · 빠진 (provider/model) 목록."""
    sources, pairs = registry or read_registry()
    with _LOCK:
        try:
            summary = _apply(db, sources, pairs)
            db.commit()
        except Exception:
            db.rollback()
            raise
    if any(summary[k] for k in ("added", "changed", "removed")):
        log.info("[catalog] 동기화 — 새로 %d · 바뀜 %d · 빠짐 %d",
                 len(summary["added"]), len(summary["changed"]), len(summary["removed"]))
    return summary


def _apply(db: Session, sources: Dict[str, dict], pairs: Dict[Tuple[str, str], dict]) -> dict:
    now = datetime.utcnow()

    # 출처
    have_src = {r.provider: r for r in db.query(DataSource).all()}
    for name, s in sources.items():
        row = have_src.get(name) or DataSource(provider=name)
        row.name, row.description, row.key_yn = s["name"], s["description"], _yn(s["key"])
        row.use_yn, row.synced_at = "Y", now
        if name not in have_src:
            db.add(row)
    for name, row in have_src.items():
        if name not in sources and row.use_yn != "N":
            row.use_yn, row.synced_at = "N", now

    # 모델 (이름만)
    models = {m for _, m in pairs}
    have_model = {r.model: r for r in db.query(DataModel).all()}
    for m in models:
        row = have_model.get(m)
        if row is None:
            db.add(DataModel(model=m, use_yn="Y", synced_at=now))
        elif row.use_yn != "Y":
            row.use_yn, row.synced_at = "Y", now
    for m, row in have_model.items():
        if m not in models and row.use_yn != "N":
            row.use_yn, row.synced_at = "N", now
    db.flush()   # 쌍이 가리킬 출처 · 모델 행을 먼저

    # (provider, model) 과 그 파라미터 · 필드
    have_pair = {(r.provider, r.model): r for r in db.query(DataModelProvider).all()}
    added, changed, removed = [], [], []
    for key, entry in pairs.items():
        h = _hash(entry)
        row = have_pair.get(key)
        if row is not None and row.schema_hash == h and row.use_yn == "Y":
            continue
        if row is None:
            db.add(DataModelProvider(provider=key[0], model=key[1], schema_hash=h, use_yn="Y", synced_at=now))
            added.append("/".join(key))
        else:
            row.schema_hash, row.use_yn, row.synced_at = h, "Y", now
            changed.append("/".join(key))
        db.flush()
        _write_children(db, key, entry)
    for key, row in have_pair.items():
        if key not in pairs and row.use_yn != "N":
            row.use_yn, row.synced_at = "N", now
            removed.append("/".join(key))
    return {"added": added, "changed": changed, "removed": removed,
            "sources": len(sources), "pairs": len(pairs)}


def _write_children(db: Session, key: Tuple[str, str], entry: dict) -> None:
    """이름으로 맞춘다 — 있는 건 고치고, 빠진 건 use_yn='N' (지우지 않는다)."""
    provider, model = key

    have = {r.param_name: r for r in db.query(DataModelParam).filter_by(provider=provider, model=model)}
    seen = set()
    for i, p in enumerate(entry["params"]):
        row = have.get(p["name"]) or DataModelParam(provider=provider, model=model, param_name=p["name"])
        row.param_seq, row.kind, row.required_yn = i, p["kind"], _yn(p["required"])
        row.default_value = p["default"]
        row.choices = json.dumps(p["choices"], ensure_ascii=False, default=str) if p["choices"] else None
        row.dynamic_yn, row.hint, row.use_yn = _yn(p["dynamic"]), p["hint"], "Y"
        if p["name"] not in have:
            db.add(row)
        seen.add(p["name"])
    for name, row in have.items():
        if name not in seen:
            row.use_yn = "N"

    have = {r.field_name: r for r in db.query(DataModelField).filter_by(provider=provider, model=model)}
    seen = set()
    for i, f in enumerate(entry["fields"]):
        row = have.get(f["name"]) or DataModelField(provider=provider, model=model, field_name=f["name"])
        row.field_seq, row.kind, row.description, row.use_yn = i, f["kind"], f["description"], "Y"
        if f["name"] not in have:
            db.add(row)
        seen.add(f["name"])
    for name, row in have.items():
        if name not in seen:
            row.use_yn = "N"


def sync_on_startup() -> None:
    """기동할 때 한 번 — 실패해도 앱은 뜬다 (위젯 만들기 목록이 예전 그대로일 뿐)."""
    from app.backend.core.db import get_db_sync

    db = get_db_sync()
    try:
        sync_catalog(db)
    except Exception as exc:  # noqa: BLE001
        log.warning("[catalog] 기동 시 동기화 실패 — 예전 목록을 그대로 써요: %s", exc)
    finally:
        db.close()


# ── 읽기 (위젯 만들기 화면) ───────────────────────────────────────────────────

def list_catalog(db: Session) -> List[dict]:
    """쓸 수 있는 (provider, model) 목록 — 모델 · 출처 순."""
    src = {s.provider: s for s in db.query(DataSource).filter(DataSource.use_yn == "Y")}
    counts: Dict[Tuple[str, str], List[int]] = {}
    for r in db.query(DataModelParam.provider, DataModelParam.model).filter(DataModelParam.use_yn == "Y"):
        counts.setdefault((r.provider, r.model), [0, 0])[0] += 1
    for r in db.query(DataModelField.provider, DataModelField.model).filter(DataModelField.use_yn == "Y"):
        counts.setdefault((r.provider, r.model), [0, 0])[1] += 1
    rows = (
        db.query(DataModelProvider)
        .filter(DataModelProvider.use_yn == "Y")
        .order_by(DataModelProvider.model.asc(), DataModelProvider.provider.asc())
        .all()
    )
    return [
        {
            "provider": r.provider, "model": r.model,
            "provider_name": src[r.provider].name, "key_yn": src[r.provider].key_yn,
            "param_count": counts.get((r.provider, r.model), [0, 0])[0],
            "field_count": counts.get((r.provider, r.model), [0, 0])[1],
        }
        for r in rows if r.provider in src
    ]


def get_entry(db: Session, provider: str, model: str) -> Optional[dict]:
    pair = db.get(DataModelProvider, (provider, model))
    if pair is None or pair.use_yn != "Y":
        return None
    params = (
        db.query(DataModelParam)
        .filter_by(provider=provider, model=model, use_yn="Y")
        .order_by(DataModelParam.param_seq.asc())
        .all()
    )
    fields = (
        db.query(DataModelField)
        .filter_by(provider=provider, model=model, use_yn="Y")
        .order_by(DataModelField.field_seq.asc())
        .all()
    )
    return {
        "provider": provider, "model": model, "synced_at": pair.synced_at.isoformat() if pair.synced_at else None,
        "params": [
            {
                "param_name": p.param_name, "kind": p.kind, "required_yn": p.required_yn,
                "default_value": p.default_value, "choices": json.loads(p.choices) if p.choices else None,
                "dynamic_yn": p.dynamic_yn, "hint": p.hint,
            }
            for p in params
        ],
        "fields": [{"field_name": f.field_name, "kind": f.kind, "description": f.description} for f in fields],
    }


# ── 깨진 위젯 점검 ────────────────────────────────────────────────────────────

def find_broken_widgets(db: Session) -> dict:
    """provider/model 로 만든 위젯 중 카탈로그와 어긋나는 것.

    level error — API 가 빠졌거나(use_yn N · 없음), 쓰던 필드 · 파라미터가 빠졌다 (예전엔 있었다).
    level warn  — 카탈로그에 한 번도 없던 필드. Data 모델이 extra 를 허용하면 응답에는 올 수 있다.
    """
    if db.query(DataModelProvider.provider).first() is None:
        return {"synced": False, "widgets": []}

    pairs = {(r.provider, r.model): r.use_yn for r in db.query(DataModelProvider.provider,
                                                                DataModelProvider.model,
                                                                DataModelProvider.use_yn)}
    fields: Dict[Tuple[str, str], Dict[str, str]] = {}
    for r in db.query(DataModelField.provider, DataModelField.model, DataModelField.field_name, DataModelField.use_yn):
        fields.setdefault((r.provider, r.model), {})[r.field_name] = r.use_yn
    params: Dict[Tuple[str, str], Dict[str, str]] = {}
    for r in db.query(DataModelParam.provider, DataModelParam.model, DataModelParam.param_name, DataModelParam.use_yn):
        params.setdefault((r.provider, r.model), {})[r.param_name] = r.use_yn

    out = []
    widgets = (
        db.query(UserWidget)
        .filter(UserWidget.provider.isnot(None), UserWidget.model.isnot(None))
        .order_by(UserWidget.widget_id.asc())
        .all()
    )
    for w in widgets:
        key = (w.provider, w.model)
        problems = []
        state = pairs.get(key)
        if state != "Y":
            problems.append({"kind": "api", "name": f"{w.provider}/{w.model}", "level": "error",
                             "reason": "카탈로그에 없는 API" if state is None else "등록에서 빠진 API"})
        else:
            known_f, known_p = fields.get(key, {}), params.get(key, {})
            for f in w.fields:
                s = known_f.get(f.field_name)
                if s == "N":
                    problems.append({"kind": "field", "name": f.field_name, "level": "error",
                                     "reason": "응답에서 빠진 필드"})
                elif s is None:
                    problems.append({"kind": "field", "name": f.field_name, "level": "warn",
                                     "reason": "카탈로그에 없는 필드 (응답의 추가 필드일 수 있음)"})
            for p in w.params:
                if known_p.get(p.param_name) == "N":
                    problems.append({"kind": "param", "name": p.param_name, "level": "error",
                                     "reason": "QueryParams 에서 빠진 파라미터"})
        if problems:
            out.append({"widget_id": w.widget_id, "user_id": w.user_id, "name": w.name,
                        "provider": w.provider, "model": w.model, "problems": problems})

    # 기본 제공 위젯 — endpoint 가 데이터 API(/data/{provider}/{model})를 가리키면 그 API 가 아직 있는지.
    # (응답 필드는 transform 이 다듬은 뒤의 이름이라 카탈로그와 대조하지 않는다. 출처 해석: widget_sources)
    from app.backend.services.widget_sources import DATA_ENDPOINT, PROVIDER_SLOT, endpoint_sources

    builtins = (db.query(UserWidget).filter(UserWidget.user_id.is_(None), UserWidget.endpoint.isnot(None))
                .order_by(UserWidget.widget_id.asc()).all())
    for w in builtins:
        m = DATA_ENDPOINT.match(w.endpoint.strip())
        if not m:
            continue
        provider, model = m.group(1), m.group(2)
        wanted = endpoint_sources(w.endpoint) if provider == PROVIDER_SLOT else {(provider, model)}
        live = [pair for pair in wanted if pairs.get(pair) == "Y"]
        if not live:
            out.append({"widget_id": w.widget_id, "user_id": None, "name": w.name,
                        "provider": provider, "model": model,
                        "problems": [{"kind": "api", "name": f"{provider}/{model}", "level": "error",
                                      "reason": "기본 위젯 endpoint 의 데이터 API 가 카탈로그에 없음"}]})
    return {"synced": True, "widgets": out}
