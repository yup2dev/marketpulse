"""
Ticker Extractor - 뉴스에서 종목 티커 자동 추출
"""
import re
import logging
from typing import List, Dict, Set, Optional
from pathlib import Path
import json

log = logging.getLogger(__name__)

# 티커로 오인될 수 있는 일반 단어들
BLACKLIST_WORDS = {
    'USA', 'UK', 'EU', 'CEO', 'CFO', 'CTO', 'COO', 'CIO',
    'SEC', 'FDA', 'FBI', 'CIA', 'IPO', 'ETF', 'API', 'GDP',
    'NYC', 'LA', 'SF', 'DC', 'AI', 'IT', 'PR', 'HR', 'UN'
}


class TickerExtractor:
    """
    텍스트에서 주식 티커 추출
    - 명시적 티커 패턴 ($AAPL, (TSLA), NASDAQ:NVDA)
    - 회사명 → 티커 매핑
    - NER 기반 회사명 인식 (선택사항)
    """

    def __init__(self, ticker_db_path: Optional[str] = None):
        """
        Args:
            ticker_db_path: 티커 데이터베이스 JSON 파일 경로
        """
        self.ticker_db = {}
        self.company_to_ticker = {}

        if ticker_db_path:
            self._load_ticker_database(ticker_db_path)
        else:
            # 기본 주요 티커 매핑
            self._init_default_tickers()

        # NLP 모델 (선택사항 - spacy 설치 필요)
        self.nlp = None
        try:
            import spacy
            self.nlp = spacy.load("en_core_web_sm")
            log.info("Spacy NER model loaded")
        except Exception as e:
            log.warning(f"Spacy not available: {e}. Using regex-only extraction.")

    def _init_default_tickers(self):
        """기본 주요 종목 매핑 초기화"""
        default_mapping = {
            # Tech Giants (FAANG+)
            'Apple': 'AAPL', 'apple inc': 'AAPL', 'apple inc.': 'AAPL',
            'Microsoft': 'MSFT', 'microsoft corp': 'MSFT', 'microsoft corporation': 'MSFT',
            'Google': 'GOOGL', 'alphabet': 'GOOGL', 'alphabet inc': 'GOOGL',
            'Amazon': 'AMZN', 'amazon.com': 'AMZN', 'amazon inc': 'AMZN',
            'Meta': 'META', 'facebook': 'META', 'meta platforms': 'META',
            'Netflix': 'NFLX', 'netflix inc': 'NFLX',
            'Tesla': 'TSLA', 'tesla inc': 'TSLA', 'tesla motors': 'TSLA',
            'NVIDIA': 'NVDA', 'nvidia corp': 'NVDA', 'nvidia corporation': 'NVDA',

            # Finance
            'JPMorgan': 'JPM', 'jp morgan': 'JPM', 'jpmorgan chase': 'JPM',
            'Goldman Sachs': 'GS', 'goldman': 'GS',
            'Bank of America': 'BAC', 'bofa': 'BAC',
            'Wells Fargo': 'WFC',
            'Morgan Stanley': 'MS',

            # Retail
            'Walmart': 'WMT', 'wal-mart': 'WMT',
            'Target': 'TGT', 'target corp': 'TGT',
            'Costco': 'COST', 'costco wholesale': 'COST',

            # Energy
            'ExxonMobil': 'XOM', 'exxon mobil': 'XOM', 'exxon': 'XOM',
            'Chevron': 'CVX', 'chevron corp': 'CVX',

            # Healthcare
            'Johnson & Johnson': 'JNJ', 'j&j': 'JNJ',
            'Pfizer': 'PFE', 'pfizer inc': 'PFE',
            'UnitedHealth': 'UNH', 'unitedhealth group': 'UNH',

            # Crypto-related
            'Coinbase': 'COIN', 'coinbase global': 'COIN',
            'MicroStrategy': 'MSTR',
        }

        for company, ticker in default_mapping.items():
            self.company_to_ticker[company.lower()] = ticker
            if ticker not in self.ticker_db:
                self.ticker_db[ticker] = {
                    'symbol': ticker,
                    'name': company,
                    'exchange': 'NASDAQ' if ticker in ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NFLX', 'TSLA', 'NVDA'] else 'NYSE'
                }

    def _load_ticker_database(self, db_path: str):
        """티커 데이터베이스 로드"""
        try:
            with open(db_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.ticker_db = data.get('tickers', {})
                self.company_to_ticker = data.get('company_map', {})
            log.info(f"Loaded {len(self.ticker_db)} tickers from {db_path}")
        except Exception as e:
            log.error(f"Failed to load ticker database: {e}")
            self._init_default_tickers()

    def extract(self, text: str, title: str = "") -> List[Dict]:
        """
        텍스트에서 티커 추출

        Args:
            text: 기사 본문
            title: 기사 제목 (가중치 부여용)

        Returns:
            추출된 티커 정보 리스트
        """
        tickers = {}

        # 전체 텍스트 (제목 + 본문)
        full_text = f"{title} {text}"

        # 1. 명시적 티커 패턴 추출
        explicit_tickers = self._extract_explicit_tickers(full_text)
        for ticker in explicit_tickers:
            tickers[ticker] = {
                'symbol': ticker,
                'confidence': 0.95,
                'mention_count': full_text.upper().count(ticker),
                'source': 'explicit_pattern'
            }

        # 2. 회사명 매핑
        company_tickers = self._extract_from_companies(full_text)
        for ticker, count in company_tickers.items():
            if ticker in tickers:
                tickers[ticker]['mention_count'] += count
            else:
                tickers[ticker] = {
                    'symbol': ticker,
                    'confidence': 0.85,
                    'mention_count': count,
                    'source': 'company_name'
                }

        # 3. NER 기반 회사명 추출 (spacy 사용 가능시)
        if self.nlp:
            ner_tickers = self._extract_from_ner(full_text)
            for ticker, count in ner_tickers.items():
                if ticker in tickers:
                    tickers[ticker]['mention_count'] += count
                    tickers[ticker]['confidence'] = max(tickers[ticker]['confidence'], 0.75)
                else:
                    tickers[ticker] = {
                        'symbol': ticker,
                        'confidence': 0.75,
                        'mention_count': count,
                        'source': 'ner'
                    }

        # 4. 티커 정보 보강
        result = []
        for ticker, data in tickers.items():
            info = self.ticker_db.get(ticker, {})
            enriched = {
                'symbol': ticker,
                'name': info.get('name', ''),
                'exchange': info.get('exchange', ''),
                'confidence': data['confidence'],
                'mention_count': data['mention_count'],
                'source': data['source']
            }

            # 제목에 포함된 티커는 신뢰도 상승
            if ticker in title.upper():
                enriched['confidence'] = min(enriched['confidence'] + 0.1, 1.0)

            result.append(enriched)

        # 신뢰도 순으로 정렬
        result.sort(key=lambda x: (x['confidence'], x['mention_count']), reverse=True)

        return result

    def _extract_explicit_tickers(self, text: str) -> Set[str]:
        """명시적 티커 패턴 추출"""
        patterns = [
            r'\$([A-Z]{1,5})\b',  # $AAPL
            r'\(([A-Z]{2,5})\)',   # (AAPL)
            r'(?:NYSE|NASDAQ|AMEX):([A-Z]{1,5})\b',  # NASDAQ:AAPL
            r'\b([A-Z]{2,5})\s+(?:stock|shares|shares)\b',  # AAPL stock
        ]

        tickers = set()
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                ticker = match.upper()
                # 블랙리스트 필터링
                if ticker not in BLACKLIST_WORDS and len(ticker) >= 2:
                    tickers.add(ticker)

        return tickers

    def _extract_from_companies(self, text: str) -> Dict[str, int]:
        """회사명에서 티커 추출"""
        ticker_counts = {}

        # 회사명 매핑을 통한 추출
        for company, ticker in self.company_to_ticker.items():
            # 대소문자 무시하고 검색
            pattern = re.compile(r'\b' + re.escape(company) + r'\b', re.IGNORECASE)
            matches = pattern.findall(text)

            if matches:
                ticker_counts[ticker] = ticker_counts.get(ticker, 0) + len(matches)

        return ticker_counts

    def _extract_from_ner(self, text: str) -> Dict[str, int]:
        """NER을 이용한 회사명 추출"""
        if not self.nlp:
            return {}

        ticker_counts = {}

        try:
            # 텍스트가 너무 길면 잘라서 처리
            max_length = 1000000  # spacy 기본 제한
            if len(text) > max_length:
                text = text[:max_length]

            doc = self.nlp(text)

            # ORG 엔티티 추출
            for ent in doc.ents:
                if ent.label_ == "ORG":
                    company = ent.text
                    # 회사명 → 티커 매핑
                    ticker = self.company_to_ticker.get(company.lower())
                    if ticker:
                        ticker_counts[ticker] = ticker_counts.get(ticker, 0) + 1

        except Exception as e:
            log.warning(f"NER extraction failed: {e}")

        return ticker_counts

    def validate_ticker(self, symbol: str) -> bool:
        """티커 유효성 검증"""
        # 기본 형식 검증
        if not symbol or len(symbol) < 1 or len(symbol) > 5:
            return False

        if not symbol.isalpha() or not symbol.isupper():
            return False

        if symbol in BLACKLIST_WORDS:
            return False

        # 데이터베이스에 있는지 확인
        if symbol in self.ticker_db:
            return True

        # yfinance로 실시간 검증 (선택사항)
        # try:
        #     import yfinance as yf
        #     ticker = yf.Ticker(symbol)
        #     info = ticker.info
        #     return 'symbol' in info
        # except:
        #     return False

        return True

    def add_ticker(self, symbol: str, name: str, exchange: str = ""):
        """티커 데이터베이스에 추가"""
        self.ticker_db[symbol] = {
            'symbol': symbol,
            'name': name,
            'exchange': exchange
        }
        self.company_to_ticker[name.lower()] = symbol
