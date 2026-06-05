"""Universe Repository — 통합 마스터/지수소속/자산별 스냅샷 bulk upsert.

데몬 universe collector 의 저장 추상. 거래소/지수 단위 자산 리스트를 받아
  · MBS_IN_STBD_MST     : 통합 식별 마스터 (asset_type = stock|etf|bond, country)
  · MBS_IN_INDX_MEMBER  : 지수/거래소 소속 (ETF=거래소별 분류)
  · MBS_IN_ETF_STBD / MBS_IN_BOND_STBD : 자산별 스냅샷(base_ymd)
에 upsert 하고, 이번 배치에 없는 종목은 소프트 만료한다.

국가별 분류 = STBD_MST.country / curr. 지수별 분류 = INDX_MEMBER.indx_cd.
"""
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from ..utils.db import default_db, generate_batch_id
from ..utils.logging import get_logger
from ..models.orm import (
    MBS_IN_STBD_MST,
    MBS_IN_INDX_STBD,
    MBS_IN_INDX_MEMBER,
    MBS_IN_ETF_STBD,
    MBS_IN_BOND_STBD,
)

log = get_logger(__name__)


@dataclass
class StoreResult:
    indx_cd: str
    batch_id: str
    asset_type: str = "stock"
    inserted: int = 0
    updated: int = 0
    expired: int = 0
    errors: int = 0
    seen: List[str] = field(default_factory=list)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "indx_cd": self.indx_cd,
            "asset_type": self.asset_type,
            "batch_id": self.batch_id,
            "inserted": self.inserted,
            "updated": self.updated,
            "expired": self.expired,
            "errors": self.errors,
            "total": len(self.seen),
        }


def _upsert_index_master(session, indx_cd: str, meta: Dict[str, Any]) -> None:
    """MBS_IN_INDX_STBD 지수/거래소 마스터 보장."""
    existing = session.query(MBS_IN_INDX_STBD).filter_by(indx_cd=indx_cd).first()
    if existing:
        existing.indx_nm = meta.get("indx_nm", existing.indx_nm)
        existing.indx_type = meta.get("indx_type", existing.indx_type)
        existing.region = meta.get("region", existing.region)
        existing.is_active = True
        existing.updated_at = datetime.utcnow()
    else:
        session.add(MBS_IN_INDX_STBD(
            indx_cd=indx_cd,
            indx_nm=meta.get("indx_nm", indx_cd),
            indx_type=meta.get("indx_type", "exchange"),
            description=meta.get("description"),
            category=meta.get("category"),
            region=meta.get("region", "US"),
            is_active=True,
            display_order=meta.get("display_order", 0),
        ))


def _upsert_stbd_mst(session, row: Dict[str, Any], data_source: str,
                     country: str, curr: str, asset_type: str,
                     result: StoreResult) -> None:
    ticker = row.get("ticker_cd")
    existing = session.query(MBS_IN_STBD_MST).filter_by(ticker_cd=ticker).first()
    if existing:
        existing.ticker_nm = row.get("ticker_nm") or existing.ticker_nm
        existing.asset_type = asset_type
        if row.get("sector"):
            existing.sector = row["sector"]
        if row.get("industry"):
            existing.industry = row["industry"]
        if row.get("exchange"):
            existing.exchange = row["exchange"]
        if row.get("bond_type"):
            existing.bond_type = row["bond_type"]
        if row.get("maturity"):
            existing.maturity = row["maturity"]
        existing.country = row.get("country") or country
        existing.curr = row.get("curr") or curr
        existing.data_source = data_source
        existing.is_active = True
        existing.end_date = None
        existing.updated_at = datetime.utcnow()
        result.updated += 1
    else:
        session.add(MBS_IN_STBD_MST(
            ticker_cd=ticker,
            ticker_nm=row.get("ticker_nm") or ticker,
            asset_type=asset_type,
            sector=row.get("sector"),
            industry=row.get("industry"),
            exchange=row.get("exchange"),
            bond_type=row.get("bond_type"),
            maturity=row.get("maturity"),
            country=row.get("country") or country,
            curr=row.get("curr") or curr,
            data_source=data_source,
            is_active=True,
            start_date=date.today(),
        ))
        result.inserted += 1


def _upsert_indx_member(session, indx_cd: str, row: Dict[str, Any]) -> None:
    ticker = row.get("ticker_cd")
    existing = session.query(MBS_IN_INDX_MEMBER).filter_by(
        indx_cd=indx_cd, stk_cd=ticker
    ).first()
    if existing:
        existing.stk_nm = row.get("ticker_nm") or existing.stk_nm
        if row.get("sector"):
            existing.sector = row["sector"]
        existing.is_current = True
        existing.date_removed = None
        existing.updated_at = datetime.utcnow()
    else:
        session.add(MBS_IN_INDX_MEMBER(
            indx_cd=indx_cd,
            stk_cd=ticker,
            stk_nm=row.get("ticker_nm") or ticker,
            sector=row.get("sector"),
            sub_sector=row.get("industry"),
            date_added=date.today(),
            is_current=True,
        ))


def _upsert_etf_snapshot(session, row: Dict[str, Any], curr: str, today: date) -> None:
    etf_cd = row.get("ticker_cd")
    existing = session.query(MBS_IN_ETF_STBD).filter_by(etf_cd=etf_cd, base_ymd=today).first()
    if existing:
        existing.etf_nm = row.get("ticker_nm") or existing.etf_nm
        existing.sector = row.get("sector") or existing.sector
        existing.curr = row.get("curr") or curr
        if row.get("close_price") is not None:
            existing.close_price = row["close_price"]
        existing.updated_at = datetime.utcnow()
    else:
        session.add(MBS_IN_ETF_STBD(
            etf_cd=etf_cd,
            etf_nm=row.get("ticker_nm") or etf_cd,
            sector=row.get("sector"),
            curr=row.get("curr") or curr,
            close_price=row.get("close_price"),
            change_rate=row.get("change_rate"),
            base_ymd=today,
        ))


