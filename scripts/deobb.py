"""data_fetcher/_obb shim 제거 — 이식 코드를 프로젝트 네이티브 경로로 전환.

1) _obb/provider/standard_models/*.py → abstract_provider/standard_models/openbb/
2) 이식 파일들의 `data_fetcher._obb.*` import 를 프로젝트 경로로 치환
3) _obb 패키지 삭제
"""
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DF = ROOT / "data_fetcher"
OBB = DF / "_obb"
STD_DST = DF / "abstract_provider" / "standard_models" / "openbb"

# import 라인 치환 규칙 (정규식 → 대체)
REPLACEMENTS = [
    (r"from data_fetcher\._obb\.provider\.abstract\.fetcher import",
     "from data_fetcher.abstract_provider.abstract.fetcher import"),
    (r"from data_fetcher\._obb\.provider\.abstract\.annotated_result import",
     "from data_fetcher.abstract_provider.abstract.annotated_result import"),
    (r"from data_fetcher\._obb\.provider\.abstract\.data import",
     "from data_fetcher.abstract_provider.standard_models.openbb._base import"),
    (r"from data_fetcher\._obb\.provider\.abstract\.query_params import",
     "from data_fetcher.abstract_provider.standard_models.openbb._base import"),
    (r"from data_fetcher\._obb\.provider\.standard_models",
     "from data_fetcher.abstract_provider.standard_models.openbb"),
    (r"from data_fetcher\._obb\.provider\.utils\.helpers import",
     "from data_fetcher.utils.provider_helpers import"),
    (r"from data_fetcher\._obb\.provider\.utils\.errors import",
     "from data_fetcher.utils.provider_errors import"),
    (r"from data_fetcher\._obb\.provider\.utils\.descriptions import",
     "from data_fetcher.abstract_provider.field_descriptions import"),
    # 패키지 레벨 helpers import (OECD 등)
    (r"from data_fetcher\._obb\.provider import helpers",
     "from data_fetcher.utils import provider_helpers as helpers"),
    (r"from data_fetcher\._obb\.app\.model\.abstract\.error import",
     "from data_fetcher.utils.provider_errors import"),
    (r"from data_fetcher\._obb\.app\.model\.abstract\.warning import",
     "from data_fetcher.utils.provider_errors import"),
    (r"from data_fetcher\._obb\.app\.utils import",
     "from data_fetcher.utils.provider_settings import"),
    (r"from data_fetcher\._obb\.app\.service\.system_service import",
     "from data_fetcher.utils.provider_settings import"),
]

# 이식 코드가 위치한 디렉토리 (여기 .py 전부 치환)
TARGET_DIRS = [
    DF / "providers" / "wsj",
    DF / "providers" / "bls",
    DF / "providers" / "eia",
    DF / "providers" / "oecd",
    DF / "providers" / "imf",
    DF / "providers" / "sec" / "openbb",
    STD_DST,  # 이동된 standard_models
]
EXTRA_FILES = [DF / "query_executor.py"]


def rewrite_text(text: str) -> str:
    for pat, repl in REPLACEMENTS:
        text = re.sub(pat, repl, text)
    return text


def move_standard_models() -> None:
    src = OBB / "provider" / "standard_models"
    STD_DST.mkdir(parents=True, exist_ok=True)
    for f in src.glob("*.py"):
        if f.name == "__init__.py":
            continue
        shutil.copy2(f, STD_DST / f.name)
        print(f"  std-model {f.name} -> standard_models/openbb/{f.name}")
    init = STD_DST / "__init__.py"
    if not init.exists():
        init.write_text('"""OpenBB 이식 표준 모델."""\n', encoding="utf-8")


def rewrite_targets() -> None:
    files = []
    for d in TARGET_DIRS:
        files += list(d.rglob("*.py"))
    files += [f for f in EXTRA_FILES if f.exists()]
    n = 0
    for f in files:
        text = f.read_text(encoding="utf-8")
        new = rewrite_text(text)
        if new != text:
            f.write_text(new, encoding="utf-8")
            n += 1
    print(f"  rewrote imports in {n} files")


if __name__ == "__main__":
    print("[deobb] move standard models")
    move_standard_models()
    print("[deobb] rewrite imports")
    rewrite_targets()
    print("[deobb] remove _obb package")
    shutil.rmtree(OBB, ignore_errors=True)
    print("[deobb] done")
