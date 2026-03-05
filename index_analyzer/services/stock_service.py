"""
Stock Service - S&P 500 종목 데이터 수집 + 지수 구성종목 다운로드
Merged from: pipeline/stock_collect_module.py + pipeline/download_index_constituents.py
"""
import os
import time
import requests
import pandas as pd
from datetime import date, datetime
from typing import List, Optional
from pathlib import Path
from sqlalchemy.orm import Session

from ..utils.db import default_db
from ..utils.logging import get_logger
from ..models.orm import (
    MBS_IN_STBD_MST,
    MBS_IN_STK_PROFILE,
    MBS_IN_STK_RELATIONS,
    MBS_IN_INDX_MEMBER,
    MBS_IN_INDX_STBD,
)

log = get_logger(__name__)

# ── FMP API 설정 ──────────────────────────────────────────────────────────────
_FMP_STABLE = "https://financialmodelingprep.com/stable"
_REQUEST_DELAY = 0.3

# GitHub CSV URLs for index constituents
INDEX_URLS = {
    'sp500': {
        'url': 'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv',
        'indx_cd': 'sp500',
        'indx_nm': 'S&P 500',
        'description': 'S&P 500 Index - 500 large-cap US stocks',
        'category': 'Large Cap'
    },
    'nasdaq100': {
        'url': 'https://yfiua.github.io/index-constituents/constituents-nasdaq100.csv',
        'indx_cd': 'nasdaq100',
        'indx_nm': 'NASDAQ 100',
        'description': 'NASDAQ 100 Index - Top 100 non-financial NASDAQ stocks',
        'category': 'Tech/Growth'
    },
    'dow30': {
        'url': None,
        'indx_cd': 'dow30',
        'indx_nm': 'Dow Jones 30',
        'description': 'Dow Jones Industrial Average - 30 blue chip US stocks',
        'category': 'Blue Chip',
        'fallback': [
            {'ticker_cd': 'AAPL', 'ticker_nm': 'Apple Inc.', 'sector': 'Technology', 'industry': 'Consumer Electronics'},
            {'ticker_cd': 'MSFT', 'ticker_nm': 'Microsoft Corporation', 'sector': 'Technology', 'industry': 'Software'},
            {'ticker_cd': 'UNH', 'ticker_nm': 'UnitedHealth Group Inc.', 'sector': 'Healthcare', 'industry': 'Health Insurance'},
            {'ticker_cd': 'GS', 'ticker_nm': 'The Goldman Sachs Group Inc.', 'sector': 'Financials', 'industry': 'Investment Banking'},
            {'ticker_cd': 'HD', 'ticker_nm': 'The Home Depot Inc.', 'sector': 'Consumer Cyclical', 'industry': 'Home Improvement Retail'},
            {'ticker_cd': 'MCD', 'ticker_nm': "McDonald's Corporation", 'sector': 'Consumer Cyclical', 'industry': 'Restaurants'},
            {'ticker_cd': 'CAT', 'ticker_nm': 'Caterpillar Inc.', 'sector': 'Industrials', 'industry': 'Construction & Farm Machinery'},
            {'ticker_cd': 'V', 'ticker_nm': 'Visa Inc.', 'sector': 'Financials', 'industry': 'Credit Services'},
            {'ticker_cd': 'AMGN', 'ticker_nm': 'Amgen Inc.', 'sector': 'Healthcare', 'industry': 'Biotechnology'},
            {'ticker_cd': 'BA', 'ticker_nm': 'The Boeing Company', 'sector': 'Industrials', 'industry': 'Aerospace & Defense'},
            {'ticker_cd': 'HON', 'ticker_nm': 'Honeywell International Inc.', 'sector': 'Industrials', 'industry': 'Conglomerates'},
            {'ticker_cd': 'IBM', 'ticker_nm': 'International Business Machines Corporation', 'sector': 'Technology', 'industry': 'IT Services'},
            {'ticker_cd': 'CRM', 'ticker_nm': 'Salesforce Inc.', 'sector': 'Technology', 'industry': 'Software - Application'},
            {'ticker_cd': 'TRV', 'ticker_nm': 'The Travelers Companies Inc.', 'sector': 'Financials', 'industry': 'Insurance'},
            {'ticker_cd': 'AXP', 'ticker_nm': 'American Express Company', 'sector': 'Financials', 'industry': 'Credit Services'},
            {'ticker_cd': 'JPM', 'ticker_nm': 'JPMorgan Chase & Co.', 'sector': 'Financials', 'industry': 'Banking'},
            {'ticker_cd': 'JNJ', 'ticker_nm': 'Johnson & Johnson', 'sector': 'Healthcare', 'industry': 'Pharmaceuticals'},
            {'ticker_cd': 'WMT', 'ticker_nm': 'Walmart Inc.', 'sector': 'Consumer Defensive', 'industry': 'Discount Stores'},
            {'ticker_cd': 'CVX', 'ticker_nm': 'Chevron Corporation', 'sector': 'Energy', 'industry': 'Oil & Gas'},
            {'ticker_cd': 'PG', 'ticker_nm': 'The Procter & Gamble Company', 'sector': 'Consumer Defensive', 'industry': 'Personal Products'},
            {'ticker_cd': 'NKE', 'ticker_nm': 'NIKE Inc.', 'sector': 'Consumer Cyclical', 'industry': 'Footwear & Accessories'},
            {'ticker_cd': 'DIS', 'ticker_nm': 'The Walt Disney Company', 'sector': 'Communication Services', 'industry': 'Entertainment'},
            {'ticker_cd': 'MRK', 'ticker_nm': 'Merck & Co. Inc.', 'sector': 'Healthcare', 'industry': 'Pharmaceuticals'},
            {'ticker_cd': 'VZ', 'ticker_nm': 'Verizon Communications Inc.', 'sector': 'Communication Services', 'industry': 'Telecom Services'},
            {'ticker_cd': 'CSCO', 'ticker_nm': 'Cisco Systems Inc.', 'sector': 'Technology', 'industry': 'Communication Equipment'},
            {'ticker_cd': 'KO', 'ticker_nm': 'The Coca-Cola Company', 'sector': 'Consumer Defensive', 'industry': 'Beverages - Non-Alcoholic'},
            {'ticker_cd': 'INTC', 'ticker_nm': 'Intel Corporation', 'sector': 'Technology', 'industry': 'Semiconductors'},
            {'ticker_cd': 'DOW', 'ticker_nm': 'Dow Inc.', 'sector': 'Basic Materials', 'industry': 'Chemicals'},
            {'ticker_cd': 'WBA', 'ticker_nm': 'Walgreens Boots Alliance Inc.', 'sector': 'Healthcare', 'industry': 'Pharmaceutical Retailers'},
            {'ticker_cd': 'MMM', 'ticker_nm': '3M Company', 'sector': 'Industrials', 'industry': 'Conglomerates'}
        ]
    }
}


