# MarketPulse Daemon 설정 가이드

## 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│                    System Architecture                       │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────┐         ┌──────────────────────┐
│   Python Daemon      │         │   Spring Boot Web    │
│   (Data Collector)   │         │   (API Server)       │
│                      │         │                      │
│  - APScheduler       │         │  - REST API          │
│  - News Crawler      │         │  - JPA/MyBatis       │
│  - Ticker Extractor  │◄────────┤  - Frontend Serving  │
│  - Sentiment Analysis│  Shared │  - Business Logic    │
│  - systemd service   │   DB    │  - Spring Security   │
└──────────┬───────────┘         └──────────┬───────────┘
           │                                │
           │        ┌──────────────┐        │
           └────────► PostgreSQL/  ◄────────┘
                    │   MySQL      │
                    └──────────────┘
```

## 1. Python Daemon 설정

### 1.1 의존성 설치

```bash
# APScheduler 추가
pip install apscheduler

# requirements.txt 업데이트
echo "apscheduler>=3.10.0" >> requirements.txt

# 전체 설치
pip install -r requirements.txt
```

### 1.2 로컬 테스트

```bash
# 한 번만 실행 (테스트)
python daemon.py --test

# 데몬 모드로 실행
python daemon.py

# PostgreSQL 사용
python daemon.py --db-url postgresql://user:pass@localhost:5432/marketpulse
```

### 1.3 스케줄 설정

`daemon.py`에서 크론 스케줄 수정 가능:

```python
# 매 1시간마다
IntervalTrigger(hours=1)

# 특정 시간 (9AM, 3PM, 9PM)
CronTrigger(hour='9,15,21', minute=0)

# 매일 자정
CronTrigger(hour=0, minute=0)

# 평일 오전 9시
CronTrigger(day_of_week='mon-fri', hour=9, minute=0)
```

---

## 2. Systemd 서비스 설정 (Linux)

### 2.1 서비스 파일 설치

```bash
# 1. 프로젝트 디렉토리로 이동
cd /opt/marketpulse

# 2. 서비스 파일 복사
sudo cp marketpulse-daemon.service /etc/systemd/system/

# 3. 서비스 파일 권한 설정
sudo chmod 644 /etc/systemd/system/marketpulse-daemon.service

# 4. systemd 리로드
sudo systemctl daemon-reload
```

### 2.2 서비스 시작

```bash
# 서비스 시작
sudo systemctl start marketpulse-daemon

# 부팅 시 자동 시작 설정
sudo systemctl enable marketpulse-daemon

# 상태 확인
sudo systemctl status marketpulse-daemon

# 로그 확인
sudo journalctl -u marketpulse-daemon -f
```

### 2.3 서비스 관리

```bash
# 중지
sudo systemctl stop marketpulse-daemon

# 재시작
sudo systemctl restart marketpulse-daemon

# 자동 시작 해제
sudo systemctl disable marketpulse-daemon
```

---

## 3. Windows 서비스 설정

### 3.1 NSSM 사용 (추천)

```powershell
# 1. NSSM 다운로드
# https://nssm.cc/download

# 2. 서비스 설치
nssm install MarketPulseDaemon

# GUI에서 설정:
# - Path: C:\Python39\python.exe
# - Startup directory: C:\marketpulse
# - Arguments: daemon.py --db-url postgresql://...

# 3. 서비스 시작
nssm start MarketPulseDaemon

# 4. 상태 확인
nssm status MarketPulseDaemon
```

### 3.2 Task Scheduler 사용

```powershell
# 작업 스케줄러로 주기적 실행
schtasks /create /tn "MarketPulse Daemon" /tr "C:\marketpulse\venv\Scripts\python.exe C:\marketpulse\daemon.py" /sc hourly /st 09:00
```

---

## 4. PostgreSQL 데이터베이스 설정

### 4.1 데이터베이스 생성

```sql
-- PostgreSQL 접속
psql -U postgres

-- 데이터베이스 생성
CREATE DATABASE marketpulse;

-- 사용자 생성
CREATE USER marketpulse WITH PASSWORD 'your_secure_password';

-- 권한 부여
GRANT ALL PRIVILEGES ON DATABASE marketpulse TO marketpulse;

