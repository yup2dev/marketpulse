# 개별 기업 신용 리스크 데이터 소스

## 무료 데이터 소스

### 1. SEC EDGAR (재무제표)
- **URL**: https://www.sec.gov/edgar/searchedgar/companysearch.html
- **API**: https://data.sec.gov/
- **데이터**: 10-K, 10-Q 재무제표, 채권 발행 정보
- **활용**: 부채비율, 이자보상배율 계산

```python
import requests
cik = "0001341439"  # Oracle
url = f"https://data.sec.gov/submissions/CIK{cik}.json"
headers = {"User-Agent": "YourCompany contact@email.com"}
response = requests.get(url, headers=headers)
```

### 2. FINRA TRACE (채권 거래 데이터)
- **URL**: http://finra-markets.morningstar.com/BondCenter/
- **데이터**: 실제 회사채 거래가격
- **제한**: API 없음, 웹 스크래핑 필요

### 3. FRED (신용등급별 집계)
- **URL**: https://fred.stlouisfed.org/
- **API**: 
- **데이터**: AAA, AA, A, BBB 등급별 스프레드
- **시리즈**:
  - `BAMLC0A4CBBB`: BBB Corporate Bond Spread
  - `BAMLC0A2CAA`: AA Corporate Bond Spread
  - `BAMLC0A3CA`: A Corporate Bond Spread

### 4. 신용평가사 웹사이트
- **S&P**: https://www.spglobal.com/ratings/
- **Moody's**: https://www.moodys.com/
- **Fitch**: https://www.fitchratings.com/
- **활용**: 신용등급 변화 모니터링

## 간접적 추정 방법 (추천)

### 방법 1: 신용등급 + 등급별 스프레드
```python
# 1. FRED에서 BBB 등급 평균 스프레드 가져오기
bbb_spread = fetch_fred_series("BAMLC0A4CBBB", "BBB")

# 2. 뉴스 크롤링으로 Oracle 신용 관련 뉴스 감지
# MarketPulse의 sentiment analysis 활용

# 3. 상대적 조정
# Oracle이 BBB 등급이면 BBB 스프레드 사용
# 뉴스 감성이 부정적이면 스프레드 증가
```

### 방법 2: 재무비율 기반 리스크 점수
```python
# SEC EDGAR에서 재무제표 수집
debt_to_equity = total_debt / total_equity
interest_coverage = ebit / interest_expense
current_ratio = current_assets / current_liabilities

# 신용 리스크 점수 계산
credit_score = calculate_credit_score(
    debt_to_equity,
    interest_coverage,
    current_ratio
)
```

### 방법 3: 뉴스 감성 분석 기반
```python
# MarketPulse 활용
# 1. "Oracle credit risk", "Oracle debt" 키워드로 뉴스 수집
# 2. 감성 분석 실행
# 3. 감성 점수를 리스크 메트릭으로 변환
sentiment_to_risk = {
    "positive": -0.2,  # 스프레드 감소
    "neutral": 0,
    "negative": 0.3    # 스프레드 증가
}
```

---

## MarketPulse 구현 로드맵

### Phase 1: 기초 데이터 (현재)
- [x] FRED 신용등급별 스프레드
- [ ] SEC EDGAR 재무제표 크롤러
- [ ] 신용등급 매핑 테이블

### Phase 2: 뉴스 기반 리스크
- [ ] 기업별 신용 뉴스 필터
- [ ] 감성 분석 → 리스크 점수 변환
- [ ] 시계열 차트 생성

### Phase 3: 고급 분석
- [ ] 재무비율 기반 리스크 점수
- [ ] 머신러닝 리스크 예측 모델
- [ ] 실시간 알림 시스템

---

**참고데이터**
1. FRED (신용등급별)
2. SEC EDGAR (재무제표)
3. 뉴스 크롤링 (MarketPulse)