# ── FMP API 헬퍼 ──────────────────────────────────────────────────────────────

def _fmp_api_key() -> Optional[str]:
    """FMP API 키 반환"""
    try:
        from ..config.settings import settings
        if settings.FMP_API_KEY:
            return settings.FMP_API_KEY
    except Exception:
        pass
    return os.getenv("FMP_API_KEY")


def _fmp_get(path: str, params: dict = None, timeout: int = 30) -> Optional[list | dict]:
    """FMP stable API GET 요청"""
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
    """Wikipedia에서 S&P 500 구성종목 전체 목록 수집"""
    url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
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
    for row in table.find_all("tr")[1:]:
        cells = row.find_all("td")
        if len(cells) < 4:
            continue
        symbol = cells[0].text.strip().replace(".", "-")
        name = cells[1].text.strip()
        sector = cells[2].text.strip()
        sub_sector = cells[3].text.strip()
        date_added = cells[6].text.strip() if len(cells) > 6 else ""
        members.append({"symbol": symbol, "name": name, "sector": sector, "sub_sector": sub_sector, "date_added": date_added})

    log.info(f"Wikipedia S&P 500 구성종목 수집: {len(members)}개")
    return members


# ── FMP 데이터 수집 ────────────────────────────────────────────────────────────

def fetch_company_profile(symbol: str) -> Optional[dict]:
    """FMP stable/profile에서 단일 종목 회사 프로필 수집"""
    data = _fmp_get("profile", params={"symbol": symbol})
    if not isinstance(data, list) or not data:
        return None
    return data[0]


