# Data Fetcher

API 데이터 수집 라이브러리

## 특징

- OpenBB 스타일 Fetcher 패턴
- 표준화된 데이터 모델
- 여러 데이터 소스 통합 (Yahoo Finance, FRED, Alpha Vantage)

## 설치

```bash
pip install data-fetcher
```

또는 로컬 개발:

```bash
poetry install
```

## 사용법

### Python 라이브러리로 사용

```python
from data_fetcher import get_data_router
from data_fetcher.models import ShortInterestData

# Router 가져오기
router = get_data_router()

# 공매도 데이터 조회
short_data = router.get_short_interest('TSLA')

print(f"공매도 비율: {short_data[0].short_percent_of_float * 100:.2f}%")
```

### CLI로 사용

```bash
# 공매도 조회
data-fetcher short-interest TSLA

# GDP 조회
data-fetcher gdp --start-date 2020-01-01

# 재무비율 조회
data-fetcher financial-ratios AAPL
```

## 지원하는 데이터

### Yahoo Finance
- 공매도 (Short Interest)
- 주가 (Equity Quote)
- 재무비율 (Financial Ratios)
- 재무제표 (Balance Sheet, Income Statement, Cash Flow)

### FRED
- GDP
- CPI
- 실업률
- 국채 수익률

### Alpha Vantage
- (추가 예정)

## 아키텍처

```
data_fetcher/
├── models/          # Standard Models (데이터 형식)
├── fetchers/        # Fetchers (데이터 수집)
└── router.py        # Router (통합)
```

## 개발

```bash
# 테스트
poetry run pytest

# 포맷팅
poetry run black .

# 타입 체크
poetry run mypy .
```
