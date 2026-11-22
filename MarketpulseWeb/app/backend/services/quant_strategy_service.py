"""포트폴리오 전략 — 웹에서 만든 전략(user_quant_strategies)을 월별 패널(mbs_in_quant_panel)로 백테스트한다.

서버는 학습하지 않는다. 팩터 z-점수와 표본 밖 ML 확률은 로컬 배치(MarketpulseBatch/jobs/build_quant.py)가
계산해 적재한 값이고, 여기서는 점수를 더하고 줄 세워 상위 N종목을 사고파는 것만 계산한다.

    팩터 전략  고른 팩터 z-점수의 가중 평균 → 리밸런싱마다 상위 top_n 종목 같은 비중
    ML 전략    배치가 계산한 표본 밖 확률(stack · avg · gbt · mlp · logit) 하나로 같은 방식

결과는 백테스트 결과 위젯(bt-run-*)이 그리는 실행 모양 { name, metrics, equity, trades } 과 같다.
"""
from __future__ import annotations

import hashlib
import json
import logging
import threading
import uuid
from collections import OrderedDict
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.backend.models.orm import MBS_IN_QUANT_PANEL, UserQuantStrategy, UserQuantStrategyFactor

log = logging.getLogger(__name__)

# 팩터 — 배치(MarketpulseBatch/index_analyzer/quant/factors.py)의 FACTORS 와 같은 id · 이름 (tests 가 맞춰 본다)
FACTORS: List[Tuple[str, str, str]] = [
    ("mom_12_1", "모멘텀 12-1", "12개월 수익률 · 최근 1개월 제외"),
    ("mom_6_1", "모멘텀 6-1", "6개월 수익률 · 최근 1개월 제외"),
    ("rev_1m", "단기 반전", "최근 1개월 수익률의 반대"),
    ("lowvol", "저변동성", "60일 실현 변동성 역순"),
    ("high52", "52주 고가 근접", "현재가 ÷ 52주 최고가"),
    ("trend", "추세", "현재가 ÷ 200일 이동평균"),
]
FACTOR_IDS = [f[0] for f in FACTORS]

# ML 점수 — 패널의 p_<id> 열 (배치 panel.PROB_COLS)
MODELS: List[Tuple[str, str]] = [
    ("stack", "ML 융합 · 스태킹"),
    ("avg", "ML 융합 · 단순 평균"),
    ("gbt", "그래디언트 부스팅"),
    ("mlp", "MLP"),
    ("logit", "로지스틱 회귀"),
]
MODEL_IDS = [m[0] for m in MODELS]

BENCHMARKS = {"^GSPC": "S&P 500", "equal": "동일 비중"}
REBALANCE = {"M": "월간", "Q": "분기"}
MAX_PER_USER = 50
TOP_N_RANGE = (5, 100)
MAX_COST_BPS = 100

# 기본 제공 — 시안(design/mockups/Backtest.dc.html)의 세 전략. id 가 고정이라 다시 넣어도 같은 행이다
BUILTIN_STRATEGIES: List[dict] = [
    {"strategy_id": "builtin-ml-stack", "name": "멀티팩터 + ML 융합 (스태킹)",
     "description": "세 모델의 표본 밖 확률을 스태킹으로 합친 점수 상위 종목",
     "score_kind": "ml", "model": "stack", "top_n": 30, "rebalance": "M", "sort_seq": 1},
    {"strategy_id": "builtin-multifactor", "name": "멀티팩터 동일 비중",
     "description": "가격 팩터 6개 z-점수의 동일 비중 평균 상위 종목",
     "score_kind": "factor", "factors": {f: 1.0 for f in FACTOR_IDS}, "top_n": 30, "rebalance": "M", "sort_seq": 2},
    {"strategy_id": "builtin-momentum", "name": "모멘텀 단일",
     "description": "12-1 모멘텀 상위 종목",
     "score_kind": "factor", "factors": {"mom_12_1": 1.0}, "top_n": 30, "rebalance": "M", "sort_seq": 3},
]
DEFAULT_STRATEGY = BUILTIN_STRATEGIES[0]["strategy_id"]

