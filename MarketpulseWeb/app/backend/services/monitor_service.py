"""운영 모니터링 — 서버 부하 · 메모리 · 요청 성능을 메모리에만 모은다 (관리자 화면 /admin).

운영 서버는 RAM 419MB · 컨테이너 300MB 라, 모니터링이 부하가 되면 안 된다.
    - 외부 라이브러리 없이 /proc · cgroup 파일만 읽는다 (Linux 가 아니면 값이 비어 있을 뿐)
    - 15초마다 한 번 표본을 떠 최근 2시간(480개)만 둔다
    - 요청은 끝날 때 숫자 몇 개만 더한다 (분 단위 묶음 120개 · 경로별 누계 · 느린 요청 50개)
    - 프로세스 하나(uvicorn 단일 워커)의 메모리라 재시작하면 처음부터 다시 쌓인다

    record_start / record_end   요청 계측 (core/middleware/request_metrics.py 가 부른다)
    sampler_loop                주기 표본 (core/lifespan.py 가 띄운다)
    summary · system_series · traffic_series · endpoints · inflight · slow_requests   화면이 읽는 행
"""
from __future__ import annotations

import asyncio
import logging
import os
import threading
import time
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Deque, Dict, List, Optional

log = logging.getLogger(__name__)

KST = timezone(timedelta(hours=9))
SAMPLE_SEC = 15
SAMPLE_KEEP = 480            # 15초 × 480 = 2시간
MINUTE_KEEP = 120            # 분 묶음 2시간
SLOW_MS = 1000               # 이보다 오래 걸린 요청은 '느린 요청'에 남긴다
SLOW_KEEP = 50
LAT_KEEP = 200               # 분 · 경로마다 p95 를 셀 표본 수 (넘으면 오래된 것부터 버린다)
ROUTE_KEEP = 300             # 경로 종류 상한 — 이상한 경로가 쏟아져도 메모리가 늘지 않게

_STARTED = time.time()
_lock = threading.Lock()


def _now_label(ts: float) -> str:
    return datetime.fromtimestamp(ts, KST).strftime("%H:%M")


def _p95(values) -> Optional[float]:
    if not values:
        return None
    s = sorted(values)
    return float(s[min(len(s) - 1, int(round(0.95 * (len(s) - 1))))])


# ══ 요청 계측 ════════════════════════════════════════════════════════════════════

class _Bucket:
    __slots__ = ("minute", "count", "errors", "total_ms", "lat")

    def __init__(self, minute: int):
        self.minute = minute
        self.count = 0
        self.errors = 0
        self.total_ms = 0.0
        self.lat: Deque[float] = deque(maxlen=LAT_KEEP)


class _Route:
    __slots__ = ("count", "errors", "total_ms", "max_ms", "last", "lat")

    def __init__(self):
        self.count = 0
        self.errors = 0
        self.total_ms = 0.0
        self.max_ms = 0.0
        self.last = 0.0
        self.lat: Deque[float] = deque(maxlen=LAT_KEEP)


_minutes: Deque[_Bucket] = deque(maxlen=MINUTE_KEEP)
_routes: Dict[str, _Route] = {}
_slow: Deque[dict] = deque(maxlen=SLOW_KEEP)
_inflight: Dict[int, dict] = {}
_seq = 0


def record_start(method: str, path: str) -> int:
    global _seq
    with _lock:
        _seq += 1
        _inflight[_seq] = {"method": method, "path": path, "start": time.time()}
        return _seq


