"""퀀트 포트폴리오 — 유니버스 안에서 직접 고른 종목 · 비중 · 리밸런싱 (전략과 무관).

전략(quant_strategy_service)은 '종목 점수 규칙' 이고, 포트폴리오는 '무엇을 얼마나 담을지' 를 사용자가 정한다.
계산 재료는 전략과 같은 월별 패널(mbs_in_quant_panel — 배치가 적재)이고, 서버는 학습 없이
목표 비중으로 사서 리밸런싱 주기마다 되돌리는 것만 계산한다. 결과는 백테스트 결과 위젯(bt-run-*)이 그리는
실행 모양과 같아서 /api/strategies/result?strategy=pf:<id> 로 그대로 보인다.

    비중 방식  equal 동일 · manual 직접 입력(%) · mcap 시가총액(종목 프로필의 지금 값) · invvol 역변동성(최근 12개월)
    현금       manual 이 아니면 cash_pct, manual 이면 100 - 입력 합계 — 수익률 0
"""
from __future__ import annotations

import hashlib
import json
from datetime import date
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.backend.models.orm import MBS_IN_STK_PROFILE, UserQuantPortfolio, UserQuantPortfolioItem
from app.backend.services import quant_strategy_service as qs

PREFIX = "pf:"                       # /api/strategies/result?strategy=pf:<id>
WEIGHTING = {"equal": "동일 비중", "manual": "직접 입력", "mcap": "시가총액", "invvol": "역변동성"}
REBALANCE = {"N": "안 함", "M": "월간", "Q": "분기", "Y": "연 1회"}
COSTS = [5, 10, 25]
UNIVERSES = {"sp500": "S&P 500"}     # 배치(build_quant.py)가 패널을 적재하는 유니버스
MAX_PER_USER = 30
MAX_ITEMS = 200
MAX_CASH = 50
VOL_MONTHS = 12
NOTE = "고른 종목 · 목표 비중 그대로 · 리밸런싱 사이에는 가격에 따라 비중이 움직여요 · 수익률이 없는 달은 0%"

_RESULT_CACHE = qs.PackedCache(8)   # 압축 JSON — quant_strategy_service.PackedCache


class PortfolioError(qs.StrategyError):
    """잘못된 포트폴리오 정의 (route_handler 가 400 으로 바꾼다)."""


# ══ 정의 (DB 행) ═════════════════════════════════════════════════════════════════

