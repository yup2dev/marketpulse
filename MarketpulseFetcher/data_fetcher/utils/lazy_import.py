"""무거운 서드파티 모듈을 처음 쓸 때 불러오는 대리 객체.

provider 를 등록하면(providers_init) 모든 fetcher 모듈이 import 된다. 모듈 맨 위에서 yfinance(+21MB) 같은
라이브러리를 바로 import 하면, 운영 서버(512MB)는 그 provider 를 한 번도 쓰지 않아도 기동만으로 그만큼을 잃는다
(2026-11-23 측정: 서버 기동 직후 약 300MB 중 provider 등록이 +151MB).

    from data_fetcher.utils.lazy_import import lazy
    yf = lazy("yfinance")        # 이 줄은 아무것도 불러오지 않는다
    yf.Ticker("AAPL")            # 여기서 처음 import

모듈 로드 시점에 속성을 읽으면(클래스 속성 · 기본 인자 · 타입 표기) 그때 불러오므로 효과가 없다 — 함수 안에서만 쓴다.
"""
from __future__ import annotations

import importlib
from types import ModuleType


class LazyModule:
    def __init__(self, name: str):
        self._lazy_name = name
        self._lazy_mod: ModuleType | None = None

    def _load(self) -> ModuleType:
        if self._lazy_mod is None:
            self._lazy_mod = importlib.import_module(self._lazy_name)
        return self._lazy_mod

    def __getattr__(self, attr: str):
        # 인스턴스에 없는 이름만 여기로 온다 (테스트가 setattr 로 바꿔 둔 속성은 그대로 쓰인다)
        return getattr(self._load(), attr)

    def __repr__(self) -> str:
        state = "loaded" if self._lazy_mod is not None else "not loaded"
        return f"<lazy module {self._lazy_name!r} ({state})>"


def lazy(name: str) -> LazyModule:
    return LazyModule(name)
