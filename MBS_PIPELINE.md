# MBS Pipeline - 사용 가이드

## 아키텍처 개요

```
┌─────────────────────────────────────────────────┐
│           MBS Pipeline Architecture             │
└─────────────────────────────────────────────────┘

크롤러 → MBS_IN_ARTICLE (입수)
         ↓ Redis Stream
   Analyzer Consumer → MBS_PROC_ARTICLE (가공: ML/요약)
                       ↓ Scheduler (1h)
              CalcProcessor → MBS_CALC_METRIC (계산: 메트릭)
                              ↓ Scheduler (2h)
                      RcmdGenerator → MBS_RCMD_RESULT (추천)
                                      ↓
                                   Spring API
```

## 테이블 구조

### 1. **MBS_IN_ARTICLE** (입수 - 크롤러)
- `news_id` (PK)
- `base_ymd`, `source_cd`, `title`, `content`
- `publish_dt`, `ingest_batch_id`

### 2. **MBS_IN_STK_STBD** (입수 - 주식 데이터)
- `stk_cd`, `stk_nm`, `sector`
- `close_price`, `change_rate`, `base_ymd`

### 3. **MBS_PROC_ARTICLE** (가공 - ML 분석)
- `proc_id` (PK), `news_id` (FK)
- `stk_cd`, `summary_text`
- `sentiment_score`, `match_score`, `price_impact`

### 4. **MBS_CALC_METRIC** (계산 - 메트릭)
- `calc_id` (PK), `stk_cd`
- `metric_type` (SENTIMENT / RISK / VOLATILITY / etc)
- `metric_val`, `source_proc_id` (FK)

### 5. **MBS_RCMD_RESULT** (추천 - 결과)
- `rcmd_id` (PK)
- `rcmd_type` (NEWS / STOCK / PORTFOLIO)
- `ref_news_id`, `ref_stk_cd`, `ref_calc_id`
- `score`, `reason`

## 실행 방법

### 1. 테스트 실행

```bash
# 전체 파이프라인 테스트
python scripts/test_mbs_pipeline.py

# Worker 단독 테스트 (Redis 없이)
python scripts/test_worker_standalone.py
```

### 2. Worker 실행 (데몬 모드)

```bash
# 백그라운드 워커 시작
python app/worker.py
```

**Worker 구성요소:**
- **APScheduler**: PROC→CALC (1h), CALC→RCMD (2h) 자동 실행
- **Command Listener**: Spring에서 보낸 명령 처리 (Redis Queue)
- **Analyzer Consumer**: IN→PROC 변환 (Redis Stream)

### 3. Spring에서 명령 전송

Redis Queue를 통해 명령 전송:

```json
// 크롤링 실행
{
  "task_type": "crawl_news",
  "params": {}
}

// PROC → CALC 강제 실행
{
  "task_type": "process_to_calc",
  "params": {}
}

// CALC → RCMD 강제 실행
{
  "task_type": "generate_recommendations",
  "params": {}
}
```

## 데이터 흐름

### Step 1: 크롤링 (IN Layer)
```python
# 크롤러가 MBS_IN_ARTICLE에 저장
news_id = crawler._save_to_mbs_in_article(
    source_cd='Reuters',
    url='...',
    title='...',
    content='...'
)

# Redis Stream에 발행
event_bus.publish_to_stream('stream:new_articles', {
    'news_id': news_id,
    'source_cd': 'Reuters'
})
```

### Step 2: 분석 (PROC Layer)
```python
# Analyzer Consumer가 Stream 구독
# IN → PROC 변환 (자동)
# - 감성 분석
# - 종목 추출
# - 요약 생성
```

### Step 3: 계산 (CALC Layer)
```python
# CalcProcessor가 1시간마다 자동 실행
# PROC → CALC 변환
# - SENTIMENT 메트릭
# - RISK 메트릭
# - VOLATILITY 메트릭
```

### Step 4: 추천 (RCMD Layer)
```python
# RcmdGenerator가 2시간마다 자동 실행
# CALC → RCMD 변환
# - NEWS 추천
# - STOCK 추천 (BUY/SELL/HOLD)
# - PORTFOLIO 추천
```

## Spring API 연동

### 추천 결과 조회

```java
// MBS_RCMD_RESULT 테이블 조회
@GetMapping("/api/recommendations")
public List<Recommendation> getRecommendations(
    @RequestParam String type,  // NEWS / STOCK / PORTFOLIO
    @RequestParam String date    // YYYY-MM-DD
) {
    // SELECT * FROM mbs_rcmd_result
    // WHERE rcmd_type = ? AND base_ymd = ?
    // ORDER BY score DESC
}
```

### 명령 전송

```java
// Redis Queue에 명령 전송
@PostMapping("/api/tasks/trigger")
public void triggerTask(@RequestBody TaskCommand command) {
    redisTemplate.opsForList().rightPush(
        "queue:marketpulse_commands",
        objectMapper.writeValueAsString(command)
    );
}
```

## 설정 파일

### app/core/config.py

```python
# 데이터베이스
SQLITE_PATH = "data/marketpulse.db"

# Redis
REDIS_URL = "redis://localhost:6379/0"
QUEUE_ENABLED = True
REDIS_QUEUE_NAME = "queue:marketpulse_commands"

# 스케줄러
SCHEDULER_ENABLED = True
```

## 모니터링

### 로그 확인

```bash
# Worker 로그
tail -f logs/marketpulse.log
```

### 데이터베이스 상태

```sql
-- 각 레이어별 레코드 수
SELECT 'IN' as layer, COUNT(*) FROM mbs_in_article
UNION ALL
SELECT 'PROC', COUNT(*) FROM mbs_proc_article
UNION ALL
SELECT 'CALC', COUNT(*) FROM mbs_calc_metric
UNION ALL
SELECT 'RCMD', COUNT(*) FROM mbs_rcmd_result;

-- 최신 추천
SELECT rcmd_type, ref_stk_cd, score, reason, base_ymd
FROM mbs_rcmd_result
ORDER BY created_at DESC
LIMIT 10;
```

## 트러블슈팅

### Worker가 시작되지 않을 때
```bash
# Redis 연결 확인
redis-cli ping

# 설정 파일 확인
python -c "from app.core.config import settings; print(settings.REDIS_URL)"
```

### 추천이 생성되지 않을 때
```bash
# PROC 데이터 확인
python -c "from app.models.database import *;
db = get_sqlite_db('data/marketpulse.db');
s = db.get_session();
print(s.query(MBS_PROC_ARTICLE).count())"

# 수동 실행
python scripts/test_worker_standalone.py
```

## 성능 최적화

1. **배치 크기 조정**: `calc_processor.py`의 `limit` 파라미터
2. **스케줄 간격 조정**: `scheduler.py`의 `IntervalTrigger` 시간
3. **인덱스 확인**: 모든 FK와 조회 컬럼에 인덱스 적용됨

## 다음 단계

1. ✅ MBS 스키마 설계 완료
2. ✅ 전체 파이프라인 구현 완료
3. ✅ Worker & Scheduler 통합 완료
4. ✅ 테스트 스크립트 작성 완료
5. 🔄 Redis Stream 실제 테스트 (Redis 서버 필요)
6. 🔄 Spring API 연동 구현
7. 📋 프로덕션 배포 (Docker/Systemd)