def to_dict(p: UserQuantPortfolio) -> dict:
    return {
        "portfolio_id": p.portfolio_id,
        "strategy_id": PREFIX + p.portfolio_id,
        "name": p.name,
        "universe": p.universe,
        "weighting": p.weighting,
        "cash_pct": p.cash_pct,
        "rebalance": p.rebalance,
        "cost_bps": p.cost_bps,
        "items": [{"symbol": i.stk_cd, "weight": i.weight} for i in p.items],
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def list_portfolios(db: Session, user_id: str) -> List[UserQuantPortfolio]:
    return (db.query(UserQuantPortfolio).filter(UserQuantPortfolio.user_id == user_id)
            .order_by(UserQuantPortfolio.created_at, UserQuantPortfolio.name).all())


def _own(db: Session, user_id: str, portfolio_id: str) -> UserQuantPortfolio:
    row = db.query(UserQuantPortfolio).filter(UserQuantPortfolio.portfolio_id == portfolio_id).first()
    if not row or row.user_id != user_id:
        raise LookupError(f"포트폴리오를 찾을 수 없어요: {portfolio_id}")
    return row


def _validate(body: dict) -> dict:
    name = (body.get("name") or "").strip()
    if not name:
        raise PortfolioError("이름을 넣어 주세요")
    universe = body.get("universe") or "sp500"
    if universe not in UNIVERSES:
        raise PortfolioError(f"모르는 유니버스예요: {universe}")
    weighting = body.get("weighting") or "equal"
    if weighting not in WEIGHTING:
        raise PortfolioError(f"모르는 비중 방식이에요: {weighting}")
    rebalance = body.get("rebalance") or "Q"
    if rebalance not in REBALANCE:
        raise PortfolioError(f"모르는 리밸런싱 주기예요: {rebalance}")
    cost = float(body.get("cost_bps") if body.get("cost_bps") is not None else 10)
    if not 0 <= cost <= qs.MAX_COST_BPS:
        raise PortfolioError(f"거래비용은 0~{qs.MAX_COST_BPS}bp 사이여야 해요")
    cash = float(body.get("cash_pct") or 0)
    if not 0 <= cash <= MAX_CASH:
        raise PortfolioError(f"현금 비중은 0~{MAX_CASH}% 사이여야 해요")
    items, seen = [], set()
    for it in body.get("items") or []:
        sym = str(it.get("symbol") or "").strip().upper()
        if not sym or sym in seen:
            continue
        seen.add(sym)
        w = it.get("weight")
        w = None if w is None else float(w)
        if w is not None and not 0 <= w <= 100:
            raise PortfolioError(f"{sym} 비중은 0~100% 사이여야 해요")
        items.append((sym, w))
    if len(items) > MAX_ITEMS:
        raise PortfolioError(f"종목은 {MAX_ITEMS}개까지 담을 수 있어요")
    if weighting == "manual" and sum(w or 0 for _, w in items) > 100.05:
        raise PortfolioError("비중 합계가 100%를 넘어요")
    return {"name": name[:100], "universe": universe, "weighting": weighting, "rebalance": rebalance,
            "cost_bps": cost, "cash_pct": cash, "items": items}


def _apply(row: UserQuantPortfolio, v: dict) -> None:
    for k in ("name", "universe", "weighting", "rebalance", "cost_bps", "cash_pct"):
        setattr(row, k, v[k])
    row.items = [UserQuantPortfolioItem(stk_cd=s, seq=i, weight=w) for i, (s, w) in enumerate(v["items"])]


def create_portfolio(db: Session, user_id: str, body: dict) -> UserQuantPortfolio:
    v = _validate(body)
    if db.query(UserQuantPortfolio).filter(UserQuantPortfolio.user_id == user_id).count() >= MAX_PER_USER:
        raise PortfolioError(f"포트폴리오는 {MAX_PER_USER}개까지 만들 수 있어요")
    row = UserQuantPortfolio(user_id=user_id)
    _apply(row, v)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_portfolio(db: Session, user_id: str, portfolio_id: str, body: dict) -> UserQuantPortfolio:
    row = _own(db, user_id, portfolio_id)
    v = _validate(body)
    row.items = []          # 자식 행을 먼저 지워야 같은 (portfolio, 종목) 키를 다시 넣을 수 있다
    db.flush()
    _apply(row, v)
    db.commit()
    db.refresh(row)
    return row


def delete_portfolio(db: Session, user_id: str, portfolio_id: str) -> None:
    db.delete(_own(db, user_id, portfolio_id))
    db.commit()


# ══ 유니버스 종목 (고르기 목록 · 비중 계산 재료) ═══════════════════════════════════════

def _vol(close: pd.DataFrame) -> pd.Series:
    """최근 VOL_MONTHS 개월 월 수익률의 연환산 변동성 — 종목별."""
    r = close.iloc[-(VOL_MONTHS + 1):].pct_change(fill_method=None).iloc[1:]
    return r.std(ddof=1) * np.sqrt(12)


def universe_members(db: Session, universe: str) -> Tuple[List[dict], dict]:
    """패널 마지막 달에 종가가 있는 종목 — { symbol, name, sector, mcap(억 달러 아님: 원 값), vol }."""
    if universe not in UNIVERSES:
        raise PortfolioError(f"모르는 유니버스예요: {universe}")
    panel = qs.load_panel(db, universe)
    if not panel:
        return [], {"loaded": False, "universes": [{"id": k, "name": v} for k, v in UNIVERSES.items()]}
    close = panel["close"]
    have = close.index[close.notna().any(axis=1)]
    last = close.loc[have[-1]]
    syms = list(last.dropna().index)
    vol = _vol(close)
    prof = {r.stk_cd: r for r in db.query(MBS_IN_STK_PROFILE.stk_cd, MBS_IN_STK_PROFILE.stk_nm,
                                           MBS_IN_STK_PROFILE.sector, MBS_IN_STK_PROFILE.market_cap)
            .filter(MBS_IN_STK_PROFILE.stk_cd.in_(syms)).all()}
    rows = []
    for s in syms:
        p = prof.get(s)
        rows.append({
            "symbol": s,
            "name": getattr(p, "stk_nm", None) or s,
            "sector": qs.sector_name(getattr(p, "sector", None)),
            "mcap": float(p.market_cap) if p is not None and p.market_cap is not None else None,
            "vol": float(vol.get(s)) if pd.notna(vol.get(s)) else None,
        })
    rows.sort(key=lambda r: (-(r["mcap"] or 0), r["symbol"]))
    return qs._clean(rows), {
        "loaded": True, "as_of": have[-1].date().isoformat(), "members": len(rows),
        "universes": [{"id": k, "name": v} for k, v in UNIVERSES.items()],
    }


def target_weights(p: dict, members: Dict[str, dict]) -> Dict[str, float]:
    """목표 비중 (0~1, 합 = 1 - 현금). 유니버스에 없는 종목은 뺀다. 화면(PortfolioSettings)과 같은 규칙."""
    picks = [it for it in p["items"] if it["symbol"] in members]
    if not picks:
        return {}
    if p["weighting"] == "manual":
        return {it["symbol"]: max(0.0, float(it["weight"] or 0)) / 100 for it in picks}
    cash = min(MAX_CASH, max(0.0, float(p["cash_pct"] or 0))) / 100

    def raw(sym):
        m = members[sym]
        if p["weighting"] == "mcap":
            return m.get("mcap") or 0.0
        if p["weighting"] == "invvol":
            return 1 / m["vol"] if m.get("vol") else 0.0
        return 1.0

    vals = {it["symbol"]: raw(it["symbol"]) for it in picks}
    total = sum(vals.values())
    if total <= 0:   # 시가총액 · 변동성을 모르면 동일 비중으로
        vals = {k: 1.0 for k in vals}
        total = float(len(vals))
    return {k: v / total * (1 - cash) for k, v in vals.items()}


# ══ 백테스트 ════════════════════════════════════════════════════════════════════

def _is_rebalance(code: str, i: int, d: pd.Timestamp) -> bool:
    if i == 0:
        return True
    return {"M": True, "Q": d.month in (3, 6, 9, 12), "Y": d.month == 12}.get(code, False)


def run_backtest(p: dict, panel: dict, target: Dict[str, float], start: Optional[date] = None,
                 end: Optional[date] = None, benchmark: str = "^GSPC", cost_bps: Optional[float] = None) -> dict:
    if benchmark not in qs.BENCHMARKS:
        raise PortfolioError(f"모르는 벤치마크예요: {benchmark}")
    if not target:
        raise PortfolioError("담은 종목이 없어요 — 포트폴리오 설정에서 종목을 골라 주세요")
    cost = (p["cost_bps"] if cost_bps is None else cost_bps) / 1e4
    fwd, close = panel["fwd_ret"], panel["close"]
    syms = list(target)
    months = fwd.index[fwd[syms].notna().any(axis=1)]
    if start:
        months = months[months >= pd.Timestamp(start)]
    if end:
        months = months[months <= pd.Timestamp(end)]
    if len(months) < 2:
        raise PortfolioError("이 기간에는 계산할 달이 모자라요 — 기간을 넓혀 주세요")

    if benchmark == "equal":
        bench_fwd = fwd.mean(axis=1)
    else:
        b = panel["bench"].get(benchmark)
        if b is None:
            raise PortfolioError(f"{qs.BENCHMARKS[benchmark]} 지수가 아직 적재되지 않았어요 — 벤치마크를 '동일 비중'으로 바꿔 주세요")
        bench_fwd = pd.Series(b.values, index=b.index.to_period("M")).reindex(months.to_period("M"))
        bench_fwd.index = months

    tgt = pd.Series(target, dtype=float)
    w = pd.Series(0.0, index=tgt.index)       # 지금 비중 (주식만, 나머지는 현금)
    growth = pd.Series(1.0, index=tgt.index)
    rets, costs, turnovers = [], [], []
    for i, d in enumerate(months):
        if _is_rebalance(p["rebalance"], i, d):
            turnover = float((tgt - w).abs().sum())
            w = tgt.copy()
        else:
            turnover = 0.0
        r = fwd.loc[d].reindex(tgt.index).fillna(0.0)
        port = float((w * r).sum())
        rets.append(port)
        costs.append(turnover * cost)
        turnovers.append(turnover)
        growth *= 1 + r
        total = 1 + port
        w = (w * (1 + r)) / total if total > 0 else w   # 가격이 움직인 만큼 비중이 바뀐다 (현금 포함 합 1)

    net = pd.Series(rets, index=months) - pd.Series(costs, index=months)
    bench_r = bench_fwd.reindex(months)
    dates = [qs._month_after(d) if i == len(months) - 1 else months[i + 1] for i, d in enumerate(months)]
    eq_s = (1 + net).cumprod()
    eq_b = (1 + bench_r.fillna(0)).cumprod()
    equity = [{"date": months[0].date().isoformat(), "strategy": 1.0, "benchmark": 1.0}] + [
        {"date": dt.date().isoformat(), "strategy": float(s), "benchmark": float(b)}
        for dt, s, b in zip(dates, eq_s.values, eq_b.values)
    ]
    first, last = months[0].date().isoformat(), dates[-1].date().isoformat()
    by_month = close.index.to_period("M")
    end_rows = close.index[by_month == dates[-1].to_period("M")]
    last_close = close.loc[end_rows[-1]] if len(end_rows) else close.loc[months[-1]]
    trades = [{
        "symbol": s, "entryDate": first, "entryPrice": qs._clean(close.at[months[0], s]),
        "exitDate": last, "exitPrice": qs._clean(last_close.get(s)), "bars": int(len(months)),
        "returnPct": (float(growth[s]) - 1) * 100, "open": True,
    } for s in syms]
    wins = [t for t in trades if t["returnPct"] > 0]
    metrics = {
        **qs._stats(net),
        "start": first, "end": last, "months": int(len(months)), "trades": len(trades),
        "winRate": len(wins) / len(trades) * 100 if trades else None,
        "avgTrade": float(np.mean([t["returnPct"] for t in trades])) if trades else None,
        "exposure": float(tgt.sum() * 100),
        "turnover": float(np.mean(turnovers[1:]) * 100) if len(turnovers) > 1 else None,
        "costTotal": float(sum(costs) * 100),
        "benchmark": {**qs._stats(bench_r), "name": qs.BENCHMARKS[benchmark]},
    }
    holdings = [{"symbol": s, "entryDate": first, "returnPct": (float(growth[s]) - 1) * 100,
                 "weight": float(w.get(s, 0) * 100)} for s in syms]
    return qs._clean({
        "strategy_id": PREFIX + p["portfolio_id"],
        "name": p["name"],
        "config": {
            "kind": "portfolio", "weighting": p["weighting"], "rebalance": p["rebalance"],
            "cash_pct": p["cash_pct"], "items": len(syms), "benchmark": benchmark,
            "cost_bps": cost * 1e4,
        },
        "metrics": metrics, "equity": equity, "trades": trades, "holdings": holdings, "note": NOTE,
    })


def backtest(db: Session, user_id: str, strategy_id: str, start: Optional[date], end: Optional[date],
             benchmark: str, cost_bps: Optional[float]) -> Tuple[Optional[dict], dict]:
    """strategy_id = 'pf:<id>'. (실행 결과 또는 None — 패널이 아직 없을 때, 패널 상태)."""
    p = to_dict(_own(db, user_id, strategy_id[len(PREFIX):]))
    panel = qs.load_panel(db, p["universe"])
    status = qs.panel_status(panel)
    if not panel:
        return None, status
    key = hashlib.sha1(json.dumps([p, panel["version"], str(start), str(end), benchmark, cost_bps],
                                  sort_keys=True, default=str).encode()).hexdigest()
    hit = _RESULT_CACHE.get(key)
    if hit is not None:
        return hit, status
    rows, _ = universe_members(db, p["universe"])
    target = target_weights(p, {r["symbol"]: r for r in rows})
    with qs._BACKTEST_LOCK:
        result = run_backtest(p, panel, target, start, end, benchmark, cost_bps)
    _RESULT_CACHE.put(key, result)
    return result, status


def catalog() -> dict:
    return {
        "weighting": [{"id": k, "name": v} for k, v in WEIGHTING.items()],
        "rebalance": [{"id": k, "name": v} for k, v in REBALANCE.items()],
        "costs": COSTS,
        "universes": [{"id": k, "name": v} for k, v in UNIVERSES.items()],
        "max_cash": MAX_CASH,
    }