-- 연결 확인
\c marketpulse
```

### 4.2 테이블 자동 생성

```bash
# Python 스크립트로 테이블 생성
python -c "
from app.models.database import get_postgresql_db
db = get_postgresql_db('postgresql://marketpulse:password@localhost:5432/marketpulse')
db.create_tables()
print('Tables created successfully')
"
```

---

## 5. Spring Boot 통합

### 5.1 프로젝트 구조

```
spring-marketpulse/
├── src/main/java/com/marketpulse/
│   ├── MarketPulseApplication.java
│   ├── controller/
│   │   ├── NewsController.java
│   │   └── TickerController.java
│   ├── service/
│   │   ├── NewsService.java
│   │   └── TickerService.java
│   ├── repository/
│   │   ├── NewsRepository.java
│   │   └── TickerRepository.java
│   └── entity/
│       ├── NewsArticle.java
│       └── Ticker.java
└── src/main/resources/
    └── application.yml
```

### 5.2 application.yml

```yaml
spring:
  application:
    name: marketpulse-api

  datasource:
    url: jdbc:postgresql://localhost:5432/marketpulse
    username: marketpulse
    password: your_secure_password
    driver-class-name: org.postgresql.Driver

  jpa:
    hibernate:
      ddl-auto: none  # Python이 스키마 관리
    show-sql: true
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
        format_sql: true

server:
  port: 8080

# CORS 설정 (프론트엔드용)
cors:
  allowed-origins: http://localhost:3000,http://localhost:4200
  allowed-methods: GET,POST,PUT,DELETE,OPTIONS
```

### 5.3 Entity 예시 (NewsArticle.java)

```java
package com.marketpulse.entity;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "news_articles")
public class NewsArticle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String url;

    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    private String source;

    @Column(name = "published_time")
    private String publishedTime;

    @Column(name = "sentiment_score")
    private Double sentimentScore;

    @Column(name = "sentiment_label")
    private String sentimentLabel;

    @Column(name = "importance_score")
    private Double importanceScore;

    @Column(name = "crawled_at")
    private LocalDateTime crawledAt;

    @OneToMany(mappedBy = "article", fetch = FetchType.LAZY)
    private List<NewsTicker> tickers;

    // Getters and Setters
    // ...
}
```

### 5.4 Repository 예시

```java
package com.marketpulse.repository;

import com.marketpulse.entity.NewsArticle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface NewsRepository extends JpaRepository<NewsArticle, Long> {

    // 최신 뉴스 조회
    List<NewsArticle> findTop50ByOrderByCrawledAtDesc();

    // 특정 기간 뉴스
    List<NewsArticle> findByCrawledAtAfter(LocalDateTime dateTime);

    // 특정 티커 관련 뉴스
    @Query("SELECT DISTINCT a FROM NewsArticle a " +
           "JOIN a.tickers t " +
           "WHERE t.tickerSymbol = :symbol " +
           "ORDER BY a.crawledAt DESC")
    List<NewsArticle> findByTickerSymbol(@Param("symbol") String symbol);

    // 감성별 조회
    List<NewsArticle> findBySentimentLabel(String label);
}
```

### 5.5 Controller 예시

```java
package com.marketpulse.controller;

import com.marketpulse.entity.NewsArticle;
import com.marketpulse.service.NewsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/news")
@CrossOrigin(origins = "*")
public class NewsController {

    @Autowired
    private NewsService newsService;

    /**
     * 최신 뉴스 조회
     */
    @GetMapping
    public ResponseEntity<List<NewsArticle>> getLatestNews(
            @RequestParam(required = false) String ticker,
            @RequestParam(required = false) String sentiment,
            @RequestParam(defaultValue = "24") int hours
    ) {
        LocalDateTime since = LocalDateTime.now().minusHours(hours);
        List<NewsArticle> news = newsService.getNews(ticker, sentiment, since);
        return ResponseEntity.ok(news);
    }

    /**
     * 특정 티커 뉴스
     */
    @GetMapping("/ticker/{symbol}")
    public ResponseEntity<List<NewsArticle>> getNewsByTicker(
            @PathVariable String symbol
    ) {
        List<NewsArticle> news = newsService.getNewsByTicker(symbol);
        return ResponseEntity.ok(news);
    }

