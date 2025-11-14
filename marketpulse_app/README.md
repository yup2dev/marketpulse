# MarketPulse App

MarketPulse 메인 애플리케이션 - 데이터 표시 및 분석

## 특징

- 차트 생성 (Matplotlib, Plotext)
- 테이블 포맷팅
- CLI 인터페이스
- data_fetcher 라이브러리 사용

## 설치

```bash
poetry install
```

## 사용법

```bash
# 데이터 조회
marketpulse view-data TSLA

# 뉴스 조회
marketpulse view-news

# 차트 생성
marketpulse chart TSLA --period 3m
```

## 의존성

- **data_fetcher**: API 데이터 수집
- Redis: 뉴스 데이터 (index_analyzer로부터)
- PostgreSQL: 데이터 저장

## 구조

```
marketpulse_app/
├── presentation/    # 표시 계층
│   ├── charts/      # 차트
│   ├── formatters/  # 포맷터
│   └── cli/         # CLI
├── core/           # 핵심 로직
└── models/         # DB 모델
```
