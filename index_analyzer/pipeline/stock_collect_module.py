"""
Stock Collection Module - S&P 500 종목 데이터 수집
================================================
역할:
  - S&P 500 구성종목 목록 수집 (Wikipedia HTML 파싱)
  - 회사 상세 프로필 수집 (FMP stable/profile)
  - Peer 그룹 수집 (FMP stable/stock-peers)
  - 일별 가격 갱신 (yfinance 단일 조회 or FMP stable/quote)

파이프라인:
  run_sp500_initial_collection()   - 최초 1회 전체 수집 (월간 실행)
  run_daily_profile_update()       - 일별 가격/시총 갱신
  run_weekly_relations_refresh()   - 주별 Peer 관계 갱신

DB 저장:
  mbs_in_indx_member  - S&P 500 구성종목 현황
  mbs_in_stbd_mst     - 종목 마스터 (신규 종목 등록)
  mbs_in_stk_profile  - 회사 상세 프로필
  mbs_in_stk_relations - Peer/경쟁사 관계
"""

import os
import time
import logging
import requests
from datetime import date, datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from index_analyzer.models.database import (
    default_db,
    MBS_IN_STBD_MST,
    MBS_IN_STK_PROFILE,
    MBS_IN_STK_RELATIONS,
    MBS_IN_INDX_MEMBER,
)

log = logging.getLogger(__name__)

# ── FMP API 설정 ──────────────────────────────────────────────────────────────
_FMP_STABLE = "https://financialmodelingprep.com/stable"
_REQUEST_DELAY = 0.3    # FMP 무료 플랜: 적당한 간격 (약 3 req/s)


def _fmp_api_key() -> Optional[str]:
    """FMP API 키 반환"""
    try:
        from index_analyzer.core.config import settings
        if settings.FMP_API_KEY:
            return settings.FMP_API_KEY
    except Exception:
        pass
    return os.getenv("FMP_API_KEY")


def _fmp_get(path: str, params: dict = None, timeout: int = 30) -> Optional[list | dict]:
    """FMP stable API GET 요청 공통 함수"""
    api_key = _fmp_api_key()
    if not api_key:
        log.error("FMP_API_KEY 미설정")
        return None

    url = f"{_FMP_STABLE}/{path}"
    p = {"apikey": api_key}
    if params:
        p.update(params)

    try:
        r = requests.get(url, params=p, timeout=timeout)
        if r.status_code == 200:
            return r.json()
        elif r.status_code in (402, 403):
            log.warning(f"FMP 접근 제한 [{path}]: plan 업그레이드 필요")
            return None
        else:
            log.warning(f"FMP HTTP {r.status_code} [{path}]")
            return None
    except Exception as e:
        log.error(f"FMP 요청 실패 [{path}]: {e}")
        return None


# ── S&P 500 구성종목 수집 (Wikipedia) ────────────────────────────────────────

def fetch_sp500_members() -> List[dict]:
    """
    Wikipedia에서 S&P 500 구성종목 전체 목록 수집

    Returns:
        [{"symbol": "AAPL", "name": "...", "sector": "...", "sub_sector": "..."}, ...]
    """
    url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        r = requests.get(url, headers=headers, timeout=30)
        r.raise_for_status()
    except Exception as e:
        log.error(f"Wikipedia S&P 500 수집 실패: {e}")
        return []

    from bs4 import BeautifulSoup
    soup = BeautifulSoup(r.text, "html.parser")
    table = soup.find("table", id="constituents")
    if not table:
        log.error("Wikipedia S&P 500 table#constituents 를 찾지 못함")
        return []

    members = []
    rows = table.find_all("tr")[1:]  # 헤더 제외
    for row in rows:
        cells = row.find_all("td")
        if len(cells) < 4:
            continue
        symbol = cells[0].text.strip().replace(".", "-")  # BRK.B → BRK-B
        name   = cells[1].text.strip()
        sector = cells[2].text.strip()
        sub_sector = cells[3].text.strip()
        # 편입일: 보통 7번째 컬럼 (없으면 빈 문자열)
        date_added = cells[6].text.strip() if len(cells) > 6 else ""

        members.append({
            "symbol": symbol,
            "name": name,
            "sector": sector,
            "sub_sector": sub_sector,
            "date_added": date_added,
        })

    log.info(f"Wikipedia S&P 500 구성종목 수집: {len(members)}개")
    return members