def fetch_stock_peers(symbol: str) -> List[dict]:
    """FMP stable/stock-peers에서 동종업계 Peer 목록 수집"""
    data = _fmp_get("stock-peers", params={"symbol": symbol})
    if not isinstance(data, list):
        return []
    log.debug(f"Peer 수집 [{symbol}]: {len(data)}개")
    return data


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


# ── CSV 다운로드 헬퍼 ─────────────────────────────────────────────────────────

def download_csv(url: str):
    """CSV 파일 다운로드"""
    try:
        log.info(f"Downloading from {url}")
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        from io import StringIO
        df = pd.read_csv(StringIO(response.text))
        log.info(f"Downloaded {len(df)} rows")
        return df
    except Exception as e:
        log.error(f"Error downloading CSV from {url}: {e}")
        return None


def process_sp500(df) -> list:
    """S&P 500 CSV 처리"""
    constituents = []
    for _, row in df.iterrows():
        try:
            constituent = {
                'ticker_cd': row.get('Symbol', '').strip(),
                'ticker_nm': row.get('Security', '').strip(),
                'sector': row.get('GICS Sector', None),
                'industry': row.get('GICS Sub-Industry', None),
                'exchange': 'NYSE/NASDAQ',
                'country': 'US'
            }
            if constituent['ticker_cd'] and constituent['ticker_nm']:
                constituents.append(constituent)
        except Exception as e:
            log.warning(f"Error processing SP500 row: {e}")
    return constituents


def process_nasdaq100(df) -> list:
    """NASDAQ 100 CSV 처리"""
    constituents = []
    for _, row in df.iterrows():
        try:
            constituent = {
                'ticker_cd': row.get('ticker', row.get('Symbol', '')).strip(),
                'ticker_nm': row.get('name', row.get('Name', '')).strip(),
                'sector': row.get('sector', row.get('Sector', None)),
                'industry': row.get('industry', row.get('Industry', None)),
                'exchange': 'NASDAQ',
                'country': 'US'
            }
            if constituent['ticker_cd'] and constituent['ticker_nm']:
                constituents.append(constituent)
        except Exception as e:
            log.warning(f"Error processing NASDAQ100 row: {e}")
    return constituents


def process_dow30(df) -> list:
    """Dow 30 CSV 처리"""
    constituents = []
    for _, row in df.iterrows():
        try:
            constituent = {
                'ticker_cd': row.get('ticker', row.get('Symbol', '')).strip(),
                'ticker_nm': row.get('name', row.get('Company', '')).strip(),
                'sector': row.get('sector', row.get('Sector', None)),
                'industry': row.get('industry', row.get('Industry', None)),
                'exchange': 'NYSE/NASDAQ',
                'country': 'US'
            }
            if constituent['ticker_cd'] and constituent['ticker_nm']:
                constituents.append(constituent)
        except Exception as e:
            log.warning(f"Error processing DOW30 row: {e}")
    return constituents


# ── DB 저장 헬퍼 ──────────────────────────────────────────────────────────────

def _upsert_stbd_mst(session: Session, symbol: str, name: str,
                     sector: str, industry: str, exchange: str,
                     country: str, currency: str) -> None:
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
            ticker_cd=symbol, ticker_nm=name or symbol, asset_type='stock',
            sector=sector, industry=industry, exchange=exchange or 'US',
            country=country or 'US', curr=currency or 'USD',
            data_source='fmp', is_active=True, start_date=date.today(),
        ))