NOTE = "현재 구성종목 기준(생존 편향) · 보유 종목은 매달 같은 비중 · 상장폐지 등으로 수익률이 없는 달은 0%"


class StrategyError(ValueError):
    """잘못된 전략 정의 · 계산할 수 없는 조건 (route_handler 가 400 으로 바꾼다)."""


# ══ 정의 (DB 행) ═════════════════════════════════════════════════════════════════

def seed_builtin(db: Session) -> None:
    """기본 제공 전략 중 DB 에 없는 것만 넣는다 (있는 행은 그대로 — 빼려면 use_yn=N)."""
    have = {sid for (sid,) in db.query(UserQuantStrategy.strategy_id).filter(UserQuantStrategy.user_id.is_(None))}
    added = False
    for d in BUILTIN_STRATEGIES:
        if d["strategy_id"] in have:
            continue
        row = UserQuantStrategy(
            strategy_id=d["strategy_id"], user_id=None, name=d["name"], description=d.get("description"),
            score_kind=d["score_kind"], model=d.get("model"), top_n=d["top_n"], rebalance=d["rebalance"],
            sort_seq=d["sort_seq"],
        )
        row.factors = [UserQuantStrategyFactor(factor_id=f, weight=w) for f, w in (d.get("factors") or {}).items()]
        db.add(row)
        added = True
    if added:
        db.commit()


