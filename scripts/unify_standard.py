"""standard_models/openbb 서브패키지를 제거하고 단일 standard_models 로 통합.

- _base.py + 충돌하지 않는 이식 표준모델 36개 → standard_models/ 평면 이동
- 충돌 4개(balance_sheet/cash_flow/income_statement/insider_trading)는 프로젝트 것 사용
  (openbb 버전 삭제). SEC 모델은 프로젝트 표준모델을 상속하도록 import 치환.
- 모든 이식 코드의 `standard_models.openbb.*` → `standard_models.*`
"""
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DF = ROOT / "data_fetcher"
STD = DF / "abstract_provider" / "standard_models"
OBB = STD / "openbb"

COLLIDING = {"balance_sheet", "cash_flow", "income_statement", "insider_trading"}

# SEC cash_flow 는 클래스명이 다르므로 alias 로 치환 (그 외 3개는 클래스명 동일)
CASH_FLOW_OLD = (
    "from data_fetcher.abstract_provider.standard_models.openbb.cash_flow import (\n"
    "    CashFlowStatementData,\n"
    "    CashFlowStatementQueryParams,\n"
    ")"
)
CASH_FLOW_NEW = (
    "from data_fetcher.abstract_provider.standard_models.cash_flow import (\n"
    "    CashFlowData as CashFlowStatementData,\n"
    "    CashFlowQueryParams as CashFlowStatementQueryParams,\n"
    ")"
)

TARGET_DIRS = [
    DF / "providers" / "wsj",
    DF / "providers" / "bls",
    DF / "providers" / "eia",
    DF / "providers" / "oecd",
    DF / "providers" / "imf",
    DF / "providers" / "sec" / "openbb",
    STD,  # 평면 이동된 표준모델 포함
]
EXTRA_FILES = [DF / "query_executor.py"]


def move_flat() -> None:
    for f in OBB.glob("*.py"):
        if f.name == "__init__.py":
            continue
        stem = f.stem
        if stem in COLLIDING:
            continue  # 충돌 → 프로젝트 것 사용, openbb 버전 폐기
        shutil.copy2(f, STD / f.name)
        print(f"  moved {f.name}")


def rewrite(text: str) -> str:
    text = text.replace(CASH_FLOW_OLD, CASH_FLOW_NEW)
    text = text.replace(
        "data_fetcher.abstract_provider.standard_models.openbb.",
        "data_fetcher.abstract_provider.standard_models.",
    )
    return text


def rewrite_targets() -> None:
    files = []
    for d in TARGET_DIRS:
        files += list(d.rglob("*.py"))
    files += [f for f in EXTRA_FILES if f.exists()]
    n = 0
    for f in files:
        if OBB in f.parents:
            continue  # 삭제될 디렉토리는 건너뜀
        t = f.read_text(encoding="utf-8")
        nt = rewrite(t)
        if nt != t:
            f.write_text(nt, encoding="utf-8")
            n += 1
    print(f"  rewrote {n} files")


if __name__ == "__main__":
    print("[unify] move non-colliding standard models flat")
    move_flat()
    print("[unify] rewrite imports")
    rewrite_targets()
    print("[unify] delete standard_models/openbb")
    shutil.rmtree(OBB, ignore_errors=True)
    print("[unify] done")
