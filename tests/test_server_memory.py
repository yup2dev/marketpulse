"""운영 서버(512MB · 컨테이너 300MB) 메모리 회귀 방지.

2026-11-23 측정: 서버가 켜지기만 해도 provider 등록이 statsmodels(+65MB) · scipy.stats(+35MB) · yfinance(+21MB) ·
QuantLib(+14MB) · openpyxl/reportlab(+11MB)를 불러와 컨테이너 한도에 붙었다 → 평소에도 스왑, 무거운 요청에 멈춤.
이 라이브러리들은 쓸 때만 불러온다 (data_fetcher/utils/lazy_import.py).
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HEAVY = ["statsmodels", "scipy.stats", "yfinance", "QuantLib", "openpyxl", "reportlab"]


def test_server_startup_does_not_import_heavy_libraries():
    code = (
        "import sys\n"
        "import app.backend.main, data_fetcher.providers_init\n"
        f"print(','.join(m for m in {HEAVY!r} if m in sys.modules))\n"
    )
    env_path = [str(ROOT / "MarketpulseWeb"), str(ROOT / "MarketpulseFetcher"), str(ROOT)]
    out = subprocess.run(
        [sys.executable, "-c", f"import sys; sys.path[:0] = {env_path!r}\n" + code],
        capture_output=True, text=True, cwd=ROOT, timeout=300,
    )
    assert out.returncode == 0, out.stderr[-2000:]
    loaded = [m for m in out.stdout.strip().splitlines()[-1].split(",") if m] if out.stdout.strip() else []
    assert loaded == [], f"서버 기동 때 무거운 라이브러리를 불러왔다: {loaded} — 함수 안이나 lazy() 로 옮길 것"


def test_lazy_module_loads_on_first_use_and_allows_patching():
    from data_fetcher.utils.lazy_import import lazy

    mod = lazy("json")
    assert "not loaded" in repr(mod)
    assert mod.dumps({"a": 1}) == '{"a": 1}'
    assert "loaded" in repr(mod) and "not" not in repr(mod)
    mod.dumps = lambda x: "patched"          # 테스트가 속성을 바꿔 끼울 수 있다
    assert mod.dumps({}) == "patched"


def test_packed_cache_round_trips_and_evicts():
    from app.backend.commands.strategies.engine import PackedCache

    c = PackedCache(2)
    c.put("a", {"x": [1.5, None, "s"]})
    c.put("b", {"y": 2})
    assert c.get("a") == {"x": [1.5, None, "s"]}     # a 를 최근으로
    c.put("c", {"z": 3})                              # 가장 오래된 b 가 빠진다
    assert "b" not in c and "a" in c and "c" in c and len(c) == 2
    assert c.get("missing") is None and c.nbytes() > 0
