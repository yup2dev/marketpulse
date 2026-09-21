"""모든 ORM 모델을 한 번에 등록한다 — `Base.metadata` 를 완전하게 만드는 단일 지점.

왜 필요한가:
    SQLAlchemy 의 `Base.metadata` 는 모델 클래스가 **import 된 시점에** 채워진다.
    `models/orm/__init__.py` 는 orm/ 패키지 안의 모델만 import 하는데, 실제 모델 일부는
    그 바깥(models/menu.py, models/quant_factor.py, models/quant_factor_catalog.py)에
    있다. 이 모델들은 라우트가 import 될 때 우연히 함께 등록돼 왔다.

    그래서 두 가지 문제가 있었다:
      1. `init_db()` 의 create_all 이 import 순서에 의존한다 — 라우트가 먼저 import 되지
         않으면 그 테이블은 만들어지지 않는다.
      2. alembic autogenerate 가 metadata 에 없는 테이블을 '삭제됨'으로 보고
         **DROP TABLE 을 생성한다.** 실제로 menu_management(31행) 등이 그렇게 잡혔다.

    orm/__init__.py 에서 직접 import 하면 순환 참조가 된다(menu.py 가 orm 의 Base 를
    import 하므로). 그래서 한 단계 위에 이 모듈을 둔다.

사용처:
    - app/backend/core/db.py  : init_db() 의 create_all 직전
    - migrations/env.py       : autogenerate 의 target_metadata 준비

새 ORM 모델을 추가하면 여기에 import 를 추가할 것.
(tests/test_orm_metadata.py 가 누락을 잡는다)
"""
# orm/ 패키지 (Base 와 대부분의 모델)
from index_analyzer.models.orm import Base  # noqa: F401

# orm/ 바깥에 있는 모델들 — 반드시 함께 import 해야 metadata 가 완전해진다
from index_analyzer.models import menu  # noqa: F401
from index_analyzer.models import quant_factor  # noqa: F401
from index_analyzer.models import quant_factor_catalog  # noqa: F401

__all__ = ["Base"]