def _parse_employees(val) -> Optional[int]:
    if val is None:
        return None
    try:
        return int(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def _upsert_stk_profile(session: Session, symbol: str, profile: dict, in_sp500: bool = False) -> None:
    ipo_date = None
    if profile.get("ipoDate"):
        try:
            ipo_date = datetime.strptime(profile["ipoDate"], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            pass

    exchange = profile.get("exchange") or profile.get("exchangeShortName")
    market_cap = profile.get("marketCap") or profile.get("mktCap")
    employees = _parse_employees(profile.get("fullTimeEmployees"))

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
            stk_cd=symbol, stk_nm=profile.get("companyName", symbol),
            sector=profile.get("sector"), industry=profile.get("industry"),
            description=profile.get("description"), website=profile.get("website"),
            ceo=profile.get("ceo"), employees=employees,
            country=profile.get("country"), exchange=exchange,
            currency=profile.get("currency", "USD"), ipo_date=ipo_date,
            image_url=profile.get("image"), market_cap=market_cap,
            price=profile.get("price"), beta=profile.get("beta"),
            in_sp500=in_sp500, data_source='fmp', last_updated=datetime.utcnow(),
        ))


def _upsert_indx_member(session: Session, indx_cd: str, symbol: str,
                         name: str, sector: str, sub_sector: str, date_added_str: str) -> None:
    date_added = None
    if date_added_str:
        for fmt in ("%Y-%m-%d", "%B %d, %Y", "%Y"):
            try:
                date_added = datetime.strptime(date_added_str.strip(), fmt).date()
                break
            except (ValueError, TypeError):
                continue

    existing = session.query(MBS_IN_INDX_MEMBER).filter_by(indx_cd=indx_cd, stk_cd=symbol).first()
    if existing:
        if name:       existing.stk_nm     = name
        if sector:     existing.sector     = sector
        if sub_sector: existing.sub_sector = sub_sector
        existing.is_current = True
        existing.updated_at = datetime.utcnow()
    else:
        session.add(MBS_IN_INDX_MEMBER(
            indx_cd=indx_cd, stk_cd=symbol, stk_nm=name, sector=sector,
            sub_sector=sub_sector, date_added=date_added or date.today(), is_current=True,
        ))


def _upsert_relation(session: Session, stk_cd: str, related_cd: str, relation_type: str,
                     related_nm: str, detail: str, data_source: str, confidence: float = 0.85) -> None:
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
            stk_cd=stk_cd, related_cd=related_cd, relation_type=relation_type,
            related_nm=related_nm, detail=detail, confidence=confidence, data_source=data_source,
        ))


def save_to_database(session: Session, index_id: str, constituents: list, batch_id: str):
    """DB에 저장"""
    saved_count = 0
    updated_count = 0

    for constituent in constituents:
        try:
            ticker_cd = constituent['ticker_cd']
            existing = session.query(MBS_IN_STBD_MST).filter_by(ticker_cd=ticker_cd).first()

            if existing:
                existing.ticker_nm = constituent['ticker_nm']
                existing.sector = constituent.get('sector')
                existing.industry = constituent.get('industry')
                existing.exchange = constituent.get('exchange')
                existing.country = constituent.get('country', 'US')
                existing.is_active = True
                existing.data_source = f'github_{index_id}'
                existing.updated_at = datetime.utcnow()
                updated_count += 1
            else:
                session.add(MBS_IN_STBD_MST(
                    ticker_cd=ticker_cd, ticker_nm=constituent['ticker_nm'],
                    asset_type='stock', sector=constituent.get('sector'),
                    industry=constituent.get('industry'), exchange=constituent.get('exchange'),
                    country=constituent.get('country', 'US'), curr='USD',
                    data_source=f'github_{index_id}', is_active=True,
                    start_date=date.today(), created_at=datetime.utcnow(), updated_at=datetime.utcnow()
                ))
                saved_count += 1

        except Exception as e:
            log.error(f"Error saving ticker {constituent.get('ticker_cd')}: {e}")
            continue

    session.commit()
    log.info(f"Saved {saved_count} new tickers, updated {updated_count} existing tickers")
    return saved_count, updated_count


