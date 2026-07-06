"""Fetcher 레지스트리 스모크 테스트 (네트워크 불필요).

전체 ProviderRegistry를 순회하며 각 fetcher의 제네릭 해석이 정상인지 검증한다.
`query_params_type`이 bare BaseModel로 폴백하면 query_executor._filter_extra_params가
모든 사용자 파라미터를 제거해 런타임에 조용히 깨지므로, 폴백 = 즉시 실패로 취급한다.

사용법:
    python scripts/smoke_fetchers.py                       # 검증만
    python scripts/smoke_fetchers.py --snapshot FILE.json  # 스냅샷 저장
    python scripts/smoke_fetchers.py --diff FILE.json      # 베이스라인과 비교
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pydantic import BaseModel  # noqa: E402

import data_fetcher.providers_init  # noqa: F401, E402  (등록 트리거)
from data_fetcher.abstract_provider.abstract.fetcher import Fetcher  # noqa: E402
from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry  # noqa: E402


def collect_snapshot() -> dict:
    """provider → model_key → fetcher 메타데이터 스냅샷."""
    snapshot: dict = {}
    for pname, provider in sorted(ProviderRegistry.get_all().items()):
        entry: dict = {}
        for key, fetcher_cls in sorted(provider.fetcher_dict.items()):
            qp = fetcher_cls.query_params_type
            dt = fetcher_cls.data_type
            entry[key] = {
                "fetcher": fetcher_cls.__name__,
                "query_params": getattr(qp, "__name__", str(qp)),
                "query_fields": sorted(getattr(qp, "model_fields", {}).keys()),
                "data_type": getattr(dt, "__name__", str(dt)),
                "require_credentials": bool(fetcher_cls.require_credentials),
                # fetch_data가 실제 호출하는 구현의 qualname — 베이스 스왑에 불변,
                # 구현이 다른 함수로 바뀌면(덮어쓰기 사고) diff에 잡힌다
                "extract_impl": getattr(
                    fetcher_cls.extract_data, "__qualname__", str(fetcher_cls.extract_data)
                ),
            }
        snapshot[pname] = entry
    return snapshot


def validate(snapshot: dict) -> list[str]:
    """제네릭 해석 실패/extract 미배선을 잡는다."""
    errors: list[str] = []
    for pname, models in snapshot.items():
        for key, meta in models.items():
            label = f"{pname}/{key} ({meta['fetcher']})"
            if meta["query_params"] == "BaseModel":
                errors.append(f"{label}: query_params_type이 BaseModel로 폴백 — 파라미터 전멸 위험")
            # 빈 model_fields는 파라미터가 필요 없는 fetcher에서 정상 (예: rss_litigation)
            if meta["extract_impl"].startswith("Fetcher."):
                errors.append(f"{label}: extract_data가 Fetcher 기본(no-op)으로 남음")
    return errors


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--snapshot", metavar="FILE", help="스냅샷 JSON 저장 경로")
    ap.add_argument("--diff", metavar="FILE", help="베이스라인 JSON과 비교")
    args = ap.parse_args()

    snap = collect_snapshot()
    total = sum(len(m) for m in snap.values())
    print(f"providers={len(snap)} fetcher_entries={total}")

    errors = validate(snap)
    for e in errors:
        print(f"  FAIL {e}")

    if args.snapshot:
        Path(args.snapshot).write_text(
            json.dumps(snap, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"snapshot saved: {args.snapshot}")

    if args.diff:
        baseline = json.loads(Path(args.diff).read_text(encoding="utf-8"))
        diffs: list[str] = []
        for pname in sorted(set(baseline) | set(snap)):
            b, s = baseline.get(pname, {}), snap.get(pname, {})
            for key in sorted(set(b) | set(s)):
                if key not in b:
                    diffs.append(f"+ {pname}/{key}")
                elif key not in s:
                    diffs.append(f"- {pname}/{key}")
                elif b[key] != s[key]:
                    changed = [
                        f"{f}: {b[key][f]!r} -> {s[key][f]!r}"
                        for f in b[key]
                        if b[key].get(f) != s[key].get(f)
                    ]
                    diffs.append(f"~ {pname}/{key}: " + "; ".join(changed))
        if diffs:
            print(f"DIFF ({len(diffs)} entries):")
            for d in diffs:
                print(f"  {d}")
        else:
            print("diff: clean (baseline과 동일)")
        if diffs:
            return 1

    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
