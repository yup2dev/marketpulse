# MarketPulse - Market Data Guide

## 📊 포함된 마켓 데이터

MarketPulse는 다음과 같은 실제 금융 시장 데이터를 **동적으로** 로드합니다:

### 1. S&P 500 전체 종목 (503개 - Wikipedia에서 실시간 로드)

#### Technology Sector
- **AAPL** - Apple Inc.
- **MSFT** - Microsoft Corporation
- **NVDA** - NVIDIA Corporation
- **GOOGL/GOOG** - Alphabet Inc.
- **META** - Meta Platforms Inc.
- **TSLA** - Tesla Inc.
- **AMZN** - Amazon.com Inc.
- **ORCL** - Oracle Corporation
- **ADBE** - Adobe Inc.
- **CRM** - Salesforce Inc.
- **INTC** - Intel Corporation
- **AMD** - Advanced Micro Devices

#### Financial Services
- **JPM** - JPMorgan Chase & Co.
- **BAC** - Bank of America
- **WFC** - Wells Fargo
- **GS** - Goldman Sachs
- **MS** - Morgan Stanley
- **V** - Visa Inc.
- **MA** - Mastercard
- **BLK** - BlackRock Inc.

#### Healthcare
- **UNH** - UnitedHealth Group
- **JNJ** - Johnson & Johnson
- **LLY** - Eli Lilly
- **ABBV** - AbbVie Inc.
- **MRK** - Merck & Co.
- **PFE** - Pfizer Inc.

> **참고**: S&P 500 전체 종목 리스트는 Wikipedia API를 통해 실시간으로 가져옵니다. 위 목록은 예시이며, 실제로는 503개 전체 종목이 데이터베이스에 로드됩니다.

### 2. 원자재 선물 (22개)

#### 에너지 (Energy)
- **CL** - Crude Oil WTI Futures (원유 WTI)
- **BZ** - Brent Crude Oil Futures (브렌트유)
- **NG** - Natural Gas Futures (천연가스)
- **HO** - Heating Oil Futures (난방유)
- **RB** - RBOB Gasoline Futures (휘발유)

#### 귀금속 (Precious Metals)
- **GC** - Gold Futures (금)
- **SI** - Silver Futures (은)
- **PL** - Platinum Futures (백금)
- **PA** - Palladium Futures (팔라듐)

#### 산업 금속 (Industrial Metals)
- **HG** - Copper Futures (구리)

#### 농산물 (Agricultural)
- **ZC** - Corn Futures (옥수수)
- **ZW** - Wheat Futures (밀)
- **ZS** - Soybean Futures (대두)
- **KC** - Coffee Futures (커피)
- **SB** - Sugar Futures (설탕)
- **CT** - Cotton Futures (면화)
- **CC** - Cocoa Futures (코코아)

#### 축산 (Livestock)
- **LE** - Live Cattle Futures (육우)
- **HE** - Lean Hogs Futures (돼지)

### 3. 주요 지수 선물 (3개)

- **ES** - E-mini S&P 500 Futures
- **NQ** - E-mini NASDAQ-100 Futures
- **YM** - E-mini Dow Futures

### 4. 주요 ETF (10개)

#### 주식 지수 ETF
- **SPY** - SPDR S&P 500 ETF Trust
- **QQQ** - Invesco QQQ Trust (나스닥 100)
- **DIA** - SPDR Dow Jones Industrial Average ETF
- **IWM** - iShares Russell 2000 ETF
- **VTI** - Vanguard Total Stock Market ETF

#### 원자재 ETF
- **GLD** - SPDR Gold Shares (금)
- **SLV** - iShares Silver Trust (은)
- **USO** - United States Oil Fund (원유)

#### 채권 ETF
- **TLT** - iShares 20+ Year Treasury Bond ETF

#### 기타
- **EEM** - iShares MSCI Emerging Markets ETF

## 🔧 데이터 로드 방법

### 초기 설정
```bash
# 마켓 데이터 로드 (S&P 500 + 원자재 + ETF)
python scripts/load_market_data.py
```

### 출력 예시
```
INFO:__main__:Fetching S&P 500 constituents from Wikipedia...
INFO:__main__:✓ Found 503 S&P 500 companies
INFO:__main__:Loading 503 S&P 500 stocks...
INFO:__main__:✓ Loaded 503 new S&P 500 stocks
INFO:__main__:Loading 22 commodity futures...
INFO:__main__:✓ Loaded 22 new commodity futures
INFO:__main__:Loading 10 major ETFs...
INFO:__main__:✓ Loaded 10 new ETFs
INFO:__main__:Total tickers in database: 533

Sector Distribution:
  Information Technology              76 tickers
  Financials                          66 tickers
  Health Care                         63 tickers
  Consumer Discretionary              51 tickers
  Industrials                         48 tickers
  Communication Services              24 tickers
  Consumer Staples                    32 tickers
  Energy                              27 tickers
  Utilities                           28 tickers
  Real Estate                         29 tickers
  Materials                           28 tickers
  Agriculture                          7 tickers
  Metals                               5 tickers
  Index                                3 tickers
  ETF                                 10 tickers
```