def update_index_metadata(session: Session, index_info: dict):
    """지수 메타데이터 업데이트"""
    try:
        indx_cd = index_info['indx_cd']
        existing = session.query(MBS_IN_INDX_STBD).filter_by(indx_cd=indx_cd).first()

        if existing:
            existing.indx_nm = index_info['indx_nm']
            existing.description = index_info['description']
            existing.category = index_info['category']
            existing.is_active = True
            existing.updated_at = datetime.utcnow()
        else:
            session.add(MBS_IN_INDX_STBD(
                indx_cd=indx_cd, indx_nm=index_info['indx_nm'],
                indx_type='universe', description=index_info['description'],
                category=index_info['category'], region='US', is_active=True,
                display_order=0, created_at=datetime.utcnow(), updated_at=datetime.utcnow()
            ))

        session.commit()
        log.info(f"Updated index metadata: {indx_cd}")
    except Exception as e:
        log.error(f"Error updating index metadata for {index_info['indx_cd']}: {e}")
        session.rollback()


# ── 핵심 수집 함수 ─────────────────────────────────────────────────────────────

def run_sp500_initial_collection(profile_limit: int = 0) -> dict:
    """S&P 500 전체 최초 수집 (1회성 + 월간 실행)"""
    log.info("=" * 70)
    log.info("[StockCollect] S&P 500 전체 수집 시작")
    log.info("=" * 70)

    stats = {"members": 0, "profiles": 0, "relations": 0, "errors": 0}

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
                _upsert_stbd_mst(session, symbol, item["name"], item["sector"], item["sub_sector"], "NYSE/NASDAQ", "US", "USD")
                _upsert_indx_member(session, "sp500", symbol, item["name"], item["sector"], item["sub_sector"], item.get("date_added", ""))
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

    target_members = members[:profile_limit] if profile_limit > 0 else members
    log.info(f"[StockCollect] 회사 프로필 수집 시작 ({len(target_members)}개)...")

    for i, item in enumerate(target_members):
        symbol = item.get("symbol", "")
        if not symbol:
            continue

        profile = fetch_company_profile(symbol)
        if not profile:
            stats["errors"] += 1
            time.sleep(_REQUEST_DELAY)
            continue

        session = default_db.get_session()
        try:
            _upsert_stk_profile(session, symbol, profile, in_sp500=True)
            _upsert_stbd_mst(
                session, symbol,
                profile.get("companyName", ""), profile.get("sector", ""),
                profile.get("industry", ""),
                profile.get("exchange") or profile.get("exchangeShortName", ""),
                profile.get("country", "US"), profile.get("currency", "USD"),
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

    sector_map: dict[str, str] = {item["symbol"]: item["sector"] for item in members if item.get("symbol")}

    for i, item in enumerate(target_members):
        symbol = item.get("symbol", "")
        base_sector = item.get("sector", "")
        if not symbol:
            continue

        peers = fetch_stock_peers(symbol)
        if peers:
            session = default_db.get_session()
            try:
                for peer in peers[:15]:
                    peer_sym = peer.get("symbol", "")
                    peer_nm = peer.get("companyName", peer_sym)
                    if not peer_sym or peer_sym == symbol:
                        continue
                    peer_sector = sector_map.get(peer_sym, "")
                    rel_type = "competitor" if (peer_sector == base_sector or not peer_sector) else "peer"
                    _upsert_relation(session, symbol, peer_sym, rel_type, peer_nm, f"{base_sector} sector peer", "fmp_peers", confidence=0.85)
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
    """일별 주식 가격·시총 갱신"""
    log.info("[StockCollect] 일별 프로필 가격 업데이트 시작")
    stats = {"updated": 0, "errors": 0}

    try:
        import yfinance as yf
    except ImportError:
        log.error("[StockCollect] yfinance 미설치 - pip install yfinance")
        return stats

    symbols = get_sp500_symbols()
    if not symbols:
        log.warning("[StockCollect] 일별 업데이트: DB에 S&P 500 종목 없음")
        return stats

    log.info(f"[StockCollect] {len(symbols)}개 종목 가격 갱신 중...")

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
                        price = getattr(info, "last_price", None)
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
    """주별 Peer 관계 갱신"""
    log.info("[StockCollect] 주별 Peer 관계 갱신 시작")
    stats = {"refreshed": 0, "errors": 0}

    session = default_db.get_session()
    try:
        rows = session.query(MBS_IN_INDX_MEMBER).filter_by(indx_cd="sp500", is_current=True).all()
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
                    peer_nm = peer.get("companyName", peer_sym)
                    if not peer_sym or peer_sym == symbol:
                        continue
                    peer_sector = sector_map.get(peer_sym, "")
                    rel_type = "competitor" if (peer_sector == base_sector or not peer_sector) else "peer"
                    _upsert_relation(session, symbol, peer_sym, rel_type, peer_nm, f"{base_sector} sector peer", "fmp_peers", confidence=0.85)
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


def run_index_constituents_download() -> dict:
    """GitHub CSV에서 S&P 500, NASDAQ 100, Dow 30 구성종목 다운로드"""
    from ..utils.db import get_sqlite_db, generate_batch_id

    log.info("=" * 60)
    log.info("지수 구성종목 다운로드 시작")
    log.info("=" * 60)

    DB_PATH = Path(__file__).parent.parent.parent / "data" / "marketpulse.db"
    db = get_sqlite_db(str(DB_PATH))
    db.create_tables()

    batch_id = generate_batch_id()
    session = db.get_session()
    total_saved = 0
    total_updated = 0

    try:
        for index_id, index_info in INDEX_URLS.items():
            log.info(f"\nProcessing {index_info['indx_nm']} ({index_id})")
            constituents = []

            if 'fallback' in index_info and index_info['fallback']:
                constituents = [
                    {
                        'ticker_cd': item['ticker_cd'], 'ticker_nm': item['ticker_nm'],
                        'sector': item.get('sector'), 'industry': item.get('industry'),
                        'exchange': 'NYSE/NASDAQ', 'country': 'US'
                    }
                    for item in index_info['fallback']
                ]
            elif index_info['url']:
                df = download_csv(index_info['url'])
                if df is None or df.empty:
                    log.warning(f"Skipping {index_id} - no data downloaded")
                    continue

                if index_id == 'sp500':
                    constituents = process_sp500(df)
                elif index_id == 'nasdaq100':
                    constituents = process_nasdaq100(df)
                elif index_id == 'dow30':
                    constituents = process_dow30(df)
                else:
                    log.warning(f"Unknown index: {index_id}")
                    continue

            if not constituents:
                log.warning(f"No constituents for {index_id}")
                continue

            log.info(f"Processed {len(constituents)} constituents")
            saved, updated = save_to_database(session, index_id, constituents, batch_id)
            total_saved += saved
            total_updated += updated
            update_index_metadata(session, index_info)

        log.info(f"\n다운로드 완료: {total_saved} 종목 추가, {total_updated} 종목 업데이트")

    except Exception as e:
        log.error(f"Error in run_index_constituents_download: {e}")
        session.rollback()
    finally:
        session.close()

    return {"saved": total_saved, "updated": total_updated}


# ── 쿼리 헬퍼 ─────────────────────────────────────────────────────────────────

def get_relations_from_db(symbol: str) -> List[dict]:
    """DB에서 종목 관계 조회"""
    session = default_db.get_session()
    try:
        rows = session.query(MBS_IN_STK_RELATIONS).filter_by(stk_cd=symbol).all()
        return [
            {
                "symbol": row.related_cd,
                "name": row.related_nm or row.related_cd,
                "type": row.relation_type,
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
        rows = session.query(MBS_IN_INDX_MEMBER).filter_by(indx_cd="sp500", is_current=True).all()
        return [r.stk_cd for r in rows]
    except Exception as e:
        log.error(f"S&P 500 심볼 조회 실패: {e}")
        return []
    finally:
        session.close()
