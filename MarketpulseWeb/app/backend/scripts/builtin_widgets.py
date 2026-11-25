"""기본 제공 위젯 — 기본값 파일(app/backend/builtin_widgets) ↔ DB 를 손으로 다룰 때.

    python -m app.backend.scripts.builtin_widgets check            파일과 다른 행 (서버가 맞춰 줄 것 · 손댄 것)
    python -m app.backend.scripts.builtin_widgets export [id …]    DB 행 → 파일 (DB 에서 고친 값을 기본값으로)
    python -m app.backend.scripts.builtin_widgets reset  [id …]    파일 → DB (손댄 행도 파일대로 되돌린다)

id 를 비우면 파일이 있는 위젯 전부. 평소에는 쓸 일이 없다 — 서버가 위젯 목록을 읽을 때 알아서 맞춘다.
(PYTHONPATH 에 MarketpulseWeb · MarketpulseFetcher 가 있어야 한다)
"""
import argparse
import sys

from app.backend.core.db import get_db_sync, init_db
from app.backend.models.orm import UserWidget, UserWidgetSeed
from app.backend.services import builtin_widgets as bw
from app.backend.services.user_widget_service import _sync_builtin


def _ids(db, given):
    if given:
        return list(given)
    return [s["widget_id"] for s in bw.load_specs()]


def check(db, ids) -> int:
    specs = {s["widget_id"]: s for s in bw.load_specs()}
    want = bw.spec_hashes()
    seeds = {r.widget_id: r.seed_hash for r in db.query(UserWidgetSeed).all()}
    n = 0
    for wid in ids:
        row = db.get(UserWidget, wid)
        if wid not in specs:
            print(f"{wid:28} 파일 없음")
            n += 1
            continue
        if row is None:
            print(f"{wid:28} DB 에 없음 → 서버가 넣는다")
            n += 1
            continue
        now = bw.spec_hash(bw.row_to_spec(row))
        if now == want[wid]:
            continue
        n += 1
        if wid in seeds and seeds[wid] != now:
            print(f"{wid:28} DB 에서 직접 고침 → 그대로 둔다 (export 로 파일에 담거나 reset 으로 되돌리기)")
        else:
            print(f"{wid:28} 파일이 바뀜 → 서버가 맞춘다")
    print(f"{n}개 다름" if n else "모두 파일과 같아요")
    return n


def export(db, ids) -> None:
    rows = [db.get(UserWidget, wid) for wid in ids]
    missing = [wid for wid, r in zip(ids, rows) if r is None or r.user_id is not None]
    if missing:
        sys.exit(f"기본 제공 위젯 행이 없어요: {', '.join(missing)}")
    specs = [bw.row_to_spec(r) for r in rows]
    for path in bw.write_specs(specs):
        print("wrote", path)
    # 지금 행 = 새 파일 → 지문도 맞춘다 (다음 조회에서 '손댄 행'으로 보지 않게)
    for s in specs:
        seed = db.get(UserWidgetSeed, s["widget_id"])
        h = bw.spec_hash(s)
        if seed:
            seed.seed_hash = h
        else:
            db.add(UserWidgetSeed(widget_id=s["widget_id"], seed_hash=h))
    db.commit()


def reset(db, ids) -> None:
    changed = _sync_builtin(db, force=set(ids))
    print("파일대로 되돌림:", ", ".join(changed) if changed else "(바뀐 것 없음)")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["check", "export", "reset"])
    ap.add_argument("ids", nargs="*")
    args = ap.parse_args()
    init_db()
    db = get_db_sync()
    try:
        ids = _ids(db, args.ids)
        {"check": check, "export": export, "reset": reset}[args.command](db, ids)
    finally:
        db.close()


if __name__ == "__main__":
    main()