def to_dict(s: UserQuantStrategy, user_id: Optional[str] = None) -> dict:
    return {
        "strategy_id": s.strategy_id,
        "name": s.name,
        "description": s.description,
        "universe": s.universe,
        "score_kind": s.score_kind,
        "model": s.model,
        "factors": [{"factor_id": f.factor_id, "weight": f.weight} for f in s.factors],
        "top_n": s.top_n,
        "rebalance": s.rebalance,
        "builtin": s.user_id is None,
        "editable": s.user_id is not None and s.user_id == user_id,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


def list_strategies(db: Session, user_id: str) -> List[UserQuantStrategy]:
    """기본 제공(순서대로) → 내 전략(최근 고친 것부터)."""
    seed_builtin(db)
    rows = (
        db.query(UserQuantStrategy)
        .filter(UserQuantStrategy.use_yn == "Y")
        .filter((UserQuantStrategy.user_id.is_(None)) | (UserQuantStrategy.user_id == user_id))
        .all()
    )
    builtin = sorted([r for r in rows if r.user_id is None], key=lambda r: r.sort_seq)
    mine = sorted([r for r in rows if r.user_id is not None], key=lambda r: r.updated_at or r.created_at, reverse=True)
    return builtin + mine


def get_strategy(db: Session, strategy_id: Optional[str], user_id: str) -> UserQuantStrategy:
    """내가 볼 수 있는 전략 하나 (기본 제공 또는 내 것). 비우면 첫 기본 제공."""
    seed_builtin(db)
    sid = strategy_id or DEFAULT_STRATEGY
    row = db.query(UserQuantStrategy).filter(UserQuantStrategy.strategy_id == sid).first()
    if not row or row.use_yn != "Y" or (row.user_id is not None and row.user_id != user_id):
        raise LookupError(f"전략을 찾을 수 없어요: {sid}")
    return row


def _validate(body: dict) -> dict:
    name = str(body.get("name") or "").strip()
    if not name or len(name) > 100:
        raise StrategyError("전략 이름은 1~100자로 적어 주세요")
    kind = body.get("score_kind")
    if kind not in ("factor", "ml"):
        raise StrategyError("점수 종류는 factor 또는 ml 이어야 해요")
    try:
        top_n = int(body.get("top_n") or 30)
    except (TypeError, ValueError):
        raise StrategyError("보유 종목 수는 숫자여야 해요")
    if not TOP_N_RANGE[0] <= top_n <= TOP_N_RANGE[1]:
        raise StrategyError(f"보유 종목 수는 {TOP_N_RANGE[0]}~{TOP_N_RANGE[1]} 사이여야 해요")
    rebalance = body.get("rebalance") or "M"
    if rebalance not in REBALANCE:
        raise StrategyError("리밸런싱은 M(월간) 또는 Q(분기)예요")

    factors: Dict[str, float] = {}
    model = None
    if kind == "factor":
        for f in body.get("factors") or []:
            fid = f.get("factor_id")
            if fid not in FACTOR_IDS:
                raise StrategyError(f"모르는 팩터예요: {fid}")
            try:
                w = float(f.get("weight", 1))
            except (TypeError, ValueError):
                raise StrategyError(f"{fid} 가중치는 숫자여야 해요")
            if w < 0 or w > 10:
                raise StrategyError("가중치는 0~10 사이여야 해요")
            if w > 0:
                factors[fid] = w
        if not factors:
            raise StrategyError("팩터를 하나 이상 골라 주세요")
    else:
        model = body.get("model") or "stack"
        if model not in MODEL_IDS:
            raise StrategyError(f"모르는 모델이에요: {model}")

    desc = (str(body.get("description") or "").strip() or None)
    if desc and len(desc) > 300:
        raise StrategyError("설명은 300자 이하로 적어 주세요")
    return {"name": name, "description": desc, "score_kind": kind, "model": model,
            "top_n": top_n, "rebalance": rebalance, "factors": factors}


def _apply(row: UserQuantStrategy, v: dict) -> None:
    row.name, row.description = v["name"], v["description"]
    row.score_kind, row.model = v["score_kind"], v["model"]
    row.top_n, row.rebalance = v["top_n"], v["rebalance"]
    row.factors = [UserQuantStrategyFactor(factor_id=f, weight=w) for f, w in v["factors"].items()]


def create_strategy(db: Session, user_id: str, body: dict) -> UserQuantStrategy:
    v = _validate(body)
    count = db.query(func.count(UserQuantStrategy.strategy_id)).filter(UserQuantStrategy.user_id == user_id).scalar()
    if count >= MAX_PER_USER:
        raise StrategyError(f"전략은 {MAX_PER_USER}개까지 만들 수 있어요 — 안 쓰는 전략을 지워 주세요")
    row = UserQuantStrategy(strategy_id=str(uuid.uuid4()), user_id=user_id)
    _apply(row, v)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _own(db: Session, strategy_id: str, user_id: str) -> UserQuantStrategy:
    row = db.query(UserQuantStrategy).filter(UserQuantStrategy.strategy_id == strategy_id).first()
    if not row:
        raise LookupError("전략을 찾을 수 없어요")
    if row.user_id is None:
        raise PermissionError("기본 제공 전략은 고칠 수 없어요 — 복제해서 고쳐 주세요")
    if row.user_id != user_id:
        raise LookupError("전략을 찾을 수 없어요")
    return row


def update_strategy(db: Session, user_id: str, strategy_id: str, body: dict) -> UserQuantStrategy:
    row = _own(db, strategy_id, user_id)
    _apply(row, _validate(body))
    db.commit()
    db.refresh(row)
    return row


def delete_strategy(db: Session, user_id: str, strategy_id: str) -> None:
    row = _own(db, strategy_id, user_id)
    db.delete(row)
    db.commit()


# ══ 패널 (배치가 적재한 재료) ════════════════════════════════════════════════════

_PANEL_CACHE: Dict[str, Tuple[tuple, dict]] = {}

# 운영 서버는 메모리가 아주 작다(컨테이너 300MB). 백테스트 화면은 요청 7개를 한꺼번에 보내는데,
# 캐시가 비어 있을 때 스레드마다 패널을 따로 읽으면 그만큼 메모리를 동시에 써서 서버가 스왑에 빠진다
# (2026-11-22 장애). 패널 읽기와 백테스트 계산은 한 번에 하나만 하고, 기다린 요청은 캐시를 쓴다.
_PANEL_LOCK = threading.Lock()
_BACKTEST_LOCK = threading.Lock()


def _panel_version(db: Session, universe: str) -> tuple:
    q = db.query(func.count(MBS_IN_QUANT_PANEL.id), func.max(MBS_IN_QUANT_PANEL.updated_at),
                 func.max(MBS_IN_QUANT_PANEL.base_ymd)).filter(MBS_IN_QUANT_PANEL.universe == universe)
    return tuple(q.one())


def load_panel(db: Session, universe: str) -> Optional[dict]:
    """{ fwd, close, <팩터>, p_<모델>: DataFrame(월말 × 종목), bench: { 코드: Series(fwd) }, version }.
    적재된 행이 없으면 None. 적재가 바뀌기 전까지는 메모리에 둔다."""
    version = _panel_version(db, universe)
    if not version[0]:
        return None
    hit = _PANEL_CACHE.get(universe)
    if hit and hit[0] == version:
        return hit[1]
    with _PANEL_LOCK:
        hit = _PANEL_CACHE.get(universe)   # 기다리는 동안 다른 요청이 읽어 두었으면 그걸 쓴다
        if hit and hit[0] == version:
            return hit[1]
        _PANEL_CACHE.pop(universe, None)  # 옛 패널은 새로 읽기 전에 놓아 둘이 함께 메모리에 있지 않게
        panel = _read_panel(db, universe, version)
        _PANEL_CACHE[universe] = (version, panel)
        return panel


def _read_panel(db: Session, universe: str, version: tuple) -> dict:
    """패널 행을 (월말 × 종목) 행렬로 바로 채운다.

    행 객체 6만 개 → DataFrame → 피벗 순서로 읽으면 사본이 여러 번 생겨 순간 메모리가 90MB 가량 늘었다
    (운영 서버는 평소 여유가 85MB 안팎 — 백테스트 화면을 열면 스왑에 빠져 멈췄다, 2026-11-23).
    날짜 · 종목 목록을 먼저 읽고, 값은 조금씩 받아 미리 만든 numpy 행렬에 넣는다.
    """
    cols = ["close", "fwd_ret", *FACTOR_IDS, *[f"p_{m}" for m in MODEL_IDS]]
    conn = db.connection()
    where = "FROM mbs_in_quant_panel WHERE universe = :u"
    stock_dates = [r[0] for r in conn.execute(
        text(f"SELECT DISTINCT base_ymd {where} AND stk_cd NOT LIKE '^%' ORDER BY base_ymd"), {"u": universe})]
    syms = [r[0] for r in conn.execute(
        text(f"SELECT DISTINCT stk_cd {where} AND stk_cd NOT LIKE '^%' ORDER BY stk_cd"), {"u": universe})]
    di = {str(d)[:10]: i for i, d in enumerate(stock_dates)}
    si = {s: j for j, s in enumerate(syms)}
    mats = {c: np.full((len(di), len(si)), np.nan) for c in cols}
    bench_rows: Dict[str, List[tuple]] = {}
    res = conn.execute(text(f"SELECT base_ymd, stk_cd, {', '.join(cols)} {where}"), {"u": universe})
    while True:
        chunk = res.fetchmany(5000)
        if not chunk:
            break
        for row in chunk:
            day, sym = str(row[0])[:10], row[1]
            if sym.startswith("^"):
                bench_rows.setdefault(sym, []).append((day, row[2], row[3]))   # close · fwd_ret
                continue
            i, j = di[day], si[sym]
            for k, c in enumerate(cols):
                v = row[2 + k]
                if v is not None:
                    mats[c][i, j] = v
        del chunk
    index = pd.DatetimeIndex(pd.to_datetime(list(di)), name="base_ymd")
    columns = pd.Index(syms, name="stk_cd")
    panel = {c: pd.DataFrame(m, index=index, columns=columns) for c, m in mats.items()}

    def series(rows: List[tuple], k: int) -> pd.Series:
        rows = sorted(rows)
        return pd.Series([np.nan if r[k] is None else float(r[k]) for r in rows],
                         index=pd.DatetimeIndex(pd.to_datetime([r[0] for r in rows]), name="base_ymd"), dtype=float)

    panel["bench"] = {code: series(rows, 2) for code, rows in bench_rows.items()}
    panel["bench_close"] = {code: series(rows, 1) for code, rows in bench_rows.items()}
    panel["version"] = version
    return panel


def panel_status(panel: Optional[dict]) -> dict:
    if not panel:
        return {"loaded": False}
    fwd = panel["fwd_ret"]
    have = fwd.index[fwd.notna().any(axis=1)]
    ml = panel["p_stack"]
    ml_have = ml.index[ml.notna().any(axis=1)]
    return {
        "loaded": True,
        "start": have[0].date().isoformat() if len(have) else None,
        "end": have[-1].date().isoformat() if len(have) else None,
        "months": int(len(have)),
        "members": int(fwd.shape[1]),
        "ml_start": ml_have[0].date().isoformat() if len(ml_have) else None,
        "benchmarks": sorted(panel["bench"]),
        "as_of": panel["version"][2].isoformat() if panel["version"][2] else None,
    }


# ══ 백테스트 ════════════════════════════════════════════════════════════════════

_RESULT_CACHE: "OrderedDict[str, dict]" = OrderedDict()
_RESULT_CACHE_SIZE = 16   # 결과 하나가 ~1MB — 운영 메모리가 작다


def _score(strategy: dict, panel: dict) -> pd.DataFrame:
    if strategy["score_kind"] == "ml":
        score = panel[f"p_{strategy['model']}"]
        if not score.notna().any().any():
            raise StrategyError("ML 점수가 아직 적재되지 않았어요 — 로컬에서 build_quant.py 를 실행해 주세요")
        return score
    weights = {f["factor_id"]: float(f["weight"]) for f in strategy["factors"] if float(f["weight"]) > 0}
    if not weights:
        raise StrategyError("팩터를 하나 이상 골라 주세요")
    num = sum(panel[f].fillna(0) * w for f, w in weights.items())
    have = sum(panel[f].notna() * w for f, w in weights.items())
    total = sum(weights.values())
    # 가중치의 절반 이상에 해당하는 팩터 값이 있는 종목만 점수를 준다
    return (num / have.replace(0, np.nan)).where(have >= total / 2)


def _stats(monthly: pd.Series) -> dict:
    r = monthly.dropna()
    n = len(r)
    if not n:
        return {}
    eq = (1 + r).cumprod()
    peak = eq.cummax()
    years = n / 12
    sd = r.std(ddof=1) if n > 1 else 0.0
    down = r[r < 0]
    dsd = float(np.sqrt((down ** 2).mean())) if len(down) else 0.0
    total = float(eq.iloc[-1] - 1)
    return {
        "totalReturn": total * 100,
        "cagr": (float(eq.iloc[-1]) ** (1 / years) - 1) * 100 if years > 0 and eq.iloc[-1] > 0 else None,
        "volatility": float(sd * np.sqrt(12) * 100) if n > 1 else None,
        "sharpe": float(r.mean() / sd * np.sqrt(12)) if sd > 0 else None,
        "sortino": float(r.mean() / dsd * np.sqrt(12)) if dsd > 0 else None,
        "maxDrawdown": float((eq / peak - 1).min() * 100),
    }


def _month_after(d: pd.Timestamp) -> pd.Timestamp:
    return (d + pd.offsets.BMonthEnd(1)).normalize()


def _clean(v):
    if isinstance(v, (float, np.floating)):
        return None if not np.isfinite(v) else round(float(v), 6)
    if isinstance(v, dict):
        return {k: _clean(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_clean(x) for x in v]
    return v


def run_backtest(strategy: dict, panel: dict, start: Optional[date] = None, end: Optional[date] = None,
                 benchmark: str = "^GSPC", cost_bps: float = 10.0) -> dict:
    """strategy: to_dict 모양. 결과 = { name, strategy_id, config, metrics, equity, trades, holdings }."""
    if benchmark not in BENCHMARKS:
        raise StrategyError(f"모르는 벤치마크예요: {benchmark}")
    if not 0 <= cost_bps <= MAX_COST_BPS:
        raise StrategyError(f"거래비용은 0~{MAX_COST_BPS}bp 사이여야 해요")

    score = _score(strategy, panel)
    fwd, close = panel["fwd_ret"], panel["close"]
    months = fwd.index[fwd.notna().any(axis=1) & score.notna().any(axis=1)]
    if start:
        months = months[months >= pd.Timestamp(start)]
    if end:
        months = months[months <= pd.Timestamp(end)]
    if len(months) < 2:
        raise StrategyError("이 기간에는 계산할 달이 모자라요 — 기간을 넓혀 주세요"
                            + (" (ML 점수는 표본 밖 구간에만 있어요)" if strategy["score_kind"] == "ml" else ""))

    top_n = int(strategy["top_n"])
    quarterly = strategy["rebalance"] == "Q"
    cost = cost_bps / 1e4

    if benchmark == "equal":
        bench_fwd = fwd.mean(axis=1)
    else:
        b = panel["bench"].get(benchmark)
        if b is None:
            raise StrategyError(f"{BENCHMARKS[benchmark]} 지수가 아직 적재되지 않았어요 — 벤치마크를 '동일 비중'으로 바꿔 주세요")
        # 월말 거래일이 하루 다를 수 있어 달 단위로 맞춘다
        bench_fwd = pd.Series(b.values, index=b.index.to_period("M")).reindex(months.to_period("M"))
        bench_fwd.index = months

    held: List[str] = []
    rets, costs, turnovers = [], [], []
    spells: Dict[str, dict] = {}   # 지금 들고 있는 종목의 거래
    trades: List[dict] = []
    for i, d in enumerate(months):
        rebalance = i == 0 or not quarterly or d.month in (3, 6, 9, 12)
        if rebalance:
            s = score.loc[d].dropna()
            s = s[close.loc[d].reindex(s.index).notna()]
            new = list(s.sort_values(ascending=False).index[:top_n])
            if new:
                old, new_set = set(held), set(new)
                # 같은 비중 → 바뀐 몫: 처음은 전부 산다(1), 그 뒤는 판 몫 + 산 몫
                turnover = 1.0 if not held else (len(old - new_set) / len(old) + len(new_set - old) / len(new_set))
                for sym in old - new_set:
                    t = spells.pop(sym)
                    trades.append({**t, "exitDate": d.date().isoformat(), "exitPrice": _clean(close.at[d, sym]),
                                   "returnPct": (t.pop("_growth") - 1) * 100, "open": False})
                for sym in new_set - old:
                    spells[sym] = {"symbol": sym, "entryDate": d.date().isoformat(),
                                   "entryPrice": _clean(close.at[d, sym]), "bars": 0, "_growth": 1.0}
                held = new
            else:
                turnover = 0.0
        else:
            turnover = 0.0
        r_each = fwd.loc[d].reindex(held).fillna(0.0)
        for sym, r in r_each.items():
            spells[sym]["_growth"] *= 1 + float(r)
            spells[sym]["bars"] += 1
        rets.append(float(r_each.mean()) if len(held) else 0.0)
        costs.append(turnover * cost)
        turnovers.append(turnover)

    net = pd.Series(rets, index=months) - pd.Series(costs, index=months)
    bench_r = bench_fwd.reindex(months)
    dates = [_month_after(d) if i == len(months) - 1 else months[i + 1] for i, d in enumerate(months)]
    eq_s = (1 + net).cumprod()
    eq_b = (1 + bench_r.fillna(0)).cumprod()
    equity = [{"date": months[0].date().isoformat(), "strategy": 1.0, "benchmark": 1.0}] + [
        {"date": dt.date().isoformat(), "strategy": float(s), "benchmark": float(b)}
        for dt, s, b in zip(dates, eq_s.values, eq_b.values)
    ]
    last = dates[-1].date().isoformat()
    # 아직 들고 있는 종목의 '현재가' = 마지막 수익률이 끝나는 달의 종가 (패널에 그 달 행이 있으면)
    by_month = close.index.to_period("M")
    end_rows = close.index[by_month == dates[-1].to_period("M")]
    last_close = close.loc[end_rows[-1]] if len(end_rows) else close.loc[months[-1]]
    for sym, t in spells.items():
        trades.append({**{k: v for k, v in t.items() if k != "_growth"}, "exitDate": last,
                       "exitPrice": _clean(last_close.get(sym)), "returnPct": (t["_growth"] - 1) * 100, "open": True})
    trades.sort(key=lambda t: (t["entryDate"], t["symbol"]))

    done = [t for t in trades if not t["open"]] or trades
    wins = [t for t in done if t["returnPct"] > 0]
    metrics = {
        **_stats(net),
        "start": months[0].date().isoformat(), "end": last,
        "months": int(len(months)),
        "trades": len(trades),
        "winRate": len(wins) / len(done) * 100 if done else None,
        "avgTrade": float(np.mean([t["returnPct"] for t in done])) if done else None,
        "exposure": 100.0,
        "turnover": float(np.mean(turnovers[1:]) * 100) if len(turnovers) > 1 else None,
        "costTotal": float(sum(costs) * 100),
        "benchmark": {**_stats(bench_r), "name": BENCHMARKS[benchmark]},
    }
    holdings = [{"symbol": s, "entryDate": t["entryDate"], "returnPct": (t["_growth"] - 1) * 100}
                for s, t in sorted(spells.items())]
    return _clean({
        "strategy_id": strategy["strategy_id"],
        "name": strategy["name"],
        "config": {
            "score_kind": strategy["score_kind"], "model": strategy.get("model"),
            "factors": strategy["factors"], "top_n": top_n, "rebalance": strategy["rebalance"],
            "benchmark": benchmark, "cost_bps": cost_bps,
        },
        "metrics": metrics,
        "equity": equity,
        "trades": trades,
        "holdings": holdings,
        "note": NOTE,
    })


def backtest(db: Session, user_id: str, strategy_id: Optional[str], start: Optional[date], end: Optional[date],
             benchmark: str, cost_bps: float) -> Tuple[Optional[dict], dict]:
    """(실행 결과 또는 None — 패널이 아직 없을 때, 패널 상태)."""
    s = to_dict(get_strategy(db, strategy_id, user_id), user_id)
    panel = load_panel(db, s["universe"])
    status = panel_status(panel)
    if not panel:
        return None, status
    key_src = json.dumps([s, panel["version"], str(start), str(end), benchmark, cost_bps], sort_keys=True, default=str)
    key = hashlib.sha1(key_src.encode()).hexdigest()
    hit = _RESULT_CACHE.get(key)
    if hit is not None:
        return hit, status
    with _BACKTEST_LOCK:
        if key in _RESULT_CACHE:          # 같은 조건을 먼저 들어온 요청이 계산해 두었다
            _RESULT_CACHE.move_to_end(key)
            return _RESULT_CACHE[key], status
        result = run_backtest(s, panel, start, end, benchmark, cost_bps)
        _RESULT_CACHE[key] = result
        while len(_RESULT_CACHE) > _RESULT_CACHE_SIZE:
            _RESULT_CACHE.popitem(last=False)
    return result, status



COMPARE_MAX = 20   # 한 번에 비교하는 전략 수 (기본 제공 + 최근 고친 내 전략부터)


def compare(db: Session, user_id: str, start: Optional[date], end: Optional[date],
            benchmark: str, cost_bps: float) -> Tuple[List[dict], dict]:
    """같은 조건으로 전략마다 실행한 손익 — 전략별 손익 위젯이 고른 것만 그린다.

    전략마다 metrics · 월말 자산(equity)만 돌려준다 (거래 내역은 빼서 가볍게).
    고른 기간에 값이 없는 전략(예: ML 전략에 표본 밖 구간 이전 기간)은 빼고 note 에 적는다.
    """
    rows = list_strategies(db, user_id)[:COMPARE_MAX]
    status = panel_status(load_panel(db, "sp500"))
    if not status.get("loaded"):
        return [], status
    out, skipped = [], []
    for r in rows:
        try:
            res, _ = backtest(db, user_id, r.strategy_id, start, end, benchmark, cost_bps)
        except StrategyError:
            skipped.append(r.name)
            continue
        if not res:
            continue
        out.append({
            "strategy_id": res["strategy_id"], "name": res["name"],
            "builtin": r.user_id is None, "score_kind": r.score_kind,
            "metrics": res["metrics"], "equity": res["equity"],
        })
    if skipped:
        status = {**status, "skipped": skipped}
    return out, status

def catalog() -> dict:
    """편집 화면이 쓸 선택지."""
    return {
        "factors": [{"id": i, "name": n, "desc": d} for i, n, d in FACTORS],
        "models": [{"id": i, "name": n} for i, n in MODELS],
        "benchmarks": [{"id": k, "name": v} for k, v in BENCHMARKS.items()],
        "rebalance": [{"id": k, "name": v} for k, v in REBALANCE.items()],
        "top_n": list(TOP_N_RANGE),
        "max_cost_bps": MAX_COST_BPS,
    }