# ── 회사 프로필 수집 (FMP stable/profile) ────────────────────────────────────

def fetch_company_profile(symbol: str) -> Optional[dict]:
    """
    FMP stable/profile에서 단일 종목 회사 프로필 수집

    Returns:
        {"symbol": "AAPL", "companyName": "...", "sector": "...", ...}
    """
    data = _fmp_get("profile", params={"symbol": symbol})
    if not isinstance(data, list) or not data:
        return None
    return data[0]


# ── Peer 그룹 수집 (FMP stable/stock-peers) ──────────────────────────────────

def fetch_stock_peers(symbol: str) -> List[dict]:
    """
    FMP stable/stock-peers에서 동종업계 Peer 목록 수집

    Returns:
        [{"symbol": "MSFT", "companyName": "...", "price": ..., "mktCap": ...}, ...]
    """
    data = _fmp_get("stock-peers", params={"symbol": symbol})
    if not isinstance(data, list):
        return []
    log.debug(f"Peer 수집 [{symbol}]: {len(data)}개")
    return data


# ── Yahoo Finance 경쟁사 수집 (보완 fallback) ─────────────────────────────────

def fetch_yahoo_similar(symbol: str) -> List[dict]:
    """Yahoo Finance recommendationsbysymbol에서 유사 종목 수집"""
    url = f"https://query2.finance.yahoo.com/v6/finance/recommendationsbysymbol/{symbol}"
    headers = {"User-Agent": "Mozilla/5.0 (compatible; MarketPulse/1.0)"}
    try:
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code != 200:
            return []
        result = r.json().get("finance", {}).get("result", [])
        return result[0].get("recommendedSymbols", []) if result else []
    except Exception as e:
        log.warning(f"Yahoo 유사종목 수집 실패 [{symbol}]: {e}")
        return []


# ── DB 저장 헬퍼 ──────────────────────────────────────────────────────────────

def _upsert_stbd_mst(session: Session, symbol: str, name: str,
                     sector: str, industry: str, exchange: str,
                     country: str, currency: str) -> None:
    """mbs_in_stbd_mst 신규 등록 또는 업데이트"""
    existing = session.query(MBS_IN_STBD_MST).filter_by(ticker_cd=symbol).first()
    if existing:
        if name:        existing.ticker_nm = name
        if sector:      existing.sector    = sector
        if industry:    existing.industry  = industry
        if exchange:    existing.exchange  = exchange
        if country:     existing.country   = country
        if currency:    existing.curr      = currency
        existing.updated_at = datetime.utcnow()
    else:
        session.add(MBS_IN_STBD_MST(
            ticker_cd=symbol,
            ticker_nm=name or symbol,
            asset_type='stock',
            sector=sector,
            industry=industry,
            exchange=exchange or 'US',
            country=country or 'US',
            curr=currency or 'USD',
            data_source='fmp',
            is_active=True,
            start_date=date.today(),
        ))