## 📈 데이터 활용

### 1. 티커 추출 (데이터베이스 기반)
뉴스 크롤링 시 자동으로 다음 패턴을 인식합니다:
- `$AAPL` - 달러 기호 패턴 (명시적 티커)
- `(TSLA)` - 괄호 패턴 (명시적 티커)
- `NASDAQ:NVDA` - 거래소:티커 패턴 (명시적 티커)
- **회사명 매핑** (데이터베이스에서 자동 생성, 대소문자 구분 없음):
  - "Apple" → AAPL
  - "tesla" → TSLA
  - "Goldman Sachs" → GS
  - "morgan stanley" → MS
  - "WALMART" → WMT
  - "Gold" → GC (Gold Futures)
  - "Silver" → SI (Silver Futures)

**총 815개의 회사명 매핑**이 데이터베이스에서 자동으로 생성됩니다.

### 2. 뉴스 분석
```bash
# 통합 크롤러 실행
python run_integrated_crawler.py
```

자동으로 다음을 수행합니다:
- 뉴스 기사에서 종목 티커 추출
- 감성 분석 (긍정/부정/중립)
- 중요도 점수 계산
- 데이터베이스 저장

### 3. API 조회
```bash
# API 서버 시작
python -m app.main
```

엔드포인트:
- `GET /api/news?tickers=AAPL,MSFT` - 특정 종목 뉴스
- `GET /api/tickers/AAPL/news` - 특정 종목 상세 뉴스
- `GET /api/trending` - 트렌딩 종목

## 🎯 섹터별 종목 수 (총 533개)

| 섹터 | 종목 수 | 출처 |
|------|--------|------|
| Information Technology | 76 | S&P 500 (Wikipedia) |
| Financials | 66 | S&P 500 (Wikipedia) |
| Health Care | 63 | S&P 500 (Wikipedia) |
| Consumer Discretionary | 51 | S&P 500 (Wikipedia) |
| Industrials | 48 | S&P 500 (Wikipedia) |
| Consumer Staples | 32 | S&P 500 (Wikipedia) |
| Real Estate | 29 | S&P 500 (Wikipedia) |
| Utilities | 28 | S&P 500 (Wikipedia) |
| Materials | 28 | S&P 500 (Wikipedia) |
| Energy | 27 | S&P 500 + Commodities |
| Communication Services | 24 | S&P 500 (Wikipedia) |
| ETF | 10 | Major ETFs |
| Agriculture | 7 | Commodities |
| Metals | 5 | Commodities |
| Index | 3 | Index Futures |
| **총계** | **533** | **동적 로딩** |

## 📝 데이터 출처

- **S&P 500 (503개)**: Wikipedia API에서 실시간 로드
  - URL: https://en.wikipedia.org/wiki/List_of_S%26P_500_companies
  - 업데이트: Wikipedia 편집 시 자동 반영
  - GICS Sector/Industry 정보 포함
- **원자재 선물 (22개)**: NYMEX, COMEX, CME, CBOT, ICE 공식 티커
- **ETF (10개)**: 주요 거래소 상장 ETF

모든 데이터는 실제 거래소에서 사용되는 공식 티커 심볼입니다.

## 🔍 티커 추출 예시

```python
from app.services.ticker_extractor import TickerExtractor

extractor = TickerExtractor()  # 데이터베이스에서 533개 티커 로드

# 예시 1: Tech 회사
text = "Apple, Microsoft, Tesla report strong earnings"
tickers = extractor.extract(text)
# 결과: AAPL, MSFT, TSLA (대소문자 구분 없음)

# 예시 2: 금융
text = "Goldman Sachs and Morgan Stanley beat estimates"
tickers = extractor.extract(text)
# 결과: GS, MS

# 예시 3: 원자재
text = "Gold futures surge. Oil prices drop. Silver gains"
tickers = extractor.extract(text)
# 결과: GC (Gold Futures), CL (Crude Oil), SI (Silver Futures)

# 예시 4: 대소문자 혼합
text = "WALMART and target see consumer spending rise"
tickers = extractor.extract(text)
# 결과: WMT, TGT
```
