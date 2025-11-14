# Index Analyzer

뉴스 크롤링 및 분석 파이프라인 (데몬)

## 구조

```
IN → PROC → CALC → RCMD
```

- **IN**: 뉴스 입수 (크롤링)
- **PROC**: 처리 (감정 분석, 티커 추출)
- **CALC**: 계산 (시장 영향도)
- **RCMD**: 추천 생성

## 실행

### 데몬 모드
```bash
poetry run crawler
```

### 직접 실행
```bash
python -m index_analyzer.daemon.worker
```

## 설정

`config/sites.yaml`에서 크롤링 대상 사이트 설정

## 의존성

- Redis: Stream 기반 메시지 큐
- PostgreSQL: 뉴스 데이터 저장
