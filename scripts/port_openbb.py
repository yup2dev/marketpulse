"""OpenBB provider 파일을 이 프로젝트로 이식하는 헬퍼.

OpenBB 소스 파일을 복사하면서 import 경로만 기계적으로 치환한다:
  openbb_core      -> data_fetcher._obb
  openbb_us_eia    -> data_fetcher.providers.eia
  openbb_imf       -> data_fetcher.providers.imf
  openbb_oecd      -> data_fetcher.providers.oecd
  openbb_bls       -> data_fetcher.providers.bls
  openbb_wsj       -> data_fetcher.providers.wsj
  openbb_sec       -> data_fetcher.providers.sec

사용:
  python scripts/port_openbb.py <provider>   # eia|imf|oecd|bls|wsj|sec
  python scripts/port_openbb.py standard <model1> <model2> ...
"""
import re
import sys
from pathlib import Path

OPENBB = Path(r"C:\Users\pro\PycharmProjects\OpenBB\openbb_platform")
DST_ROOT = Path(__file__).resolve().parents[1] / "data_fetcher"

PKG_MAP = {
    "openbb_us_eia": "data_fetcher.providers.eia",
    "openbb_imf": "data_fetcher.providers.imf",
    "openbb_oecd": "data_fetcher.providers.oecd",
    "openbb_bls": "data_fetcher.providers.bls",
    "openbb_wsj": "data_fetcher.providers.wsj",
    "openbb_sec": "data_fetcher.providers.sec.openbb",
    "openbb_core": "data_fetcher._obb",
}

# provider 키 -> (openbb 소스 패키지 디렉토리, 프로젝트 대상 디렉토리)
PROVIDERS = {
    "eia": (OPENBB / "providers/eia/openbb_us_eia", DST_ROOT / "providers/eia"),
    "imf": (OPENBB / "providers/imf/openbb_imf", DST_ROOT / "providers/imf"),
    "oecd": (OPENBB / "providers/oecd/openbb_oecd", DST_ROOT / "providers/oecd"),
    "bls": (OPENBB / "providers/bls/openbb_bls", DST_ROOT / "providers/bls"),
    "wsj": (OPENBB / "providers/wsj/openbb_wsj", DST_ROOT / "providers/wsj"),
    "sec": (OPENBB / "providers/sec/openbb_sec", DST_ROOT / "providers/sec/openbb"),
}

# 이식하지 않는 하위경로 (OpenBB CLI 라우팅/뷰 — fetcher와 무관)
SKIP_PARTS = {"router", "views", "tests"}
SKIP_FILES = {"imf_router.py"}


def rewrite(text: str) -> str:
    for src, dst in PKG_MAP.items():
        text = re.sub(rf"\b{re.escape(src)}\b", dst, text)
    return text


def port_file(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    text = src.read_text(encoding="utf-8")
    dst.write_text(rewrite(text), encoding="utf-8")
    print(f"  {src.name} -> {dst.relative_to(DST_ROOT.parent)}")


def port_provider(key: str) -> None:
    src_root, dst_root = PROVIDERS[key]
    print(f"[{key}] {src_root} -> {dst_root}")
    for src in src_root.rglob("*.py"):
        rel = src.relative_to(src_root)
        if any(p in SKIP_PARTS for p in rel.parts) or src.name in SKIP_FILES:
            continue
        # 최상위 __init__.py 는 OpenBB Provider 정의를 담고 있으므로 이식하지 않는다.
        # (Provider 등록은 providers_init.py 에서 직접 수행)
        if rel == Path("__init__.py"):
            continue
        # models/, utils/, assets/ 등은 그대로 같은 구조로 복사
        port_file(src, dst_root / rel)

    # 자산 파일(.json, .pkl.gz 등 비-py) 그대로 복사
    for src in src_root.rglob("*"):
        if src.is_dir() or src.suffix == ".py":
            continue
        rel = src.relative_to(src_root)
        if any(p in SKIP_PARTS for p in rel.parts):
            continue
        dst = dst_root / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(src.read_bytes())
        print(f"  asset {src.name} -> {dst.relative_to(DST_ROOT.parent)}")

    # 패키지 __init__.py 보장 (비어있는 모듈)
    for sub in [dst_root] + [p.parent for p in dst_root.rglob("*.py")]:
        init = sub / "__init__.py"
        if not init.exists():
            init.write_text('"""OpenBB 이식 패키지."""\n', encoding="utf-8")


def port_standard(models: list) -> None:
    src_root = OPENBB / "core/openbb_core/provider/standard_models"
    dst_root = DST_ROOT / "_obb/provider/standard_models"
    for name in models:
        src = src_root / f"{name}.py"
        if not src.exists():
            print(f"  !! standard model not found: {name}")
            continue
        port_file(src, dst_root / f"{name}.py")


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)
    if args[0] == "standard":
        port_standard(args[1:])
    else:
        for key in args:
            port_provider(key)
