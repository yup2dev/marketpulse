"""마이그레이션 비교에서 제외할 테이블 목록.

env.py 는 alembic 이 실행할 때만 import 할 수 있는 모듈이라(import 시점에 alembic
context 가 필요하다), 테스트에서도 쓰는 이 상수만 따로 뺀다.

여기 있는 테이블은 **ORM 모델이 없는데 DB 에는 존재하고 데이터도 들어 있다.**
autogenerate 가 DROP TABLE 을 제안하면 그대로 날아가므로 비교에서 제외한다.

    quant_strategy_types    9행
    quant_strategies       10행
    mbs_in_etl_mapping     62행

정리하려면: 데이터가 실제로 쓰이지 않는지 확인한 뒤, 여기서 빼고 명시적인
마이그레이션(op.drop_table)으로 삭제할 것. 확인 없이 지우지 말 것.
"""
ORPHAN_TABLES = frozenset({
    "quant_strategy_types",
    "quant_strategies",
    "mbs_in_etl_mapping",
})


def include_object(obj, name, type_, reflected, compare_to) -> bool:
    """alembic 의 include_object 훅 — 고아 테이블을 비교 대상에서 뺀다."""
    if type_ == "table" and name in ORPHAN_TABLES:
        return False
    return True
