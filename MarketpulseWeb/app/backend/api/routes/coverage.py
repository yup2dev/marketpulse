"""등록 목록 조회 — 표준 모델에서 만든 라우트(CommandRouter)가 무엇을 주는지.

GET /api/v1/coverage → [{path, model, providers, params: [{name, required, providers}]}]

앱의 OpenAPI 스키마에서 "model" 이 붙은 operation 을 읽는다 (CommandRouter 가 openapi_extra 로 단다) —
라우트 파일이 따로 적어 둘 필요가 없다. app.routes 를 훑지 않는다: fastapi 0.14x 에서 include 된 라우트가
app.routes 에 보이지 않는다 (tests/test_app_boot.py 참고). OpenAPI 는 버전을 넘어 같은 공개 계약이다.
params[].providers 가 비면 모든 provider 가 받는 표준 파라미터다.
"""
from typing import Any, Dict, List

from fastapi import APIRouter, Request

from data_fetcher.core.interface import model_spec

# 등록 (api/routers.py 자동 탐색)
PREFIX = "/api/v1"
TAGS = ["commands"]
router = APIRouter()


def command_routes(openapi: Dict[str, Any]) -> List[Dict[str, Any]]:
    out = []
    for path, ops in (openapi.get("paths") or {}).items():
        model = (ops.get("get") or {}).get("model")
        if not model:
            continue
        try:
            spec = model_spec(model)
        except KeyError:   # 파라미터를 직접 적은 옛 command 가 없는 모델을 가리키는 경우
            out.append({"path": path, "model": model, "providers": [], "params": []})
            continue
        out.append({
            "path": path,
            "model": spec.model,
            "providers": list(spec.providers),
            "params": [
                {"name": p.name, "required": p.required, "providers": list(p.providers)}
                for p in spec.params
            ],
        })
    return sorted(out, key=lambda c: c["path"])


@router.get("/coverage")
async def coverage(request: Request) -> List[Dict[str, Any]]:
    return command_routes(request.app.openapi())