def _parse_employees(val) -> Optional[int]:
    """fullTimeEmployees 값을 int로 변환 (문자열 허용)"""
    if val is None:
        return None
    try:
        return int(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def _upsert_stk_profile(session: Session, symbol: str, profile: dict,
                         in_sp500: bool = False) -> None:
    """mbs_in_stk_profile 신규 등록 또는 업데이트

    FMP stable/profile 필드명:
      marketCap (not mktCap), exchange (not exchangeShortName),
      fullTimeEmployees → 문자열 가능
    """
    ipo_date = None
    if profile.get("ipoDate"):
        try:
            ipo_date = datetime.strptime(profile["ipoDate"], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            pass

    # FMP stable: exchange, marketCap 등
    exchange   = profile.get("exchange") or profile.get("exchangeShortName")
    market_cap = profile.get("marketCap") or profile.get("mktCap")
    employees  = _parse_employees(profile.get("fullTimeEmployees"))

    existing = session.query(MBS_IN_STK_PROFILE).filter_by(stk_cd=symbol).first()
    if existing:
        if profile.get("companyName"):  existing.stk_nm      = profile["companyName"]
        if profile.get("sector"):       existing.sector      = profile["sector"]
        if profile.get("industry"):     existing.industry    = profile["industry"]
        if profile.get("description"):  existing.description = profile["description"]
        if profile.get("website"):      existing.website     = profile["website"]
        if profile.get("ceo"):          existing.ceo         = profile["ceo"]
        if employees is not None:       existing.employees   = employees
        if profile.get("country"):      existing.country     = profile["country"]
        if exchange:                    existing.exchange    = exchange
        if profile.get("currency"):     existing.currency    = profile["currency"]
        if ipo_date:                    existing.ipo_date    = ipo_date
        if profile.get("image"):        existing.image_url   = profile["image"]
        if market_cap:                  existing.market_cap  = market_cap
        if profile.get("price"):        existing.price       = profile["price"]
        if profile.get("beta"):         existing.beta        = profile["beta"]
        if in_sp500:                    existing.in_sp500    = True
        existing.data_source  = 'fmp'
        existing.last_updated = datetime.utcnow()
        existing.updated_at   = datetime.utcnow()
    else:
        session.add(MBS_IN_STK_PROFILE(
            stk_cd=symbol,
            stk_nm=profile.get("companyName", symbol),
            sector=profile.get("sector"),
            industry=profile.get("industry"),
            description=profile.get("description"),
            website=profile.get("website"),
            ceo=profile.get("ceo"),
            employees=employees,
            country=profile.get("country"),
            exchange=exchange,
            currency=profile.get("currency", "USD"),
            ipo_date=ipo_date,
            image_url=profile.get("image"),
            market_cap=market_cap,
            price=profile.get("price"),
            beta=profile.get("beta"),
            in_sp500=in_sp500,
            data_source='fmp',
            last_updated=datetime.utcnow(),
        ))


def _upsert_indx_member(session: Session, indx_cd: str, symbol: str,
                         name: str, sector: str, sub_sector: str,
                         date_added_str: str) -> None:
    """mbs_in_indx_member 신규 등록 또는 업데이트"""
    date_added = None
    if date_added_str:
        for fmt in ("%Y-%m-%d", "%B %d, %Y", "%Y"):
            try:
                date_added = datetime.strptime(date_added_str.strip(), fmt).date()
                break
            except (ValueError, TypeError):
                continue

    existing = session.query(MBS_IN_INDX_MEMBER).filter_by(
        indx_cd=indx_cd, stk_cd=symbol
    ).first()
    if existing:
        if name:       existing.stk_nm     = name
        if sector:     existing.sector     = sector
        if sub_sector: existing.sub_sector = sub_sector
        existing.is_current  = True
        existing.updated_at  = datetime.utcnow()
    else:
        session.add(MBS_IN_INDX_MEMBER(
            indx_cd=indx_cd,
            stk_cd=symbol,
            stk_nm=name,
            sector=sector,
            sub_sector=sub_sector,
            date_added=date_added or date.today(),
            is_current=True,
        ))


def _upsert_relation(session: Session, stk_cd: str, related_cd: str,
                     relation_type: str, related_nm: str,
                     detail: str, data_source: str,
                     confidence: float = 0.85) -> None:
    """mbs_in_stk_relations 신규 등록 또는 업데이트"""
    existing = session.query(MBS_IN_STK_RELATIONS).filter_by(
        stk_cd=stk_cd, related_cd=related_cd, relation_type=relation_type
    ).first()
    if existing:
        if related_nm: existing.related_nm = related_nm
        if detail:     existing.detail     = detail
        existing.confidence  = confidence
        existing.data_source = data_source
        existing.updated_at  = datetime.utcnow()
    else:
        session.add(MBS_IN_STK_RELATIONS(
            stk_cd=stk_cd,
            related_cd=related_cd,
            relation_type=relation_type,
            related_nm=related_nm,
            detail=detail,
            confidence=confidence,
            data_source=data_source,
        ))


# ── 핵심 수집 함수 ─────────────────────────────────────────────────────────────

def run_sp500_initial_collection(profile_limit: int = 0) -> dict:
    """
    S&P 500 전체 최초 수집 (1회성 + 월간 실행)

    흐름:
      1. Wikipedia → S&P 500 구성종목 → mbs_in_indx_member + mbs_in_stbd_mst
      2. FMP stable/profile → 회사 프로필 → mbs_in_stk_profile
      3. FMP stable/stock-peers → Peer 관계 → mbs_in_stk_relations

    Args:
        profile_limit: 0이면 전체 수집, 양수면 최대 N개만 수집 (테스트용)

    Returns:
        {members: N, profiles: N, relations: N, errors: N}
    """
    log.info("=" * 70)
    log.info("[StockCollect] S&P 500 전체 수집 시작")
    log.info("=" * 70)

    stats = {"members": 0, "profiles": 0, "relations": 0, "errors": 0}

    # ── 1. S&P 500 구성종목 (Wikipedia) ──────────────────────────────────────
    members = fetch_sp500_members()
    if not members:
        log.error("[StockCollect] S&P 500 구성종목 수집 실패")
        return stats

    session: Session = default_db.get_session()
    try:
        for item in members:
            symbol = item.get("symbol", "")
            if not symbol:
                continue
            try:
                _upsert_stbd_mst(
                    session, symbol, item["name"], item["sector"],
                    item["sub_sector"], "NYSE/NASDAQ", "US", "USD"
                )
                _upsert_indx_member(
                    session, "sp500", symbol, item["name"],
                    item["sector"], item["sub_sector"], item.get("date_added", "")
                )
                stats["members"] += 1
            except Exception as e:
                log.warning(f"  [indx_member] {symbol} 저장 오류: {e}")
                stats["errors"] += 1
        session.commit()
        log.info(f"[StockCollect] 구성종목 저장 완료: {stats['members']}개")
    except Exception as e:
        session.rollback()
        log.error(f"[StockCollect] 구성종목 일괄 저장 실패: {e}")
    finally:
        session.close()

    # ── 2. 회사 프로필 (FMP stable/profile) ──────────────────────────────────
    target_members = members[:profile_limit] if profile_limit > 0 else members
    log.info(f"[StockCollect] 회사 프로필 수집 시작 ({len(target_members)}개)...")

    for i, item in enumerate(target_members):
        symbol = item.get("symbol", "")
        if not symbol:
            continue

        profile = fetch_company_profile(symbol)
        if not profile:
            log.debug(f"  [profile] {symbol} 수집 실패 또는 없음")
            stats["errors"] += 1
            time.sleep(_REQUEST_DELAY)
            continue

        session = default_db.get_session()
        try:
            _upsert_stk_profile(session, symbol, profile, in_sp500=True)
            # stbd_mst도 FMP 데이터로 보강
            _upsert_stbd_mst(
                session, symbol,
                profile.get("companyName", ""),
                profile.get("sector", ""),
                profile.get("industry", ""),
                profile.get("exchange") or profile.get("exchangeShortName", ""),
                profile.get("country", "US"),
                profile.get("currency", "USD"),
            )
            session.commit()
            stats["profiles"] += 1
            if (i + 1) % 50 == 0:
                log.info(f"  [profile] {i + 1}/{len(target_members)} 완료")
        except Exception as e:
            session.rollback()
            log.warning(f"  [profile] {symbol} 저장 오류: {e}")
            stats["errors"] += 1
        finally:
            session.close()

        time.sleep(_REQUEST_DELAY)

    log.info(f"[StockCollect] 프로필 저장 완료: {stats['profiles']}개")

    # ── 3. Peer 관계 (FMP stable/stock-peers) ────────────────────────────────
    log.info(f"[StockCollect] Peer 관계 수집 시작 ({len(target_members)}개)...")

    # sector 역방향 맵 (빠른 분류)
    sector_map: dict[str, str] = {
        item["symbol"]: item["sector"] for item in members if item.get("symbol")
    }

    for i, item in enumerate(target_members):
        symbol     = item.get("symbol", "")
        base_sector = item.get("sector", "")
        if not symbol:
            continue

        peers = fetch_stock_peers(symbol)
        if peers:
            session = default_db.get_session()
            try:
                for peer in peers[:15]:  # 최대 15개
                    peer_sym = peer.get("symbol", "")
                    peer_nm  = peer.get("companyName", peer_sym)
                    if not peer_sym or peer_sym == symbol:
                        continue

                    peer_sector = sector_map.get(peer_sym, "")
                    rel_type = "competitor" if (
                        peer_sector == base_sector or not peer_sector
                    ) else "peer"

                    _upsert_relation(
                        session, symbol, peer_sym, rel_type,
                        peer_nm, f"{base_sector} sector peer",
                        "fmp_peers", confidence=0.85
                    )
                    stats["relations"] += 1

                session.commit()
            except Exception as e:
                session.rollback()
                log.warning(f"  [relations] {symbol} Peer 저장 오류: {e}")
                stats["errors"] += 1
            finally:
                session.close()

        if (i + 1) % 50 == 0:
            log.info(f"  [relations] {i + 1}/{len(target_members)} 완료 (누적: {stats['relations']})")

        time.sleep(_REQUEST_DELAY)

    log.info("=" * 70)
    log.info(f"[StockCollect] 수집 완료: {stats}")
    log.info("=" * 70)
    return stats


def run_daily_profile_update() -> dict:
    """
    일별 주식 가격·시총 갱신 (yfinance로 S&P 500 업데이트)

    Returns:
        {updated: N, errors: N}
    """
    log.info("[StockCollect] 일별 프로필 가격 업데이트 시작")
    stats = {"updated": 0, "errors": 0}

    try:
        import yfinance as yf
    except ImportError:
        log.error("[StockCollect] yfinance 미설치 - pip install yfinance")
        return stats

    # S&P 500 현재 구성종목 심볼 목록
    symbols = get_sp500_symbols()
    if not symbols:
        log.warning("[StockCollect] 일별 업데이트: DB에 S&P 500 종목 없음")
        return stats

    log.info(f"[StockCollect] {len(symbols)}개 종목 가격 갱신 중...")

    # yfinance download (batch, 1d period, last close)
    chunk_size = 100
    for chunk_start in range(0, len(symbols), chunk_size):
        chunk = symbols[chunk_start:chunk_start + chunk_size]
        try:
            tickers = yf.Tickers(" ".join(chunk))
            session = default_db.get_session()
            try:
                for sym in chunk:
                    try:
                        info = tickers.tickers[sym].fast_info
                        price      = getattr(info, "last_price", None)
                        market_cap = getattr(info, "market_cap", None)
                        if not price and not market_cap:
                            continue

                        row = session.query(MBS_IN_STK_PROFILE).filter_by(stk_cd=sym).first()
                        if row:
                            if price:      row.price      = price
                            if market_cap: row.market_cap = market_cap
                            row.last_updated = datetime.utcnow()
                            row.updated_at   = datetime.utcnow()
                            stats["updated"] += 1
                    except Exception:
                        stats["errors"] += 1

                session.commit()
            except Exception as e:
                session.rollback()
                log.warning(f"[StockCollect] 청크 업데이트 저장 오류: {e}")
            finally:
                session.close()

        except Exception as e:
            log.warning(f"[StockCollect] yfinance Tickers 조회 실패: {e}")
            stats["errors"] += len(chunk)

        time.sleep(0.5)

    log.info(f"[StockCollect] 일별 업데이트 완료: {stats}")
    return stats


def run_weekly_relations_refresh() -> dict:
    """
    주별 Peer 관계 갱신 (S&P 500 전체)

    Returns:
        {refreshed: N, errors: N}
    """
    log.info("[StockCollect] 주별 Peer 관계 갱신 시작")
    stats = {"refreshed": 0, "errors": 0}

    session = default_db.get_session()
    try:
        rows = session.query(MBS_IN_INDX_MEMBER).filter_by(
            indx_cd="sp500", is_current=True
        ).all()
        member_list = [(r.stk_cd, r.sector or "") for r in rows]
    finally:
        session.close()

    if not member_list:
        log.warning("[StockCollect] 주별 갱신: DB에 S&P 500 종목 없음")
        return stats

    sector_map = {sym: sec for sym, sec in member_list}

    for i, (symbol, base_sector) in enumerate(member_list):
        peers = fetch_stock_peers(symbol)
        if peers:
            session = default_db.get_session()
            try:
                for peer in peers[:15]:
                    peer_sym = peer.get("symbol", "")
                    peer_nm  = peer.get("companyName", peer_sym)
                    if not peer_sym or peer_sym == symbol:
                        continue
                    peer_sector = sector_map.get(peer_sym, "")
                    rel_type = "competitor" if (
                        peer_sector == base_sector or not peer_sector
                    ) else "peer"
                    _upsert_relation(
                        session, symbol, peer_sym, rel_type,
                        peer_nm, f"{base_sector} sector peer",
                        "fmp_peers", confidence=0.85
                    )
                    stats["refreshed"] += 1
                session.commit()
            except Exception as e:
                session.rollback()
                log.warning(f"  [relations] {symbol} 갱신 오류: {e}")
                stats["errors"] += 1
            finally:
                session.close()

        if (i + 1) % 100 == 0:
            log.info(f"  [relations] {i + 1}/{len(member_list)} 갱신 완료")

        time.sleep(_REQUEST_DELAY)

    log.info(f"[StockCollect] 주별 관계 갱신 완료: {stats}")
    return stats


# ── 쿼리 헬퍼 (API 라우터에서 사용) ──────────────────────────────────────────

def get_relations_from_db(symbol: str) -> List[dict]:
    """DB에서 종목 관계 조회"""
    session = default_db.get_session()
    try:
        rows = session.query(MBS_IN_STK_RELATIONS).filter_by(stk_cd=symbol).all()
        return [
            {
                "symbol": row.related_cd,
                "name":   row.related_nm or row.related_cd,
                "type":   row.relation_type,
                "detail": row.detail or "",
                "confidence": float(row.confidence) if row.confidence else 0.85,
                "data_source": row.data_source,
            }
            for row in rows
        ]
    except Exception as e:
        log.error(f"DB 관계 조회 실패 [{symbol}]: {e}")
        return []
    finally:
        session.close()


def get_profile_from_db(symbol: str) -> Optional[dict]:
    """DB에서 종목 프로필 조회"""
    session = default_db.get_session()
    try:
        row = session.query(MBS_IN_STK_PROFILE).filter_by(stk_cd=symbol).first()
        return row.to_dict() if row else None
    except Exception as e:
        log.error(f"DB 프로필 조회 실패 [{symbol}]: {e}")
        return None
    finally:
        session.close()


def get_sp500_symbols() -> List[str]:
    """DB에서 현재 S&P 500 구성종목 심볼 목록 조회"""
    session = default_db.get_session()
    try:
        rows = session.query(MBS_IN_INDX_MEMBER).filter_by(
            indx_cd="sp500", is_current=True
        ).all()
        return [r.stk_cd for r in rows]
    except Exception as e:
        log.error(f"S&P 500 심볼 조회 실패: {e}")
        return []
    finally:
        session.close()