def record_end(token: int, route: str, status: int) -> None:
    end = time.time()
    with _lock:
        req = _inflight.pop(token, None)
        if req is None:
            return
        ms = (end - req["start"]) * 1000
        err = status >= 500
        minute = int(end // 60)
        if not _minutes or _minutes[-1].minute != minute:
            _minutes.append(_Bucket(minute))
        b = _minutes[-1]
        b.count += 1
        b.errors += err
        b.total_ms += ms
        b.lat.append(ms)

        key = f"{req['method']} {route}"
        r = _routes.get(key)
        if r is None:
            if len(_routes) >= ROUTE_KEEP:
                key = f"{req['method']} (기타)"
                r = _routes.setdefault(key, _Route())
            else:
                r = _routes[key] = _Route()
        r.count += 1
        r.errors += err
        r.total_ms += ms
        r.max_ms = max(r.max_ms, ms)
        r.last = end
        r.lat.append(ms)

        if ms >= SLOW_MS or err:
            _slow.append({"ts": end, "method": req["method"], "path": req["path"], "status": status, "ms": ms})


# ══ 시스템 표본 (/proc · cgroup) ════════════════════════════════════════════════

def _read(path: str) -> Optional[str]:
    try:
        with open(path, "r") as f:
            return f.read()
    except OSError:
        return None


def _meminfo() -> Dict[str, int]:
    txt = _read("/proc/meminfo") or ""
    out = {}
    for line in txt.splitlines():
        k, _, v = line.partition(":")
        parts = v.split()
        if parts:
            out[k] = int(parts[0]) * 1024
    return out


def _cpu_times():
    """(전체, 쉼, iowait) jiffies — 호스트 전체 (/proc/stat 첫 줄)."""
    txt = _read("/proc/stat")
    if not txt:
        return None
    vals = [int(x) for x in txt.splitlines()[0].split()[1:]]
    idle = vals[3] + (vals[4] if len(vals) > 4 else 0)
    return sum(vals), idle, vals[4] if len(vals) > 4 else 0


def _vmstat_swap():
    txt = _read("/proc/vmstat") or ""
    d = {}
    for line in txt.splitlines():
        k, _, v = line.partition(" ")
        if k in ("pswpin", "pswpout"):
            d[k] = int(v)
    return (d["pswpin"], d["pswpout"]) if len(d) == 2 else None


def _cgroup_mem():
    """(사용, 한도) bytes — cgroup v2, 없으면 v1. 한도가 없으면 None."""
    cur = _read("/sys/fs/cgroup/memory.current")
    if cur is not None:
        mx = (_read("/sys/fs/cgroup/memory.max") or "max").strip()
        return int(cur), (None if mx == "max" else int(mx))
    cur = _read("/sys/fs/cgroup/memory/memory.usage_in_bytes")
    if cur is not None:
        mx = int((_read("/sys/fs/cgroup/memory/memory.limit_in_bytes") or "0").strip() or 0)
        return int(cur), (mx if 0 < mx < 1 << 60 else None)
    return None


def _proc_rss() -> Optional[int]:
    txt = _read("/proc/self/status") or ""
    for line in txt.splitlines():
        if line.startswith("VmRSS:"):
            return int(line.split()[1]) * 1024
    return None


def _proc_cpu() -> Optional[float]:
    """이 프로세스가 쓴 CPU 초 (user + system)."""
    try:
        t = os.times()
        return t.user + t.system
    except OSError:
        return None


def _threads_busy() -> Optional[int]:
    """동기 라우트가 쓰는 스레드 풀(anyio, 기본 40) 중 지금 쓰이는 수 — 이벤트 루프에서만 부른다."""
    try:
        import anyio.to_thread
        return int(anyio.to_thread.current_default_thread_limiter().borrowed_tokens)
    except Exception:
        return None


_samples: Deque[dict] = deque(maxlen=SAMPLE_KEEP)
_prev: dict = {}


def take_sample() -> dict:
    now = time.time()
    mi = _meminfo()
    load = None
    try:
        load = os.getloadavg()
    except (OSError, AttributeError):
        pass
    cpu = _cpu_times()
    swap_io = _vmstat_swap()
    proc_cpu = _proc_cpu()
    cg = _cgroup_mem()

    s: dict = {"ts": now}
    if load:
        s["load1"], s["load5"], s["load15"] = load
    if mi.get("MemTotal"):
        total = mi["MemTotal"]
        avail = mi.get("MemAvailable", mi.get("MemFree", 0))
        s["mem_total"] = total
        s["mem_used"] = total - avail
        s["mem_pct"] = (total - avail) / total * 100
    if mi.get("SwapTotal"):
        used = mi["SwapTotal"] - mi.get("SwapFree", 0)
        s["swap_total"] = mi["SwapTotal"]
        s["swap_used"] = used
        s["swap_pct"] = used / mi["SwapTotal"] * 100
    if cg:
        s["cg_used"], s["cg_limit"] = cg
        if cg[1]:
            s["cg_pct"] = cg[0] / cg[1] * 100
    rss = _proc_rss()
    if rss is not None:
        s["rss"] = rss

    prev = _prev.get("v")
    if prev:
        dt = now - prev["ts"]
        if cpu and prev.get("cpu"):
            dtot = cpu[0] - prev["cpu"][0]
            if dtot > 0:
                s["cpu_pct"] = (1 - (cpu[1] - prev["cpu"][1]) / dtot) * 100
                s["iowait_pct"] = (cpu[2] - prev["cpu"][2]) / dtot * 100
        if swap_io and prev.get("swap_io") and dt > 0:
            # 페이지(4KB) 수 → 초당 KB
            s["swap_in_kbs"] = (swap_io[0] - prev["swap_io"][0]) * 4 / dt
            s["swap_out_kbs"] = (swap_io[1] - prev["swap_io"][1]) * 4 / dt
        if proc_cpu is not None and prev.get("proc_cpu") is not None and dt > 0:
            s["app_cpu_pct"] = (proc_cpu - prev["proc_cpu"]) / dt * 100
    _prev["v"] = {"ts": now, "cpu": cpu, "swap_io": swap_io, "proc_cpu": proc_cpu}

    with _lock:
        s["inflight"] = len(_inflight)
    busy = _threads_busy()
    if busy is not None:
        s["threads"] = busy
    return s


async def sampler_loop() -> None:
    while True:
        try:
            _samples.append(take_sample())
        except Exception as e:  # 모니터링이 앱을 멈추게 하지 않는다
            log.debug("monitor sample failed: %s", e)
        await asyncio.sleep(SAMPLE_SEC)


# ══ 화면이 읽는 행 ══════════════════════════════════════════════════════════════

def _mb(v) -> Optional[float]:
    return None if v is None else round(v / 1024 / 1024, 1)


def _r(v, d=1) -> Optional[float]:
    return None if v is None else round(float(v), d)


def _fmt_uptime(sec: float) -> str:
    sec = int(sec)
    d, h, m = sec // 86400, sec % 86400 // 3600, sec % 3600 // 60
    return f"{d}일 {h}시간" if d else f"{h}시간 {m}분" if h else f"{m}분"


def _recent_minutes(n: int) -> List[_Bucket]:
    cutoff = int(time.time() // 60) - n
    return [b for b in _minutes if b.minute > cutoff]


def summary() -> List[dict]:
    """요약 줄 (kpis 뷰 — label · value · sub · tone). tone 이 음수면 경고 색."""
    s = _samples[-1] if _samples else take_sample()
    with _lock:
        recent = _recent_minutes(5)
        count = sum(b.count for b in recent)
        errors = sum(b.errors for b in recent)
        lat = [x for b in recent for x in b.lat]
        inflight = len(_inflight)
        oldest = max((time.time() - r["start"] for r in _inflight.values()), default=0)

    def warn(bad: bool) -> Optional[int]:
        return -1 if bad else None

    rows = [{"id": "who", "lead": True, "label": "MarketPulse API", "value": f"가동 {_fmt_uptime(time.time() - _STARTED)}"}]
    if "load1" in s:
        rows.append({"id": "load", "label": "부하 (1·5·15분)", "value": f"{s['load1']:.2f}",
                     "sub": f"{s['load5']:.2f} · {s['load15']:.2f} · {os.cpu_count() or '?'} vCPU",
                     "tone": warn(s["load1"] > (os.cpu_count() or 1) * 1.5)})
    if "cpu_pct" in s:
        rows.append({"id": "cpu", "label": "CPU (호스트)", "value": f"{s['cpu_pct']:.0f}%",
                     "sub": f"iowait {s.get('iowait_pct', 0):.0f}% · 앱 {s.get('app_cpu_pct', 0):.0f}%",
                     "tone": warn(s.get("iowait_pct", 0) > 20)})
    if "mem_pct" in s:
        rows.append({"id": "mem", "label": "메모리", "value": f"{s['mem_pct']:.0f}%",
                     "sub": f"{_mb(s['mem_used']):.0f} / {_mb(s['mem_total']):.0f} MB",
                     "tone": warn(s["mem_pct"] > 90)})
    if "swap_used" in s:
        io = s.get("swap_in_kbs", 0) + s.get("swap_out_kbs", 0)
        rows.append({"id": "swap", "label": "스왑", "value": f"{_mb(s['swap_used']):.0f} MB",
                     "sub": f"입출력 {io:.0f} KB/s", "tone": warn(io > 500)})
    if "cg_used" in s:
        lim = f" / {_mb(s['cg_limit']):.0f} MB" if s.get("cg_limit") else ""
        rows.append({"id": "cg", "label": "컨테이너 메모리", "value": f"{_mb(s['cg_used']):.0f} MB",
                     "sub": f"{s['cg_pct']:.0f}%{lim}" if "cg_pct" in s else lim.strip(" /") or None,
                     "tone": warn(s.get("cg_pct", 0) > 85)})
    elif "rss" in s:
        rows.append({"id": "rss", "label": "앱 메모리 (RSS)", "value": f"{_mb(s['rss']):.0f} MB"})
    rows.append({"id": "rpm", "label": "요청 (최근 5분)", "value": f"{count / 5:.1f}/분",
                 "sub": f"오류 {errors}건" + (f" · {errors / count * 100:.1f}%" if count else ""),
                 "tone": warn(errors > 0)})
    p95 = _p95(lat)
    rows.append({"id": "p95", "label": "응답 p95 (5분)", "value": f"{p95:.0f} ms" if p95 is not None else "—",
                 "sub": f"평균 {sum(lat) / len(lat):.0f} ms" if lat else None, "tone": warn((p95 or 0) > 2000)})
    rows.append({"id": "inflight", "label": "처리 중", "value": f"{inflight}건",
                 "sub": (f"스레드 {s['threads']}/40" if "threads" in s else None)
                 if oldest < 5 else f"가장 오래 {oldest:.0f}초", "tone": warn(oldest > 10)})
    return rows


def system_series() -> List[dict]:
    """15초 표본 (lines 뷰 — x = time)."""
    out = []
    for s in list(_samples):
        out.append({
            "time": datetime.fromtimestamp(s["ts"], KST).strftime("%H:%M:%S"),
            "cpu_pct": _r(s.get("cpu_pct")), "iowait_pct": _r(s.get("iowait_pct")),
            "app_cpu_pct": _r(s.get("app_cpu_pct")),
            "mem_pct": _r(s.get("mem_pct")), "swap_pct": _r(s.get("swap_pct")), "cg_pct": _r(s.get("cg_pct")),
            "mem_mb": _mb(s.get("mem_used")), "swap_mb": _mb(s.get("swap_used")),
            "cg_mb": _mb(s.get("cg_used")), "rss_mb": _mb(s.get("rss")),
            "load1": _r(s.get("load1"), 2), "load5": _r(s.get("load5"), 2),
            "swap_in_kbs": _r(s.get("swap_in_kbs")), "swap_out_kbs": _r(s.get("swap_out_kbs")),
            "inflight": s.get("inflight"), "threads": s.get("threads"),
        })
    return out


def traffic_series() -> List[dict]:
    """분 단위 요청 (lines 뷰). 요청이 없던 분도 0 으로 채운다."""
    with _lock:
        by_min = {b.minute: (b.count, b.errors, b.total_ms, _p95(b.lat)) for b in _minutes}
    if not by_min:
        return []
    end = int(time.time() // 60)
    start = max(min(by_min), end - MINUTE_KEEP + 1)
    out = []
    for m in range(start, end + 1):
        c, e, tot, p95 = by_min.get(m, (0, 0, 0.0, None))
        out.append({"time": _now_label(m * 60), "count": c, "errors": e,
                    "avg_ms": _r(tot / c, 0) if c else None, "p95_ms": _r(p95, 0)})
    return out


def endpoints() -> List[dict]:
    """경로별 누계 (table 뷰) — 쓴 시간 합이 큰 순 (서버를 가장 오래 붙잡은 경로가 위)."""
    with _lock:
        items = [(k, r.count, r.errors, r.total_ms, r.max_ms, r.last, _p95(r.lat)) for k, r in _routes.items()]
    items.sort(key=lambda x: -x[3])
    return [{
        "route": k, "count": c, "errors": e,
        "avg_ms": round(tot / c) if c else None, "p95_ms": _r(p95, 0), "max_ms": round(mx),
        "total_s": round(tot / 1000, 1), "last": _now_label(last) if last else None,
        "_tone": "down" if e else None, "_state": "오류" if e else "",
    } for k, c, e, tot, mx, last, p95 in items]


def inflight() -> List[dict]:
    """지금 처리 중인 요청 — 오래 걸린 것부터 (멈춘 요청 찾기)."""
    now = time.time()
    with _lock:
        rows = [dict(r) for r in _inflight.values()]
    rows.sort(key=lambda r: r["start"])
    return [{
        "time": datetime.fromtimestamp(r["start"], KST).strftime("%H:%M:%S"),
        "method": r["method"], "path": r["path"], "elapsed_ms": round((now - r["start"]) * 1000),
        "_state": "처리 중", "_tone": "down" if now - r["start"] > 10 else "accent",
    } for r in rows]


def slow_requests() -> List[dict]:
    """최근 느린 요청(1초 이상) · 5xx — 최신부터."""
    with _lock:
        rows = list(_slow)
    return [{
        "time": datetime.fromtimestamp(r["ts"], KST).strftime("%H:%M:%S"),
        "method": r["method"], "path": r["path"], "elapsed_ms": round(r["ms"]),
        "_state": str(r["status"]), "_tone": "down" if r["status"] >= 500 else None,
    } for r in reversed(rows)]


def reset_for_tests() -> None:
    with _lock:
        _minutes.clear()
        _routes.clear()
        _slow.clear()
        _inflight.clear()
    _samples.clear()
    _prev.clear()
