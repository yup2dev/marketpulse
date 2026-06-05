# Index Analyzer

뉴스 크롤링 및 분석 파이프라인 (데몬)

## 구조

```
IN(입수) → PROC(가공) → CALC(계산) → RCMD(평가/추천)
```

- **IN**: 뉴스·종목·지수 입수 (크롤링 + 외부 API)
- **PROC**: 가공 (감정 분석, 티커 추출, 요약)
- **CALC**: 계산 (종목별 메트릭 집계)
- **RCMD**: 평가/추천 생성 (NEWS / STOCK / PORTFOLIO)

폴더 역할 (요약):

| 폴더 | 역할 |
|------|------|
| `config/`, `utils/` | 공통 레이어 (설정, db·http·url·logging) |
| `crawling/`, `parsing/` | IN — 크롤링·파싱 |
| `media/` | PROC — 이미지/차트 분석 |
| `services/` | 작업 로직 (crawl·sentiment·stock·ticker) |
| `pipeline/` | 단계 오케스트레이션 (in/proc/calc/rcmd) |
| `server/` | 런타임 데몬 (worker·scheduler·consumer·redis_bus) |
| `models/` | ORM(역할별 `orm/` 패키지) + DTO(schemas·chart·report) |

> 📐 상세 아키텍처·모델 분류·입수 데이터 정리표는 **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** 참고.

## 실행

### 데몬 모드
```bash
poetry run crawler
```

### 직접 실행
```bash
python -m index_analyzer.server.worker
```

## 설정

`sites.yaml`에서 크롤링 대상 사이트 설정 (`config/loader.py` 로드).

## 의존성

- Redis: Stream/Queue/PubSub 기반 메시지 버스
- PostgreSQL: 데이터 저장 (SQLite 폴백 지원)
