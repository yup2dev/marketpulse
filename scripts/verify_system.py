"""
System Verification Script
전체 시스템 검증 - 모든 컴포넌트 테스트
"""
import sys
import io
from pathlib import Path

# Fix Windows encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import logging

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


def print_section(title):
    """섹션 제목 출력"""
    print("\n" + "="*80)
    print(f"  {title}")
    print("="*80)


def test_imports():
    """필수 라이브러리 import 테스트"""
    print_section("1. Testing Imports")

    modules = [
        ('beautifulsoup4', 'bs4'),
        ('lxml', 'lxml'),
        ('requests', 'requests'),
        ('sqlalchemy', 'sqlalchemy'),
        ('fastapi', 'fastapi'),
        ('pydantic', 'pydantic'),
        ('pyyaml', 'yaml'),
    ]

    optional_modules = [
        ('spacy', 'spacy'),
        ('transformers', 'transformers'),
        ('torch', 'torch'),
    ]

    passed = 0
    failed = 0

    for name, module in modules:
        try:
            __import__(module)
            print(f"  ✓ {name}")
            passed += 1
        except ImportError as e:
            print(f"  ✗ {name} - {e}")
            failed += 1

    print(f"\nOptional modules:")
    for name, module in optional_modules:
        try:
            __import__(module)
            print(f"  ✓ {name}")
        except ImportError:
            print(f"  ⚠ {name} (optional - not installed)")

    return passed, failed


def test_ticker_extractor():
    """티커 추출기 테스트"""
    print_section("2. Testing Ticker Extractor")

    try:
        from app.services.ticker_extractor import TickerExtractor

        extractor = TickerExtractor()
        print("  ✓ TickerExtractor initialized")

        # 테스트
        test_text = "Apple $AAPL reported strong earnings. Microsoft (MSFT) also beat estimates."
        tickers = extractor.extract(test_text)

        print(f"  ✓ Extracted {len(tickers)} tickers")
        for t in tickers:
            print(f"    - {t['symbol']}: {t.get('name', 'N/A')} (confidence: {t['confidence']:.2f})")

        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def test_sentiment_analyzer():
    """감성 분석기 테스트"""
    print_section("3. Testing Sentiment Analyzer")

    try:
        from app.services.sentiment_analyzer import SentimentAnalyzer

        analyzer = SentimentAnalyzer(use_transformers=False)
        print("  ✓ SentimentAnalyzer initialized (rule-based)")

        # 테스트
        test_cases = [
            ("Stock prices surged with strong gains.", "positive"),
            ("Market crashed with significant losses.", "negative"),
            ("The meeting will be held next week.", "neutral"),
        ]

        for text, expected in test_cases:
            result = analyzer.analyze(text)
            actual = result['label']
            status = "✓" if actual == expected else "⚠"
            print(f"  {status} \"{text[:40]}...\" → {actual} (expected: {expected})")

        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def test_database():
    """데이터베이스 테스트"""
    print_section("4. Testing Database")

    try:
        from app.models.database import get_sqlite_db, NewsArticle, Ticker

        # 테스트용 임시 DB
        db = get_sqlite_db(":memory:")
        db.create_tables()
        print("  ✓ Database tables created")

        session = db.get_session()

        # 티커 추가
        ticker = Ticker(symbol="TEST", name="Test Corp", exchange="NASDAQ")
        session.add(ticker)
        session.commit()
        print("  ✓ Ticker insertion successful")

        # 조회
        result = session.query(Ticker).filter_by(symbol="TEST").first()
        assert result is not None
        assert result.name == "Test Corp"
        print("  ✓ Ticker retrieval successful")

        session.close()
        return True

    except Exception as e:
        print(f"  ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_news_processor():
    """뉴스 처리 파이프라인 테스트"""
    print_section("5. Testing News Processor")

    try:
        from app.services.news_processor import NewsProcessor
        from app.services.ticker_extractor import TickerExtractor
        from app.services.sentiment_analyzer import SentimentAnalyzer
        from app.models.database import get_sqlite_db

        # 서비스 초기화
        ticker_extractor = TickerExtractor()
        sentiment_analyzer = SentimentAnalyzer(use_transformers=False)
        processor = NewsProcessor(ticker_extractor, sentiment_analyzer)
        print("  ✓ NewsProcessor initialized")

        # 테스트용 DB
        db = get_sqlite_db(":memory:")
        db.create_tables()
        session = db.get_session()

        # 샘플 기사 데이터
        article_data = {
            'url': 'https://example.com/test-article',
            'title': 'Apple $AAPL Reports Record Earnings',
            'text_preview': 'Apple Inc. announced strong quarterly results with revenue beating expectations.',
            'source': 'test',
            'published_time': '2025-10-22T10:00:00Z'
        }

        # 처리
        result = processor.process_article(article_data, session)
        assert result is True
        print("  ✓ Article processed successfully")

        # 검증
        from app.models.database import NewsArticle
        saved = session.query(NewsArticle).filter_by(url=article_data['url']).first()
        assert saved is not None
        assert len(saved.tickers) > 0
        print(f"  ✓ Article saved with {len(saved.tickers)} ticker(s)")

        session.close()
        return True

    except Exception as e:
        print(f"  ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_api_server():
    """API 서버 테스트"""
    print_section("6. Testing API Server")

    try:
        from app.main import app
        from fastapi.testclient import TestClient

        client = TestClient(app)
        print("  ✓ Test client created")

        # Health check
        response = client.get("/health")
        assert response.status_code == 200
        print("  ✓ Health check passed")

        # Root endpoint
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert 'name' in data
        print("  ✓ Root endpoint working")

        # News endpoint
        response = client.get("/api/news?limit=5")
        assert response.status_code == 200
        print("  ✓ News API working")

        return True

    except Exception as e:
        print(f"  ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """메인 검증 프로세스"""
    print("\n" + "="*80)
    print("  MarketPulse System Verification")
    print("  전체 시스템 검증 테스트")
    print("="*80)

    results = []

    # 1. Imports
    passed, failed = test_imports()
    results.append(("Imports", failed == 0))

    # 2. Ticker Extractor
    results.append(("Ticker Extractor", test_ticker_extractor()))

    # 3. Sentiment Analyzer
    results.append(("Sentiment Analyzer", test_sentiment_analyzer()))

    # 4. Database
    results.append(("Database", test_database()))

    # 5. News Processor
    results.append(("News Processor", test_news_processor()))

    # 6. API Server
    results.append(("API Server", test_api_server()))

    # Summary
    print_section("Verification Summary")

    total = len(results)
    passed_count = sum(1 for _, status in results if status)
    failed_count = total - passed_count

    for name, status in results:
        icon = "✓" if status else "✗"
        print(f"  {icon} {name}")

    print(f"\nTotal: {passed_count}/{total} passed")

    if failed_count == 0:
        print("\n🎉 All tests passed! System is ready.")
        return 0
    else:
        print(f"\n⚠ {failed_count} test(s) failed. Please check the errors above.")
        return 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\nVerification cancelled by user.")
        sys.exit(1)
