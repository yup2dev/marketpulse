"""배치 실행기(MarketpulseBatch/run_job.py) 계약 테스트.

외부 스케줄러는 종료 코드만 본다 — 실패를 삼키면(예전 APScheduler 작업처럼) 아무도 모른다.
실제 수집 작업은 돌리지 않고, 가짜 작업 스크립트로 실행기 동작만 검증한다.
"""
import datetime as dt
import importlib.util
import json
import pathlib
import sys
import textwrap

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
RUNNER = ROOT / "MarketpulseBatch" / "run_job.py"

SUNDAY = dt.date(2026, 11, 8)
WEDNESDAY = dt.date(2026, 11, 4)


def _load(name):
    # dataclass 는 sys.modules[모듈명] 을 찾으므로 등록한 뒤 실행한다
    spec = importlib.util.spec_from_file_location(name, RUNNER)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture
def rj(tmp_path, monkeypatch):
    mod = _load("run_job_under_test")

    jobs_dir = tmp_path / "jobs"
    jobs_dir.mkdir()
    scripts = {
        "ok.py": "import sys; print('hello from ok', sys.argv[1:]); sys.exit(0)",
        "fail.py": "import sys; print('boom', file=sys.stderr); sys.exit(7)",
        "slow.py": "import time; time.sleep(30)",
        "env.py": "import os, sys; print('MP_SYNC_EMAIL=' + os.environ.get('MP_SYNC_EMAIL', '<none>'))",
    }
    for name, body in scripts.items():
        (jobs_dir / name).write_text(textwrap.dedent(body), encoding="utf-8")

    monkeypatch.setattr(mod, "JOBS_DIR", jobs_dir)
    monkeypatch.setattr(mod, "SYNC_ENV", jobs_dir / "sync.env")
    monkeypatch.setattr(mod, "LOG_DIR", tmp_path / "logs")
    monkeypatch.setattr(mod, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(mod, "JOBS", {
        "a": mod.Job("ok.py", ("x",), "ok job"),
        "b": mod.Job("fail.py", (), "failing job"),
        "c": mod.Job("ok.py", (), "depends on b"),
        "slow": mod.Job("slow.py", (), "times out", timeout=1),
        "env": mod.Job("env.py", (), "prints env"),
    })
    monkeypatch.setattr(mod, "PIPELINES", {
        "p": [mod.Step("a"), mod.Step("b"), mod.Step("c", needs=("b",)), mod.Step("a", on=("sun",))],
        "good": [mod.Step("a"), mod.Step("a", on=("sun",))],
    })
    return mod


def _history(rj):
    path = rj.LOG_DIR / "batch" / "history.jsonl"
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]


def test_single_job_success_writes_log_and_history(rj, capsys):
    assert rj.main(["a", "--date", "20261104"]) == rj.EXIT_OK
    log = (rj.LOG_DIR / "batch" / "a_20261104.log").read_text(encoding="utf-8")
    assert "hello from ok ['x']" in log          # 작업 출력은 콘솔이 아니라 로그 파일로
    assert "hello from ok" not in capsys.readouterr().out
    (entry,) = _history(rj)
    assert entry["job"] == "a" and entry["rc"] == 0 and entry["status"] == "ok"


def test_job_args_override_defaults(rj):
    assert rj.main(["a", "y", "z", "--date", "20261104"]) == rj.EXIT_OK
    assert "['y', 'z']" in (rj.LOG_DIR / "batch" / "a_20261104.log").read_text(encoding="utf-8")


def test_failed_job_returns_nonzero_and_captures_stderr(rj):
    assert rj.main(["b", "--date", "20261104"]) == rj.EXIT_FAILED
    assert "boom" in (rj.LOG_DIR / "batch" / "b_20261104.log").read_text(encoding="utf-8")
    assert _history(rj)[0]["rc"] == 7


def test_timeout_is_failure(rj):
    assert rj.main(["slow"]) == rj.EXIT_FAILED
    assert _history(rj)[0]["status"] == "timeout"


def test_pipeline_skips_dependents_and_reports_failure(rj, capsys):
    rc = rj.run_pipeline("p", run_date=WEDNESDAY)
    out = capsys.readouterr().out
    assert rc == rj.EXIT_FAILED
    ran = [e["job"] for e in _history(rj)]
    assert ran == ["a", "b"]                     # c 는 b 실패로, 마지막 a 는 요일 조건으로 건너뜀
    assert "선행 작업 실패(b)" in out and "요일 조건(sun)" in out


def test_weekday_condition(rj):
    assert rj.run_pipeline("good", run_date=SUNDAY) == rj.EXIT_OK
    assert [e["job"] for e in _history(rj)] == ["a", "a"]


def test_dry_run_executes_nothing(rj, capsys):
    assert rj.main(["p", "--date", "20261108", "--dry-run"]) == rj.EXIT_OK
    assert not (rj.LOG_DIR / "batch" / "history.jsonl").exists()
    assert capsys.readouterr().out.count("[PLAN") == 4


def test_lock_blocks_concurrent_run(rj):
    with rj.FileLock(rj.LOG_DIR / "batch" / "locks" / "job_a.lock"):
        assert rj.main(["a"]) == rj.EXIT_LOCKED
        # 묶음 안에서도 같은 작업은 막히고 실패로 센다
        assert rj.run_pipeline("good", run_date=WEDNESDAY) == rj.EXIT_FAILED
    assert rj.main(["a"]) == rj.EXIT_OK          # lock 해제 후에는 정상


def test_pipeline_lock(rj):
    with rj.FileLock(rj.LOG_DIR / "batch" / "locks" / "pipeline_good.lock"):
        assert rj.main(["good"]) == rj.EXIT_LOCKED


def test_sync_env_is_passed_to_jobs(rj, monkeypatch):
    monkeypatch.delenv("MP_SYNC_EMAIL", raising=False)
    (rj.JOBS_DIR / "sync.env").write_text("# comment\nMP_SYNC_EMAIL=ops@example.com\n", encoding="utf-8")
    assert rj.main(["env", "--date", "20261104"]) == rj.EXIT_OK
    log = (rj.LOG_DIR / "batch" / "env_20261104.log").read_text(encoding="utf-8")
    assert "MP_SYNC_EMAIL=ops@example.com" in log


@pytest.mark.parametrize("argv", [["nope"], ["a", "--date", "2026-11-04"], ["good", "extra-arg"]])
def test_usage_errors(rj, argv):
    assert rj.main(argv) == rj.EXIT_USAGE


def test_real_registry_points_at_existing_scripts():
    """실제 작업 목록의 스크립트가 모두 존재하고, 묶음은 등록된 작업만 쓴다."""
    mod = _load("run_job_registry")
    for name, job in mod.JOBS.items():
        assert (mod.JOBS_DIR / job.script).is_file(), f"{name}: jobs/{job.script} 없음"
    for pname, steps in mod.PIPELINES.items():
        for step in steps:
            assert step.job in mod.JOBS, f"{pname}: 미등록 작업 {step.job}"
            assert set(step.on) <= set(mod.WEEKDAYS)
            assert set(step.needs) <= {s.job for s in steps}


def test_runner_cli_runs_from_any_cwd(tmp_path):
    """스케줄러는 cwd 를 보장하지 않는다 — 다른 폴더에서 실행해도 import 가 돼야 한다."""
    import subprocess
    r = subprocess.run([sys.executable, str(RUNNER), "daily", "--dry-run", "--date", "20261108"],
                       cwd=tmp_path, capture_output=True, text=True, encoding="utf-8")
    assert r.returncode == 0, r.stdout + r.stderr
    assert r.stdout.count("[PLAN") == 6
