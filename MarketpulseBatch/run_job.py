"""MarketPulse 배치 실행기 — 작업 하나 또는 작업 묶음(daily)을 실행한다.

언제 돌릴지는 밖(Windows 작업 스케줄러 등)이 정하고, 이 실행기는 '무엇을 어떤 순서로,
어떻게 실패를 알릴지'만 책임진다.

    python MarketpulseBatch/run_job.py list                 # 작업·묶음 목록
    python MarketpulseBatch/run_job.py fx                   # 작업 하나 (기본 인자)
    python MarketpulseBatch/run_job.py fx 1y                # 작업 하나 + 인자 덮어쓰기
    python MarketpulseBatch/run_job.py daily                # 묶음 (요일 조건 적용)
    python MarketpulseBatch/run_job.py daily --date 20261108 --dry-run   # 그날의 실행 계획만 출력

규칙 (외부 스케줄러가 기대하는 계약):
  - 종료 코드: 0 성공 / 1 작업 실패 / 2 이미 실행 중(lock) / 3 사용법 오류
  - 각 작업은 별도 프로세스로 실행 (13F 처럼 메모리를 많이 쓰는 작업이 다른 작업에 영향 없게)
  - 작업 출력(stdout+stderr)은 전부 logs/batch/<작업>_<YYYYMMDD>.log 로. 콘솔에는 요약 한 줄씩만
  - 실행 이력은 logs/batch/history.jsonl 에 한 줄씩 (작업, 시작·종료, 종료코드, 상태)
  - 같은 작업은 동시에 한 번만 (작업 lock + 묶음 lock, OS 파일 lock 이라 프로세스가 죽으면 자동 해제)
  - jobs/sync.env 가 있으면 그 KEY=VALUE 를 작업 환경변수에 넣는다 (클라우드 동기화 인증)
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

# import 경로: 저장소 루트 + 최상위 폴더 4개 (mp-bootstrap)
_ROOT = Path(__file__).resolve().parents[1]
for _d in ("", *("MarketpulseCommon", "MarketpulseFetcher", "MarketpulseBatch", "MarketpulseWeb")):
    if str(_ROOT / _d) not in sys.path:
        sys.path.insert(0, str(_ROOT / _d))

from marketpulse_common.paths import LOG_DIR, REPO_ROOT  # noqa: E402

JOBS_DIR = Path(__file__).resolve().parent / "jobs"
SYNC_ENV = JOBS_DIR / "sync.env"

EXIT_OK, EXIT_FAILED, EXIT_LOCKED, EXIT_USAGE = 0, 1, 2, 3
WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


@dataclass(frozen=True)
class Job:
    script: str                      # jobs/ 아래 파일명
    args: Sequence[str] = ()         # 기본 인자 (명령줄에서 덮어쓸 수 있다)
    desc: str = ""
    timeout: Optional[int] = None    # 초. 넘기면 프로세스를 죽이고 실패 처리


@dataclass(frozen=True)
class Step:
    job: str
    on: Sequence[str] = ()           # 실행 요일 (비면 매일)
    needs: Sequence[str] = ()        # 이 작업들이 실패했으면 건너뛴다 (같은 묶음 안에서)


JOBS: Dict[str, Job] = {
    "universe_kr":  Job("universe.py", ("kr",), "KOSPI/KOSDAQ 종목 + ETF + 국고채 (pykrx)", 3600),
    "universe_us":  Job("universe.py", ("us",), "NYSE/NASDAQ 종목 + ETF (NASDAQ Trader)", 3600),
    "stk_backfill": Job("backfill_stk_stbd.py", ("1mo",), "일별 시세 → mbs_in_stk_stbd (yfinance)", 3 * 3600),
    "fx":           Job("collect_fx.py", ("1mo",), "일별 환율 → mbs_in_fx_stbd", 1800),
    "13f":          Job("collect_13f.py", (), "13F 기관 보유 + 추정 수익률 (로컬 파싱)", 4 * 3600),
    "sync_cloud":   Job("sync_db_to_cloud.py", (), "로컬 적재 DB → 서버 /api/ingest 증분 전송", 3600),
    "sp500":        Job("collect_sp500.py", (), "S&P 500 구성종목·프로필·관계 전체 수집 (최초/분기)", 2 * 3600),
    "profile":      Job("stock_profile.py", ("price",), "S&P 500 가격·시총 갱신 (yfinance)", 3600),
    "relations":    Job("stock_profile.py", ("relations",), "S&P 500 Peer 관계 갱신 (FMP)", 2 * 3600),
}

# 예전 daily_ingest.bat(07:30) + worker APScheduler(universe) 를 합친 순서.
# sync_cloud 는 앞 작업 일부가 실패해도 돈다 — 성공한 적재분이라도 서버에 보내는 게 낫다(upsert).
PIPELINES: Dict[str, List[Step]] = {
    "daily": [
        Step("universe_kr"),
        Step("universe_us", on=("sun",)),
        Step("stk_backfill"),
        Step("fx"),
        Step("13f", on=("sun",)),
        Step("sync_cloud"),
    ],
}


# ── lock ─────────────────────────────────────────────────────────────────────

class LockBusy(Exception):
    pass


class FileLock:
    """OS 파일 lock. 프로세스가 비정상 종료돼도 OS 가 풀어준다 (stale lock 없음)."""

    def __init__(self, path: Path):
        self.path = path
        self._fh = None

    def __enter__(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._fh = open(self.path, "a+")
        try:
            if os.name == "nt":
                import msvcrt
                self._fh.seek(0)
                msvcrt.locking(self._fh.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(self._fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            self._fh.close()
            raise LockBusy(str(self.path))
        return self

    def __exit__(self, *exc):
        try:
            if os.name == "nt":
                import msvcrt
                self._fh.seek(0)
                msvcrt.locking(self._fh.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl
                fcntl.flock(self._fh.fileno(), fcntl.LOCK_UN)
        finally:
            self._fh.close()


# ── 실행 ─────────────────────────────────────────────────────────────────────

def _batch_dir() -> Path:
    d = LOG_DIR / "batch"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _job_env() -> Dict[str, str]:
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUNBUFFERED"] = "1"
    if SYNC_ENV.exists():
        for line in SYNC_ENV.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env.setdefault(k.strip(), v.strip())   # 이미 설정된 환경변수가 우선
    return env


def _record(entry: dict) -> None:
    with open(_batch_dir() / "history.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def _say(msg: str) -> None:
    print(msg, flush=True)


def _spawn(name: str, cmd: List[str], argv: List[str], log_path: Path,
           timeout: Optional[int]) -> Tuple[int, str, float]:
    t0 = time.monotonic()
    with open(log_path, "a", encoding="utf-8") as log:
        log.write(f"\n===== {dt.datetime.now():%Y-%m-%d %H:%M:%S} start {name} {' '.join(argv)} =====\n")
        log.flush()
        try:
            rc = subprocess.run(cmd, cwd=REPO_ROOT, env=_job_env(), stdout=log, stderr=subprocess.STDOUT,
                                stdin=subprocess.DEVNULL, timeout=timeout).returncode
            status = "ok" if rc == 0 else "failed"
        except subprocess.TimeoutExpired:
            rc, status = EXIT_FAILED, "timeout"
        elapsed = time.monotonic() - t0
        log.write(f"===== {dt.datetime.now():%Y-%m-%d %H:%M:%S} end {name} rc={rc} ({status}, {elapsed:.0f}s) =====\n")
    return rc, status, elapsed


def run_one(name: str, args: Optional[Sequence[str]] = None, *, run_date: dt.date, pipeline: str = "") -> int:
    """작업 하나를 별도 프로세스로 실행하고 종료 코드(EXIT_*)를 돌려준다."""
    job = JOBS[name]
    argv = list(job.args if args is None else args)
    log_path = _batch_dir() / f"{name}_{run_date:%Y%m%d}.log"
    cmd = [sys.executable, str(JOBS_DIR / job.script), *argv]

    started = dt.datetime.now()
    # 단독 실행과 묶음이 같은 작업을 동시에 돌리지 않게 작업 단위로 잠근다
    try:
        lock = FileLock(_batch_dir() / "locks" / f"job_{name}.lock")
        lock.__enter__()
    except LockBusy:
        _say(f"[LOCKED ] {name:<12}         이미 실행 중")
        return EXIT_LOCKED
    try:
        rc, status, elapsed = _spawn(name, cmd, argv, log_path, job.timeout)
    finally:
        lock.__exit__(None, None, None)

    _record({"job": name, "pipeline": pipeline or None, "args": argv,
             "start": started.isoformat(timespec="seconds"), "end": dt.datetime.now().isoformat(timespec="seconds"),
             "rc": rc, "status": status, "seconds": round(elapsed), "log": str(log_path)})
    _say(f"[{status.upper():7}] {name:<12} {elapsed:6.0f}s  log={log_path.name}")
    return EXIT_OK if rc == 0 else EXIT_FAILED


def plan(pipeline: str, run_date: dt.date) -> List[Tuple[Step, bool, str]]:
    """(step, 실행여부, 사유) — 요일 조건만 반영 (needs 는 실행 중에 판단)."""
    wd = WEEKDAYS[run_date.weekday()]
    out = []
    for step in PIPELINES[pipeline]:
        if step.on and wd not in step.on:
            out.append((step, False, f"요일 조건({','.join(step.on)})"))
        else:
            out.append((step, True, ""))
    return out


def run_pipeline(pipeline: str, *, run_date: dt.date, dry_run: bool = False) -> int:
    failed: List[str] = []
    for step, should_run, reason in plan(pipeline, run_date):
        blocked = [n for n in step.needs if n in failed]
        if not should_run or blocked:
            _say(f"[SKIP   ] {step.job:<12}         {reason or '선행 작업 실패(' + ','.join(blocked) + ')'}")
            continue
        if dry_run:
            _say(f"[PLAN   ] {step.job:<12}         {JOBS[step.job].desc}")
            continue
        if run_one(step.job, run_date=run_date, pipeline=pipeline) != EXIT_OK:   # 실패·lock 모두 실패로 센다
            failed.append(step.job)
    if failed:
        _say(f"{pipeline}: 실패 {len(failed)}건 — {', '.join(failed)}")
        return EXIT_FAILED
    return EXIT_OK


def _list() -> None:
    _say("작업:")
    for name, job in JOBS.items():
        _say(f"  {name:<12} {job.desc}  [jobs/{job.script} {' '.join(job.args)}]".rstrip())
    _say("묶음:")
    for name, steps in PIPELINES.items():
        _say(f"  {name:<12} " + " → ".join(s.job + (f"({','.join(s.on)})" if s.on else "") for s in steps))


def main(argv: Optional[Sequence[str]] = None) -> int:
    for stream in (sys.stdout, sys.stderr):   # Windows 콘솔(cp949)에서도 요약이 깨지지 않게
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass

    ap = argparse.ArgumentParser(prog="run_job.py", description="MarketPulse 배치 실행기")
    ap.add_argument("target", help="작업 이름, 묶음 이름, 또는 list")
    ap.add_argument("job_args", nargs="*", help="작업 인자 (기본 인자를 대체)")
    ap.add_argument("--date", help="기준일 YYYYMMDD (요일 조건·로그 파일명, 기본 오늘)")
    ap.add_argument("--dry-run", action="store_true", help="실행 계획만 출력")
    try:
        ns = ap.parse_args(argv)
    except SystemExit as e:
        return EXIT_OK if e.code == 0 else EXIT_USAGE

    if ns.target == "list":
        _list()
        return EXIT_OK
    if ns.target not in JOBS and ns.target not in PIPELINES:
        _say(f"알 수 없는 작업: {ns.target} (list 로 목록 확인)")
        return EXIT_USAGE
    try:
        run_date = dt.datetime.strptime(ns.date, "%Y%m%d").date() if ns.date else dt.date.today()
    except ValueError:
        _say(f"--date 형식 오류: {ns.date} (YYYYMMDD)")
        return EXIT_USAGE

    if ns.target in JOBS:
        if ns.dry_run:
            _say(f"[PLAN   ] {ns.target:<12}         {JOBS[ns.target].desc}")
            return EXIT_OK
        return run_one(ns.target, ns.job_args or None, run_date=run_date)

    if ns.job_args:
        _say("묶음에는 작업 인자를 줄 수 없습니다")
        return EXIT_USAGE
    try:
        with FileLock(_batch_dir() / "locks" / f"pipeline_{ns.target}.lock"):
            return run_pipeline(ns.target, run_date=run_date, dry_run=ns.dry_run)
    except LockBusy:
        _say(f"{ns.target}: 이미 실행 중 — 종료")
        return EXIT_LOCKED


if __name__ == "__main__":
    sys.exit(main())