    /**
     * 통계
     */
    @GetMapping("/stats")
    public ResponseEntity<?> getStats() {
        return ResponseEntity.ok(newsService.getStatistics());
    }
}
```

### 5.6 pom.xml 의존성

```xml
<dependencies>
    <!-- Spring Boot Web -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>

    <!-- Spring Data JPA -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>

    <!-- PostgreSQL Driver -->
    <dependency>
        <groupId>org.postgresql</groupId>
        <artifactId>postgresql</artifactId>
        <scope>runtime</scope>
    </dependency>

    <!-- Lombok (선택사항) -->
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <optional>true</optional>
    </dependency>
</dependencies>
```

---

## 6. 모니터링 & 로깅

### 6.1 Python Daemon 로그

```bash
# systemd 저널 확인
sudo journalctl -u marketpulse-daemon -f

# 로그 파일 확인
tail -f logs/daemon.log
```

### 6.2 Spring Boot 로그

```yaml
# application.yml
logging:
  level:
    com.marketpulse: DEBUG
    org.hibernate.SQL: DEBUG
  file:
    name: logs/spring-app.log
```

### 6.3 데이터베이스 모니터링

```sql
-- 최근 크롤링된 기사 수
SELECT COUNT(*) FROM news_articles
WHERE crawled_at > NOW() - INTERVAL '1 hour';

-- 티커별 기사 수
SELECT t.ticker_symbol, COUNT(*)
FROM news_tickers nt
JOIN tickers t ON nt.ticker_symbol = t.ticker_symbol
GROUP BY t.ticker_symbol
ORDER BY COUNT(*) DESC
LIMIT 10;

-- 감성 분포
SELECT sentiment_label, COUNT(*)
FROM news_articles
GROUP BY sentiment_label;
```

---

## 7. 배포 체크리스트

### Python Daemon
- [ ] PostgreSQL 설치 및 설정
- [ ] 가상환경 생성 및 의존성 설치
- [ ] sites.yaml 설정
- [ ] daemon.py 테스트 실행
- [ ] systemd 서비스 등록
- [ ] 로그 디렉토리 권한 설정
- [ ] 자동 시작 설정

### Spring Boot
- [ ] application.yml DB 설정
- [ ] Entity 매핑 확인
- [ ] CORS 설정
- [ ] API 테스트
- [ ] JAR 빌드 및 배포
- [ ] Nginx 리버스 프록시 설정 (선택사항)

### 통합 테스트
- [ ] Python Daemon이 DB에 데이터 적재 확인
- [ ] Spring Boot API로 데이터 조회 확인
- [ ] 프론트엔드 연동 테스트

---

## 8. 문제 해결

### Python Daemon이 시작되지 않음

```bash
# 로그 확인
sudo journalctl -u marketpulse-daemon -n 50

# 수동 실행으로 에러 확인
cd /opt/marketpulse
source venv/bin/activate
python daemon.py --test
```

### DB 연결 오류

```bash
# PostgreSQL 상태 확인
sudo systemctl status postgresql

# 연결 테스트
psql -h localhost -U marketpulse -d marketpulse
```

### Spring Boot 연결 실패

```bash
# PostgreSQL 연결 설정 확인
# /etc/postgresql/*/main/pg_hba.conf
# local   all   all   md5 추가
```

---

## 9. 성능 최적화

### Python Daemon
- 크롤링 간격 조정 (`IntervalTrigger`)
- `max_total` 제한 설정
- 멀티프로세싱 고려 (대량 크롤링 시)

### Spring Boot
- JPA 쿼리 최적화 (N+1 문제)
- Redis 캐싱 추가
- Connection Pool 설정

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 10
      minimum-idle: 5
```

---

## 10. 추가 기능 아이디어

- [ ] **Webhook 알림**: 중요 뉴스 발생 시 Slack/Discord 알림
- [ ] **Admin Dashboard**: 크롤링 상태 모니터링 웹 페이지
- [ ] **Real-time Updates**: WebSocket으로 실시간 뉴스 푸시
- [ ] **Elasticsearch**: 전문 검색 엔진 통합
- [ ] **Grafana**: 메트릭 시각화

---

이제 완전한 백그라운드 크롤링 + Spring Boot API 시스템이 준비되었습니다!
