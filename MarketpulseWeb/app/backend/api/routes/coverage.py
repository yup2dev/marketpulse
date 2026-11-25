"""등록 목록 조회 — 표준 모델에서 만든 라우트(CommandRouter)가 무엇을 주는지.

GET /api/v1/coverage → [{path, model, providers, params: [{name, required, providers}]}]

앱에 붙은 라우트 중 openapi_extra["model"] 이 있는 것을 읽는다 — 라우트 파일이 따로 적어 둘 필요가 없다.
params[].providers 가 비면 모든 provider 가 받는 표준 파라미터다.
"""
from typing import Any, Dict, List

from fastapi import APIRouter, Request
from fastapi.routing import APIRoute

from data_fetcher.core.interface import model_spec

# 등록 (api/routers.py 자동 탐색)
PREFIX = "/api/v1"
TAGS = ["commands"]
router = APIRouter()


def command_routes(routes) -> List[Dict[str, Any]]:
    out = []
    for r in routes:
        model = (getattr(r, "openapi_extra", None) or {}).get("model") if isinstance(r, APIRoute) else None
        if not model:
            continue
        try:
            spec = model_spec(model)
        except KeyError:   # 파라미터를 직접 적은 옛 command 가 없는 모델을 가리키는 경우
            out.append({"path": r.path, "model": model, "providers": [], "params": []})
            continue
        out.append({
            "path": r.path,
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
    return command_routes(request.app.routes)
