"""
Ticker Extractor - 뉴스에서 종목 티커 자동 추출 (DB 연동)
데이터베이스의 실제 S&P 500 종목 정보를 사용하여 티커 추출
"""
import re
from typing import List, Dict, Set, Optional
from pathlib import Path
from sqlalchemy.orm import Session

from ..utils.logging import get_logger

log = get_logger(__name__)

# 티커로 오인될 수 있는 일반 단어들
BLACKLIST_WORDS = {
    'USA', 'UK', 'EU', 'CEO', 'CFO', 'CTO', 'COO', 'CIO',
    'SEC', 'FDA', 'FBI', 'CIA', 'IPO', 'ETF', 'API', 'GDP',
    'NYC', 'LA', 'SF', 'DC', 'AI', 'IT', 'PR', 'HR', 'UN',
    'TV', 'US', 'RE', 'ARE', 'ALL', 'ON', 'SO', 'NOW', 'LOW',
    'BIG', 'HOT', 'KEY', 'VIA', 'GO', 'NO', 'TWO', 'ONE'
}


class TickerExtractor:
    """
    데이터베이스 기반 티커 추출기
    - DB에서 실제 S&P 500 종목 정보 로드
    - 회사명, 섹터 정보 활용
    - 명시적 패턴 ($AAPL) 및 회사명 매핑
    """

    def __init__(self, db_session: Optional[Session] = None):
        """
        Args:
            db_session: SQLAlchemy session (None이면 자동 생성)
        """
        self.ticker_db = {}
        self.company_to_ticker = {}
        self.sector_keywords = {}

        self._load_from_database(db_session)

        self.nlp = None
        try:
            import spacy
            self.nlp = spacy.load("en_core_web_sm")
            log.info("Spacy NER model loaded")
        except Exception as e:
            log.warning(f"Spacy not available: {e}. Using regex-only extraction.")

    def _load_from_database(self, db_session: Optional[Session] = None):
        """데이터베이스에서 티커 정보 로드"""
        try:
            if db_session is None:
                from ..utils.db import get_sqlite_db
                DB_PATH = Path(__file__).parent.parent.parent / "data" / "marketpulse.db"
                db = get_sqlite_db(str(DB_PATH))
                session = db.get_session()
                close_session = True
            else:
                session = db_session
                close_session = False

            from ..models.orm import MBS_IN_STBD_MST
            tickers = session.query(MBS_IN_STBD_MST).filter_by(is_active=True).all()

            log.info(f"Loading {len(tickers)} tickers from database...")

            for ticker in tickers:
                symbol = ticker.ticker_cd

                self.ticker_db[symbol] = {
                    'name': ticker.ticker_nm,
                    'exchange': ticker.exchange or 'UNKNOWN',
                    'sector': ticker.sector or 'Unknown',
                    'industry': ticker.industry or 'Unknown'
                }

                if ticker.ticker_nm:
                    company_name = ticker.ticker_nm.lower()
                    clean_name = re.sub(r'[,\(\)\[\]{}]', '', company_name).strip()
                    self.company_to_ticker[clean_name] = symbol

                    base_name = clean_name
                    for suffix in [' inc.', ' inc', ' corporation', ' corp.', ' corp', ' ltd.', ' ltd', ' llc', ' co.', ' co', ' plc', ' group', ' company']:
                        base_name = base_name.replace(suffix, '')
                    base_name = base_name.strip()

                    if base_name and base_name != clean_name:
                        self.company_to_ticker[base_name] = symbol

                    words = base_name.split()
                    if len(words) == 1 and len(base_name) > 3:
                        self.company_to_ticker[base_name] = symbol
                    elif len(words) > 1:
                        first_word = words[0]
                        if len(first_word) > 5 and first_word not in {'morgan', 'stanley', 'american', 'general', 'global', 'international', 'national', 'financial', 'capital'}:
                            self.company_to_ticker[first_word] = symbol

                if ticker.sector:
                    if ticker.sector not in self.sector_keywords:
                        self.sector_keywords[ticker.sector] = []
                    self.sector_keywords[ticker.sector].append({
                        'symbol': symbol,
                        'name': ticker.ticker_nm,
                        'keywords': self._generate_keywords(ticker.ticker_nm)
                    })

            if close_session:
                session.close()

            log.info(f"Loaded {len(self.ticker_db)} tickers from database")
            log.info(f"Created {len(self.company_to_ticker)} company name mappings")
            log.info(f"Indexed {len(self.sector_keywords)} sectors")

        except Exception as e:
            log.error(f"Error loading from database: {e}")
            log.warning("Falling back to minimal ticker set...")
            self._init_minimal_tickers()

    def _generate_keywords(self, company_name: str) -> List[str]:
        """회사명에서 검색 키워드 생성"""
        if not company_name:
            return []

        keywords = []
        name_lower = company_name.lower()
        keywords.append(name_lower)

        for suffix in [' inc.', ' inc', ' corporation', ' corp.', ' corp', ' ltd.', ' ltd', ' llc', ' co.', ' co', ' plc', ' group']:
            name_lower = name_lower.replace(suffix, '')

        keywords.append(name_lower.strip())

        words = name_lower.strip().split()
        for word in words:
            if len(word) > 3 and word not in {'the', 'and', 'for', 'of'}:
                keywords.append(word)

        return list(set(keywords))

    def _init_minimal_tickers(self):
        """DB 로드 실패 시 FMP API에서 가장 활발한 종목 로드"""
        try:
            import sys
            sys.path.insert(0, str(Path(__file__).parent.parent.parent))
            from data_fetcher.fetchers.fmp.active_stocks import FMPActiveStocksFetcher

            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            active_stocks = loop.run_until_complete(
                FMPActiveStocksFetcher.fetch_data({'type': 'actives'})
            )
            loop.close()

            if active_stocks:
                minimal_mapping = {}
                for stock in active_stocks[:20]:
                    minimal_mapping[stock.symbol] = {
                        'name': stock.name,
                        'exchange': 'NASDAQ'
                    }

                self.ticker_db = minimal_mapping
                for symbol, info in minimal_mapping.items():
                    name_lower = info['name'].lower()
                    self.company_to_ticker[name_lower] = symbol
                    base_name = name_lower.split()[0]
                    self.company_to_ticker[base_name] = symbol

                log.info(f"Loaded {len(minimal_mapping)} active stocks from FMP API")
                return
        except Exception as e:
            log.error(f"Error fetching active stocks from FMP: {e}")

        self.ticker_db = {}
        self.company_to_ticker = {}

    def extract(self, text: str, title: str = "") -> List[Dict]:
        """
        텍스트에서 티커 추출

        Returns:
            List of dicts: [{'symbol': 'AAPL', 'name': '...', 'confidence': 0.95, ...}]
        """
        found_tickers = {}
        full_text = f"{title} {text}".lower()

        explicit_tickers = self._extract_explicit_tickers(full_text)
        for symbol, mentions in explicit_tickers.items():
            if symbol in self.ticker_db:
                found_tickers[symbol] = {
                    'symbol': symbol,
                    'name': self.ticker_db[symbol]['name'],
                    'exchange': self.ticker_db[symbol].get('exchange', 'UNKNOWN'),
                    'sector': self.ticker_db[symbol].get('sector', 'Unknown'),
                    'confidence': 0.95,
                    'mentions': mentions,
                    'in_title': symbol.lower() in title.lower()
                }

        company_tickers = self._extract_from_companies(full_text, title)
        for symbol, info in company_tickers.items():
            if symbol not in found_tickers:
                found_tickers[symbol] = info
            else:
                found_tickers[symbol]['mentions'] += info['mentions']
                found_tickers[symbol]['confidence'] = max(found_tickers[symbol]['confidence'], info['confidence'])

        if self.nlp:
            ner_tickers = self._extract_from_ner(text)
            for symbol, info in ner_tickers.items():
                if symbol not in found_tickers:
                    found_tickers[symbol] = info

        return sorted(
            found_tickers.values(),
            key=lambda x: (x['confidence'], x['mentions']),
            reverse=True
        )

    def _extract_explicit_tickers(self, text: str) -> Dict[str, int]:
        """명시적 티커 패턴 추출: $AAPL, (TSLA), NASDAQ:NVDA"""
        tickers = {}

        for match in re.finditer(r'\$([A-Z]{1,5})\b', text.upper()):
            symbol = match.group(1)
            if symbol not in BLACKLIST_WORDS and symbol in self.ticker_db:
                tickers[symbol] = tickers.get(symbol, 0) + 1

        for match in re.finditer(r'\(([A-Z]{1,5})\)', text.upper()):
            symbol = match.group(1)
            if symbol not in BLACKLIST_WORDS and symbol in self.ticker_db:
                tickers[symbol] = tickers.get(symbol, 0) + 1

        for match in re.finditer(r'\b(NYSE|NASDAQ|AMEX):([A-Z]{1,5})\b', text.upper()):
            symbol = match.group(2)
            if symbol not in BLACKLIST_WORDS and symbol in self.ticker_db:
                tickers[symbol] = tickers.get(symbol, 0) + 1

        return tickers

    def _extract_from_companies(self, text: str, title: str = "") -> Dict[str, Dict]:
        """회사명 기반 티커 추출"""
        found = {}
        text_lower = text.lower()
        title_lower = title.lower()

        for company_name, symbol in self.company_to_ticker.items():
            if len(company_name) < 3:
                continue

            pattern = r'\b' + re.escape(company_name) + r'\b'
            matches_text = len(re.findall(pattern, text_lower, re.IGNORECASE))
            matches_title = len(re.findall(pattern, title_lower, re.IGNORECASE))
            total_mentions = matches_text + matches_title

            if total_mentions > 0:
                confidence = 0.75 if matches_title > 0 else 0.65
                confidence += min(total_mentions * 0.05, 0.15)

                if symbol in self.ticker_db:
                    found[symbol] = {
                        'symbol': symbol,
                        'name': self.ticker_db[symbol]['name'],
                        'exchange': self.ticker_db[symbol].get('exchange', 'UNKNOWN'),
                        'sector': self.ticker_db[symbol].get('sector', 'Unknown'),
                        'confidence': min(confidence, 0.95),
                        'mentions': total_mentions,
                        'in_title': matches_title > 0
                    }

        return found

    def _extract_from_ner(self, text: str) -> Dict[str, Dict]:
        """NER (Named Entity Recognition) 기반 회사명 추출"""
        if not self.nlp:
            return {}

        found = {}
        doc = self.nlp(text[:10000])

        for ent in doc.ents:
            if ent.label_ in ['ORG', 'PRODUCT']:
                entity_text = ent.text.lower()
                for company_name, symbol in self.company_to_ticker.items():
                    if company_name in entity_text or entity_text in company_name:
                        if symbol in self.ticker_db and symbol not in found:
                            found[symbol] = {
                                'symbol': symbol,
                                'name': self.ticker_db[symbol]['name'],
                                'exchange': self.ticker_db[symbol].get('exchange', 'UNKNOWN'),
                                'sector': self.ticker_db[symbol].get('sector', 'Unknown'),
                                'confidence': 0.70,
                                'mentions': 1,
                                'in_title': False
                            }

        return found

    def get_ticker_info(self, symbol: str) -> Optional[Dict]:
        """특정 티커의 상세 정보 조회"""
        return self.ticker_db.get(symbol)

    def search_by_sector(self, sector: str) -> List[Dict]:
        """섹터로 종목 검색"""
        return self.sector_keywords.get(sector, [])

    def get_all_sectors(self) -> List[str]:
        """모든 섹터 목록"""
        return list(self.sector_keywords.keys())
