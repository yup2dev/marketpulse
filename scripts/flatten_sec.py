"""sec/openbb 서브패키지를 제거하고 sec/ 네이티브 구조로 통합.

- sec/openbb/models/* → sec/models/ (기존 sec/ 루트 fetcher와 충돌 없음)
- sec/openbb/utils/* → sec/utils/ (병합; 미사용 10줄 helpers.py 상수는 보존 위해 append)
- `data_fetcher.providers.sec.openbb.` → `data_fetcher.providers.sec.` 치환
- sec/openbb 삭제
"""
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DF = ROOT / "data_fetcher"
SEC = DF / "providers" / "sec"
SRC = SEC / "openbb"


def _clean_pycache(base: Path) -> None:
    for p in base.rglob("__pycache__"):
        shutil.rmtree(p, ignore_errors=True)


def main() -> None:
    _clean_pycache(SRC)
    _clean_pycache(SEC / "utils")

    # 기존(미사용) helpers 상수 보존용 백업 텍스트
    old_helpers = SEC / "utils" / "helpers.py"
    preserved = old_helpers.read_text(encoding="utf-8") if old_helpers.exists() else ""

    # models → sec/models/
    shutil.copytree(SRC / "models", SEC / "models", dirs_exist_ok=True)
    print("  copied models -> sec/models/")

    # utils → sec/utils/ (병합, ported helpers.py가 기존 덮어씀)
    shutil.copytree(SRC / "utils", SEC / "utils", dirs_exist_ok=True)
    print("  merged utils -> sec/utils/")

    # 기존 상수 보존 (미사용이지만 비파괴적으로 append)
    if preserved.strip():
        hp = SEC / "utils" / "helpers.py"
        hp.write_text(
            hp.read_text(encoding="utf-8")
            + "\n\n# ── 기존 sec/utils/helpers 상수 보존(레거시, 미사용) ──\n"
            + preserved,
            encoding="utf-8",
        )

    # py.typed 등 최상위 자산
    for extra in SRC.glob("*"):
        if extra.is_file() and extra.suffix != ".py":
            shutil.copy2(extra, SEC / extra.name)

    # import 치환
    targets = list((SEC / "models").rglob("*.py")) + list((SEC / "utils").rglob("*.py"))
    targets += [DF / "providers_init.py"]
    n = 0
    for f in targets:
        if "__pycache__" in str(f):
            continue
        t = f.read_text(encoding="utf-8")
        nt = t.replace(
            "data_fetcher.providers.sec.openbb.",
            "data_fetcher.providers.sec.",
        )
        if nt != t:
            f.write_text(nt, encoding="utf-8")
            n += 1
    print(f"  rewrote {n} files")

    # models 패키지 __init__ 보장
    init = SEC / "models" / "__init__.py"
    if not init.exists():
        init.write_text('"""SEC OpenBB 이식 모델."""\n', encoding="utf-8")

    shutil.rmtree(SRC, ignore_errors=True)
    print("  removed sec/openbb")


if __name__ == "__main__":
    main()
    print("[flatten_sec] done")
