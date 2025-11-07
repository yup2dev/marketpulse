"""
Ticker Extractor - 뉴스에서 종목 티커 자동 추출 (DB 연동)
데이터베이스의 실제 S&P 500 종목 정보를 사용하여 티커 추출
"""
import re
import logging
from typing import List, Dict, Set, Optional
from pathlib import Path
from sqlalchemy.orm import Session

log = logging.getLogger(__name__)

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
        self.ticker_db = {}  # symbol -> info
        self.company_to_ticker = {}  # company name -> symbol
        self.sector_keywords = {}  # sector -> list of companies

        # DB에서 티커 정보 로드
        self._load_from_database(db_session)

        # NLP 모델 (선택사항)
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
            # DB 세션 생성
            if db_session is None:
                from app.models.database import get_sqlite_db
                from pathlib import Path
                DB_PATH = Path(__file__).parent.parent.parent / "data" / "marketpulse.db"
                db = get_sqlite_db(str(DB_PATH))
                session = db.get_session()
                close_session = True
            else:
                session = db_session
                close_session = False

            # Ticker 테이블에서 모든 종목 로드
            from app.models.database import Ticker
            tickers = session.query(Ticker).all()

            log.info(f"Loading {len(tickers)} tickers from database...")

            for ticker in tickers:
                symbol = ticker.symbol

                # 티커 정보 저장
                self.ticker_db[symbol] = {
                    'name': ticker.name,
                    'exchange': ticker.exchange or 'UNKNOWN',
                    'sector': ticker.sector or 'Unknown',
                    'industry': ticker.industry or 'Unknown'
                }

                # 회사명 → 티커 매핑 생성
                if ticker.name:
                    # 전체 이름 (구두점 제거)
                    company_name = ticker.name.lower()
                    # 쉼표, 괄호 등 제거
                    clean_name = re.sub(r'[,\(\)\[\]{}]', '', company_name).strip()
                    self.company_to_ticker[clean_name] = symbol

                    # 일반적인 변형들
                    # "Apple Inc." -> "apple", "apple inc"
                    base_name = clean_name
                    for suffix in [' inc.', ' inc', ' corporation', ' corp.', ' corp', ' ltd.', ' ltd', ' llc', ' co.', ' co', ' plc', ' group', ' company']:
                        base_name = base_name.replace(suffix, '')
                    base_name = base_name.strip()

                    if base_name and base_name != clean_name:
                        self.company_to_ticker[base_name] = symbol

                    # 단일 단어 이름 처리 (예: "Tesla", "Apple", "Amazon")
                    words = base_name.split()
                    if len(words) == 1 and len(base_name) > 3:
                        # 단일 단어 회사명만 추가 (예: Tesla, Apple)
                        self.company_to_ticker[base_name] = symbol
                    elif len(words) > 1:
                        # 여러 단어인 경우, 첫 단어가 충분히 독특하면 추가
                        first_word = words[0]
                        if len(first_word) > 5 and first_word not in {'morgan', 'stanley', 'american', 'general', 'global', 'international', 'national', 'financial', 'capital'}:
                            self.company_to_ticker[first_word] = symbol

                # 섹터별 분류
                if ticker.sector:
                    if ticker.sector not in self.sector_keywords:
                        self.sector_keywords[ticker.sector] = []
                    self.sector_keywords[ticker.sector].append({
                        'symbol': symbol,
                        'name': ticker.name,
                        'keywords': self._generate_keywords(ticker.name)
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

        # 전체 이름
        keywords.append(name_lower)

        # 법인 형태 제거
        for suffix in [' inc.', ' inc', ' corporation', ' corp.', ' corp', ' ltd.', ' ltd', ' llc', ' co.', ' co', ' plc', ' group']:
            name_lower = name_lower.replace(suffix, '')

        keywords.append(name_lower.strip())

        # 단어별 분리
        words = name_lower.strip().split()
        for word in words:
            if len(word) > 3 and word not in {'the', 'and', 'for', 'of'}:
                keywords.append(word)

        return list(set(keywords))

    def _init_minimal_tickers(self):
        """DB 로드 실패 시 최소한의 주요 종목"""
        minimal_mapping = {
            'AAPL': {'name': 'Apple Inc.', 'exchange': 'NASDAQ'},
            'MSFT': {'name': 'Microsoft Corporation', 'exchange': 'NASDAQ'},
            'GOOGL': {'name': 'Alphabet Inc.', 'exchange': 'NASDAQ'},
            'AMZN': {'name': 'Amazon.com Inc.', 'exchange': 'NASDAQ'},
            'TSLA': {'name': 'Tesla Inc.', 'exchange': 'NASDAQ'},
            'META': {'name': 'Meta Platforms Inc.', 'exchange': 'NASDAQ'},
            'NVDA': {'name': 'NVIDIA Corporation', 'exchange': 'NASDAQ'},
        }

        self.ticker_db = minimal_mapping
        for symbol, info in minimal_mapping.items():
            name_lower = info['name'].lower()
            self.company_to_ticker[name_lower] = symbol
            base_name = name_lower.split()[0]
            self.company_to_ticker[base_name] = symbol

    def extract(self, text: str, title: str = "") -> List[Dict]:
        """
        텍스트에서 티커 추출

        Args:
            text: 분석할 텍스트
            title: 제목 (선택사항, 더 높은 가중치)

        Returns:
            List of dicts: [{'symbol': 'AAPL', 'name': 'Apple Inc.', 'confidence': 0.95, ...}]
        """
        found_tickers = {}
        full_text = f"{title} {text}".lower()

        # 1. 명시적 티커 패턴 추출 ($AAPL, (TSLA), NASDAQ:NVDA)
        explicit_tickers = self._extract_explicit_tickers(full_text)
        for symbol, mentions in explicit_tickers.items():
            if symbol in self.ticker_db:
                found_tickers[symbol] = {
                    'symbol': symbol,
                    'name': self.ticker_db[symbol]['name'],
                    'exchange': self.ticker_db[symbol].get('exchange', 'UNKNOWN'),
                    'sector': self.ticker_db[symbol].get('sector', 'Unknown'),
                    'confidence': 0.95,  # 명시적 패턴은 높은 신뢰도
                    'mentions': mentions,
                    'in_title': symbol.lower() in title.lower()
                }

        # 2. 회사명 매핑 추출
        company_tickers = self._extract_from_companies(full_text, title)
        for symbol, info in company_tickers.items():
            if symbol not in found_tickers:
                found_tickers[symbol] = info
            else:
                # 기존 티커 정보 업데이트 (언급 횟수 추가)
                found_tickers[symbol]['mentions'] += info['mentions']
                found_tickers[symbol]['confidence'] = max(found_tickers[symbol]['confidence'], info['confidence'])

        # 3. NER 기반 추출 (spacy 사용)
        if self.nlp:
            ner_tickers = self._extract_from_ner(text)
            for symbol, info in ner_tickers.items():
                if symbol not in found_tickers:
                    found_tickers[symbol] = info

        # 결과 정렬 (신뢰도 및 언급 횟수 기준)
        result = sorted(
            found_tickers.values(),
            key=lambda x: (x['confidence'], x['mentions']),
            reverse=True
        )

        return result

    def _extract_explicit_tickers(self, text: str) -> Dict[str, int]:
        """명시적 티커 패턴 추출: $AAPL, (TSLA), NASDAQ:NVDA"""
        tickers = {}

        # Pattern 1: $SYMBOL
        for match in re.finditer(r'\$([A-Z]{1,5})\b', text.upper()):
            symbol = match.group(1)
            if symbol not in BLACKLIST_WORDS and symbol in self.ticker_db:
                tickers[symbol] = tickers.get(symbol, 0) + 1

        # Pattern 2: (SYMBOL)
        for match in re.finditer(r'\(([A-Z]{1,5})\)', text.upper()):
            symbol = match.group(1)
            if symbol not in BLACKLIST_WORDS and symbol in self.ticker_db:
                tickers[symbol] = tickers.get(symbol, 0) + 1

        # Pattern 3: EXCHANGE:SYMBOL
        for match in re.finditer(r'\b(NYSE|NASDAQ|AMEX):([A-Z]{1,5})\b', text.upper()):
            symbol = match.group(2)
            if symbol not in BLACKLIST_WORDS and symbol in self.ticker_db:
                tickers[symbol] = tickers.get(symbol, 0) + 1

        return tickers

    def _extract_from_companies(self, text: str, title: str = "") -> Dict[str, Dict]:
        """회사명 기반 티커 추출 (대소문자 구분 없이)"""
        found = {}
        text_lower = text.lower()
        title_lower = title.lower()

        for company_name, symbol in self.company_to_ticker.items():
            if len(company_name) < 3:  # 너무 짧은 이름 제외
                continue

            # 회사명 검색 (대소문자 구분 없이, 단어 경계 고려)
            # re.IGNORECASE 플래그 사용
            pattern = r'\b' + re.escape(company_name) + r'\b'

            # text와 title에서 패턴 검색 (대소문자 무시)
            matches_text = len(re.findall(pattern, text_lower, re.IGNORECASE))
            matches_title = len(re.findall(pattern, title_lower, re.IGNORECASE))

            total_mentions = matches_text + matches_title

            if total_mentions > 0:
                # 제목에 있으면 신뢰도 상승
                confidence = 0.75 if matches_title > 0 else 0.65
                # 여러 번 언급되면 신뢰도 상승
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
        doc = self.nlp(text[:10000])  # 성능을 위해 앞부분만

        for ent in doc.ents:
            if ent.label_ in ['ORG', 'PRODUCT']:
                entity_text = ent.text.lower()

                # 추출된 개체가 알려진 회사명과 매칭되는지 확인
                for company_name, symbol in self.company_to_ticker.items():
                    if company_name in entity_text or entity_text in company_name:
                        if symbol in self.ticker_db and symbol not in found:
                            found[symbol] = {
                                'symbol': symbol,
                                'name': self.ticker_db[symbol]['name'],
                                'exchange': self.ticker_db[symbol].get('exchange', 'UNKNOWN'),
                                'sector': self.ticker_db[symbol].get('sector', 'Unknown'),
                                'confidence': 0.70,  # NER 기반은 중간 신뢰도
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