def _upsert_bond_snapshot(session, row: Dict[str, Any], curr: str, today: date) -> None:
    bond_cd = row.get("ticker_cd")
    existing = session.query(MBS_IN_BOND_STBD).filter_by(bond_cd=bond_cd, base_ymd=today).first()
    if existing:
        existing.bond_nm = row.get("ticker_nm") or existing.bond_nm
        existing.bond_type = row.get("bond_type") or existing.bond_type
        existing.maturity = row.get("maturity") or existing.maturity
        existing.curr = row.get("curr") or curr
        if row.get("yield_rate") is not None:
            existing.yield_rate = row["yield_rate"]
        if row.get("close_price") is not None:
            existing.close_price = row["close_price"]
        existing.updated_at = datetime.utcnow()
    else:
        session.add(MBS_IN_BOND_STBD(
            bond_cd=bond_cd,
            bond_nm=row.get("ticker_nm") or bond_cd,
            bond_type=row.get("bond_type"),
            maturity=row.get("maturity"),
            curr=row.get("curr") or curr,
            close_price=row.get("close_price"),
            yield_rate=row.get("yield_rate"),
            change_rate=row.get("change_rate"),
            base_ymd=today,
        ))


def _soft_expire(session, indx_cd: str, data_source: str, asset_type: str,
                 link_member: bool, seen: set, result: StoreResult) -> None:
    """이번 배치에 없는 종목 만료. 마스터=data_source 범위, 소속=indx_cd+asset_type 범위."""
    today = date.today()

    # 마스터 비활성 (동일 data_source 에서 사라진 종목)
    masters = session.query(MBS_IN_STBD_MST).filter_by(
        data_source=data_source, is_active=True
    ).all()
    for s in masters:
        if s.ticker_cd not in seen:
            s.is_active = False
            s.end_date = today
            s.updated_at = datetime.utcnow()

    if not link_member:
        return

    # 소속 만료 — 같은 indx_cd 안에서도 asset_type 이 일치하는 것만
    # (예: indx_cd='NASDAQ' 에 stock 과 etf 가 공존 → 서로 만료시키지 않도록 분리)
    members = session.query(MBS_IN_INDX_MEMBER).filter_by(
        indx_cd=indx_cd, is_current=True
    ).all()
    if not members:
        return
    codes = [m.stk_cd for m in members]
    type_rows = session.query(
        MBS_IN_STBD_MST.ticker_cd, MBS_IN_STBD_MST.asset_type
    ).filter(MBS_IN_STBD_MST.ticker_cd.in_(codes)).all()
    type_map = {t.ticker_cd: t.asset_type for t in type_rows}
    for m in members:
        if type_map.get(m.stk_cd) != asset_type:
            continue
        if m.stk_cd not in seen:
            m.is_current = False
            m.date_removed = today
            m.updated_at = datetime.utcnow()
            result.expired += 1


def store_universe(
    indx_cd: str,
    index_meta: Dict[str, Any],
    rows: List[Dict[str, Any]],
    data_source: str,
    country: str = "US",
    curr: str = "USD",
    asset_type: str = "stock",
    link_member: bool = True,
    snapshot: Optional[str] = None,
    batch_id: Optional[str] = None,
) -> StoreResult:
    """거래소/지수 단위 자산 리스트를 마스터·소속·스냅샷 테이블에 bulk upsert.

    Args:
        asset_type:   'stock' | 'etf' | 'bond'
        link_member:  INDX_MEMBER 소속 연결 여부 (ETF/stock=True, bond=False)
        snapshot:     'etf' | 'bond' → 전용 스냅샷 테이블에도 적재
    """
    batch_id = batch_id or generate_batch_id()
    today = date.today()
    result = StoreResult(indx_cd=indx_cd, batch_id=batch_id, asset_type=asset_type)

    if not rows:
        log.warning("[ingest] %s(%s): 수집 0개 — 만료 처리 건너뜀", indx_cd, asset_type)
        return result

    seen: set = set()
    session = default_db.get_session()
    try:
        if link_member:
            _upsert_index_master(session, indx_cd, index_meta)

        for row in rows:
            ticker = row.get("ticker_cd")
            if not ticker:
                continue
            try:
                _upsert_stbd_mst(session, row, data_source, country, curr, asset_type, result)
                if link_member:
                    _upsert_indx_member(session, indx_cd, row)
                if snapshot == "etf":
                    _upsert_etf_snapshot(session, row, curr, today)
                elif snapshot == "bond":
                    _upsert_bond_snapshot(session, row, curr, today)
                seen.add(ticker)
                result.seen.append(ticker)
            except Exception as exc:
                log.warning("[ingest] %s upsert 오류: %s", ticker, exc)
                result.errors += 1

        _soft_expire(session, indx_cd, data_source, asset_type, link_member, seen, result)
        session.commit()
        log.info(
            "[ingest] %s(%s) 저장: +%d ~%d 만료%d (오류 %d)",
            indx_cd, asset_type, result.inserted, result.updated, result.expired, result.errors,
        )
    except Exception as exc:
        session.rollback()
        log.error("[ingest] %s 저장 실패(rollback): %s", indx_cd, exc, exc_info=True)
        raise
    finally:
        session.close()

    return result
