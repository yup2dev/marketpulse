# MarketPulse 기능 개발 계획서

## 프로젝트 개요
MarketPulse 플랫폼에 6가지 핵심 기능을 추가하기 위한 상세 구현 계획

---

## 1. 포트폴리오 대시보드 (Portfolio Dashboard)

### 📊 Frontend
- **컴포넌트 구조**
  - `PortfolioDashboard.jsx` - 메인 대시보드 컨테이너
  - `PortfolioSummaryWidget.jsx` - 전체 포트폴리오 요약 (총 자산, 수익률, 손익)
  - `AssetAllocationChart.jsx` - 자산 배분 차트 (파이/도넛 차트)
  - `PortfolioPerformanceChart.jsx` - 시간별 수익률 추이 그래프
  - `HoldingsTable.jsx` - 보유 종목 테이블 (종목명, 수량, 평균단가, 현재가, 수익률)
  - `PortfolioMetricsCard.jsx` - 주요 지표 카드 (샤프비율, 변동성, 최대낙폭 등)

- **상태 관리**
  - Zustand store: `portfolioStore.js`
  - 선택된 포트폴리오 ID
  - 포트폴리오 데이터 캐싱
  - 실시간 가격 업데이트 상태

- **UI/UX**
  - 다크/라이트 테마 적용
  - 반응형 그리드 레이아웃 (React-Grid-Layout 활용)
  - 날짜 범위 선택 필터
  - 포트폴리오 전환 드롭다운

- **API 연동**
  - `GET /api/portfolios` - 포트폴리오 목록
  - `GET /api/portfolios/{id}/summary` - 포트폴리오 요약
  - `GET /api/portfolios/{id}/holdings` - 보유 종목
  - `GET /api/portfolios/{id}/performance` - 성과 데이터

### 🔧 Backend
- **API 라우트** (`app/backend/api/routes/portfolio.py`)
  - `GET /api/portfolios` - 사용자 포트폴리오 목록 조회
  - `GET /api/portfolios/{portfolio_id}/summary` - 포트폴리오 요약 통계
  - `GET /api/portfolios/{portfolio_id}/holdings` - 현재 보유 종목 상세
  - `GET /api/portfolios/{portfolio_id}/performance` - 일별/월별 수익률
  - `POST /api/portfolios` - 새 포트폴리오 생성
  - `PUT /api/portfolios/{portfolio_id}` - 포트폴리오 수정
  - `DELETE /api/portfolios/{portfolio_id}` - 포트폴리오 삭제

- **서비스 레이어** (`app/backend/services/portfolio_service.py`)
  - `calculate_portfolio_value()` - 현재 포트폴리오 가치 계산
  - `calculate_returns()` - 수익률 계산 (일간, 누적)
  - `calculate_allocation()` - 자산 배분 비율 계산
  - `calculate_metrics()` - 샤프비율, 변동성, MDD 계산
  - `get_performance_history()` - 성과 히스토리 조회

- **인증 및 권한**
  - JWT 토큰 기반 사용자 인증
  - 포트폴리오 소유자 검증

### 💾 Database
- **테이블 확인/수정**
  - `portfolios` - 포트폴리오 기본 정보
    - 컬럼: id, user_id, name, description, created_at, updated_at
  - `holdings` - 보유 종목 정보
    - 컬럼: id, portfolio_id, ticker, quantity, average_price, current_price, updated_at
  - `transactions` - 거래 이력
    - 컬럼: id, portfolio_id, ticker, type (buy/sell), quantity, price, date, fees

- **인덱스 최적화**
  - `portfolios(user_id)` - 사용자별 조회
  - `holdings(portfolio_id, ticker)` - 포트폴리오별 보유 종목
  - `transactions(portfolio_id, date)` - 거래 이력 조회

- **뷰 생성 (선택사항)**
  - `v_portfolio_summary` - 포트폴리오별 요약 통계
  - `v_holdings_with_current_price` - 보유 종목 + 현재가

### 📡 Data Fetcher
- **실시간 가격 업데이트** (`data_fetcher/fetchers/price_fetcher.py`)
  - FMP API를 통한 실시간 주가 조회
  - 배치 조회로 API 호출 최소화 (한 번에 여러 종목)
  - Redis 캐싱 (5분 TTL)

- **포트폴리오 밸류에이션**
  - 스케줄러: 장 마감 후 자동 계산
  - 보유 종목 가치 재계산
  - 일별 포트폴리오 스냅샷 저장

---

## 2. 거래 입력 폼 (Transaction Form)

### 📊 Frontend
- **컴포넌트 구조**
  - `TransactionForm.jsx` - 메인 거래 입력 폼
  - `TickerSearchInput.jsx` - 종목 검색 자동완성
  - `TransactionTypeSelector.jsx` - 매수/매도 선택
  - `DatePicker.jsx` - 거래일 선택
  - `TransactionHistory.jsx` - 거래 이력 테이블
  - `TransactionEditModal.jsx` - 거래 수정 모달

- **폼 필드**
  - 포트폴리오 선택 (드롭다운)
  - 종목 검색/선택 (자동완성)
  - 거래 유형 (매수/매도)
  - 수량 (정수)
  - 가격 (실수)
  - 거래일 (날짜)
  - 수수료 (선택사항)
  - 메모 (선택사항)

- **유효성 검사**
  - 필수 필드 검증
  - 매도 시 보유 수량 초과 체크
  - 가격/수량 양수 값 확인
  - 미래 날짜 입력 제한

- **API 연동**
  - `POST /api/transactions` - 거래 등록
  - `PUT /api/transactions/{id}` - 거래 수정
  - `DELETE /api/transactions/{id}` - 거래 삭제
  - `GET /api/transactions?portfolio_id={id}` - 거래 이력 조회

### 🔧 Backend
- **API 라우트** (`app/backend/api/routes/transactions.py` - 신규)
  - `POST /api/transactions` - 거래 생성
  - `GET /api/transactions` - 거래 이력 조회 (필터: portfolio_id, ticker, date_range)
  - `GET /api/transactions/{transaction_id}` - 거래 상세
  - `PUT /api/transactions/{transaction_id}` - 거래 수정
  - `DELETE /api/transactions/{transaction_id}` - 거래 삭제

- **서비스 레이어** (`app/backend/services/transaction_service.py` - 신규)
  - `create_transaction()` - 거래 생성 및 holdings 업데이트
  - `validate_sell_transaction()` - 매도 시 보유 수량 검증
  - `update_holdings()` - 거래 후 holdings 테이블 업데이트
  - `calculate_average_price()` - 평균 매입 단가 재계산
  - `delete_transaction()` - 거래 삭제 및 holdings 롤백

- **비즈니스 로직**
  - 매수: holdings에 수량 추가, 평균단가 재계산
  - 매도: holdings에서 수량 차감
  - 거래 후 포트폴리오 가치 자동 업데이트

### 💾 Database
- **테이블 스키마 확인**
  - `transactions` 테이블 필드
    - id (PK)
    - portfolio_id (FK)
    - ticker
    - transaction_type (ENUM: 'buy', 'sell')
    - quantity (DECIMAL)
    - price (DECIMAL)
    - transaction_date (DATE)
    - fees (DECIMAL, nullable)
    - notes (TEXT, nullable)
    - created_at (TIMESTAMP)
    - updated_at (TIMESTAMP)

- **제약 조건**
  - CHECK: quantity > 0, price > 0
  - FOREIGN KEY: portfolio_id -> portfolios(id)
  - INDEX: (portfolio_id, transaction_date)

### 📡 Data Fetcher
- **가격 자동 채우기**
  - 거래일의 종가 자동 조회 (FMP Historical API)
  - 사용자가 입력하지 않은 경우 자동 제안

---

## 3. 종목 스크리너 인터페이스 (Stock Screener)

### 📊 Frontend
- **컴포넌트 구조**
  - `StockScreener.jsx` - 메인 스크리너 페이지
  - `ScreenerFilters.jsx` - 필터 패널 (좌측 사이드바)
  - `FilterGroup.jsx` - 필터 그룹 (카테고리별)
  - `RangeSlider.jsx` - 범위 선택 슬라이더
  - `ScreenerResults.jsx` - 스크리닝 결과 테이블
  - `ScreenerPresets.jsx` - 사전 정의된 스크린 템플릿
  - `SaveScreenModal.jsx` - 스크린 저장 모달

- **필터 카테고리**
  - **기본 정보**: 시가총액, 섹터, 산업, 국가
  - **밸류에이션**: P/E, P/B, P/S, PEG, EV/EBITDA
  - **수익성**: ROE, ROA, 영업이익률, 순이익률
  - **성장성**: 매출 성장률, EPS 성장률, 영업이익 성장률
  - **재무 건전성**: 부채비율, 유동비율, 당좌비율
  - **배당**: 배당수익률, 배당성향, 연속 배당 연수
  - **기술적**: 가격 범위, 52주 신고가/신저가 대비, RSI, 거래량

- **프리셋 스크린**
  - 가치주 (Value Stocks)
  - 성장주 (Growth Stocks)
  - 배당 귀족 (Dividend Aristocrats)
  - 소형 성장주 (Small Cap Growth)
  - 저평가 대형주 (Undervalued Large Cap)

- **기능**
  - 다중 필터 조합
  - 실시간 결과 카운트
  - 결과 정렬 (모든 컬럼)
  - CSV 내보내기
  - 관심종목에 추가
  - 스크린 저장/불러오기

- **API 연동**
  - `POST /api/screener/screen` - 스크리닝 실행
  - `GET /api/screener/presets` - 프리셋 목록
  - `POST /api/screener/save` - 스크린 저장
  - `GET /api/screener/saved` - 저장된 스크린 목록

### 🔧 Backend
- **API 라우트** (`app/backend/api/routes/screener.py` - 기존 확장)
  - `POST /api/screener/screen` - 스크리닝 실행
    - Request body: 필터 조건 JSON
    - Response: 매칭된 종목 리스트
  - `GET /api/screener/filters` - 사용 가능한 필터 목록 및 메타데이터
  - `GET /api/screener/presets` - 사전 정의 스크린
  - `POST /api/screener/presets` - 커스텀 프리셋 생성
  - `GET /api/screener/saved` - 사용자 저장 스크린
  - `POST /api/screener/saved` - 스크린 저장
  - `DELETE /api/screener/saved/{id}` - 저장 스크린 삭제

- **서비스 레이어** (`app/backend/services/screener_service.py`)
  - `build_query()` - 필터 조건을 SQL 쿼리로 변환
  - `apply_filters()` - 동적 필터 적용
  - `execute_screen()` - 스크리닝 실행
  - `get_filter_metadata()` - 각 필터의 min/max 값 조회
  - `save_screen()` - 스크린 저장
  - `load_preset()` - 프리셋 로드

- **최적화**
  - 인덱스 활용
  - 쿼리 결과 캐싱 (Redis, 5분)
  - 페이지네이션

### 💾 Database
- **주요 테이블**
  - `mbs_in_stk_stbd` - 주식 기본 정보
  - `mbs_calc_metric` - 계산된 지표
  - `mbs_in_financial_metrics` - 재무 지표
  - `saved_screeners` - 사용자 저장 스크린
    - 컬럼: id, user_id, name, filters_json, created_at

- **인덱스 생성**
  - 자주 사용되는 필터 컬럼에 인덱스
  - `mbs_in_stk_stbd(market_cap, sector)`
  - `mbs_calc_metric(pe_ratio, pb_ratio, roe)`
  - Composite index 고려

- **뷰 생성**
  - `v_screener_universe` - 스크리닝용 통합 뷰
    - 기본 정보 + 재무 지표 + 기술적 지표 조인

### 📡 Data Fetcher
- **데이터 업데이트**
  - 일일: 기본 지표 (시가총액, P/E, P/B 등)
  - 주간: 재무제표 기반 지표
  - 실시간: 가격, 거래량

- **신규 Fetcher**
  - `fundamental_metrics_fetcher.py` - 펀더멘털 지표 수집
  - FMP API endpoints:
    - `/ratios` - 밸류에이션 비율
    - `/key-metrics` - 주요 지표
    - `/financial-growth` - 성장률

---

## 4. 알림 관리 페이지 (Alerts Management)

### 📊 Frontend
- **컴포넌트 구조**
  - `AlertsPage.jsx` - 알림 관리 메인 페이지
  - `AlertsList.jsx` - 알림 목록
  - `CreateAlertModal.jsx` - 알림 생성 모달
  - `AlertCard.jsx` - 개별 알림 카드
  - `AlertHistoryPanel.jsx` - 발생한 알림 이력
  - `AlertNotification.jsx` - 실시간 알림 토스트

- **알림 유형**
  - **가격 알림**
    - 목표가 도달 (상승/하락)
    - 퍼센트 변동 (일일, 주간)
  - **기술적 알림**
    - 이평선 돌파 (골든크로스/데드크로스)
    - RSI 과매수/과매도
    - 거래량 급증
  - **펀더멘털 알림**
    - 실적 발표일
    - 배당락일
    - 애널리스트 등급 변경
  - **뉴스 알림**
    - 키워드 매칭
    - 감성 분석 (긍정/부정)

- **기능**
  - 알림 생성/수정/삭제
  - 활성화/비활성화 토글
  - 알림 조건 설정 (임계값, 비교 연산자)
  - 알림 발송 채널 선택 (이메일, 푸시, 인앱)
  - 알림 이력 조회
  - 일괄 관리 (전체 활성화/비활성화)

- **API 연동**
  - `GET /api/alerts` - 알림 목록
  - `POST /api/alerts` - 알림 생성
  - `PUT /api/alerts/{id}` - 알림 수정
  - `DELETE /api/alerts/{id}` - 알림 삭제
  - `GET /api/alerts/history` - 알림 이력
  - `POST /api/alerts/{id}/test` - 알림 테스트 발송

### 🔧 Backend
- **API 라우트** (`app/backend/api/routes/alerts.py` - 기존 확장)
  - `GET /api/alerts` - 사용자 알림 목록
  - `POST /api/alerts` - 새 알림 생성
  - `GET /api/alerts/{alert_id}` - 알림 상세
  - `PUT /api/alerts/{alert_id}` - 알림 수정
  - `DELETE /api/alerts/{alert_id}` - 알림 삭제
  - `POST /api/alerts/{alert_id}/toggle` - 활성화 토글
  - `GET /api/alerts/history` - 발생 이력
  - `POST /api/alerts/{alert_id}/test` - 테스트 발송

- **서비스 레이어** (`app/backend/services/alert_service.py`)
  - `create_alert()` - 알림 생성 및 검증
  - `check_price_alerts()` - 가격 알림 체크
  - `check_technical_alerts()` - 기술적 알림 체크
  - `check_fundamental_alerts()` - 펀더멘털 이벤트 체크
  - `trigger_alert()` - 알림 발송 트리거
  - `send_notification()` - 실제 알림 전송 (이메일/푸시)

- **백그라운드 작업** (`app/backend/services/alert_scheduler.py` - 신규)
  - Celery 또는 APScheduler 사용
  - 1분마다: 가격 알림 체크
  - 5분마다: 기술적 지표 체크
  - 1시간마다: 뉴스 키워드 매칭

- **알림 채널**
  - 이메일: SMTP 설정
  - 푸시: Firebase Cloud Messaging (선택사항)
  - 웹소켓: 실시간 인앱 알림

### 💾 Database
- **테이블 확인/수정**
  - `alerts` 테이블
    - 컬럼: id, user_id, ticker, alert_type, condition, threshold, is_active, created_at
    - 예시: ticker='AAPL', type='price_above', threshold=200.0

- **알림 이력 테이블** (신규 생성)
  - `alert_history`
    - 컬럼: id, alert_id, triggered_at, value, message, is_sent

- **인덱스**
  - `alerts(user_id, is_active)` - 활성 알림 조회
  - `alerts(ticker, alert_type)` - 종목별 알림 체크
  - `alert_history(alert_id, triggered_at)` - 이력 조회

### 📡 Data Fetcher
- **실시간 모니터링**
  - WebSocket 또는 폴링으로 가격 변동 감지
  - 기술적 지표 실시간 계산
  - 뉴스 RSS 피드 모니터링

- **데이터 소스**
  - FMP: 실시간 가격, 뉴스
  - 자체 계산: 기술적 지표 (이평선, RSI 등)

---

## 5. 관심종목 위젯 (Watchlist Widget)

### 📊 Frontend
- **컴포넌트 구조**
  - `WatchlistWidget.jsx` - 메인 위젯 컨테이너
  - `WatchlistTabs.jsx` - 여러 관심종목 리스트 탭
  - `WatchlistTable.jsx` - 관심종목 테이블
  - `WatchlistRow.jsx` - 개별 종목 행
  - `AddToWatchlistButton.jsx` - 추가 버튼 (재사용 가능)
  - `CreateWatchlistModal.jsx` - 새 리스트 생성 모달
  - `WatchlistContextMenu.jsx` - 우클릭 메뉴

- **표시 정보**
  - 종목 코드 (Ticker)
  - 회사명
  - 현재가
  - 등락률 (%, 컬러 인디케이터)
  - 거래량
  - 시가총액
  - P/E 비율
  - 미니 차트 (스파크라인)

- **기능**
  - 드래그 앤 드롭으로 순서 변경
  - 종목 추가/삭제
  - 여러 관심종목 리스트 관리
  - 리스트 간 종목 이동
  - 실시간 가격 업데이트 (웹소켓)
  - 종목 클릭 시 상세 페이지 이동
  - CSV 내보내기
  - 알림 설정 바로가기

- **UI/UX**
  - Compact/Expanded 뷰 모드
  - 컬럼 표시/숨김 설정
  - 정렬 (가격, 등락률, 거래량 등)
  - 검색 필터

- **API 연동**
  - `GET /api/watchlists` - 관심종목 리스트 목록
  - `POST /api/watchlists` - 새 리스트 생성
  - `GET /api/watchlists/{id}/items` - 리스트 내 종목들
  - `POST /api/watchlists/{id}/items` - 종목 추가
  - `DELETE /api/watchlists/{id}/items/{ticker}` - 종목 제거
  - `PUT /api/watchlists/{id}/items/order` - 순서 변경

### 🔧 Backend
- **API 라우트** (`app/backend/api/routes/watchlist.py` - 신규)
  - `GET /api/watchlists` - 사용자 관심종목 리스트 조회
  - `POST /api/watchlists` - 새 리스트 생성
  - `PUT /api/watchlists/{watchlist_id}` - 리스트 이름 수정
  - `DELETE /api/watchlists/{watchlist_id}` - 리스트 삭제
  - `GET /api/watchlists/{watchlist_id}/items` - 리스트 내 종목 조회 (가격 포함)
  - `POST /api/watchlists/{watchlist_id}/items` - 종목 추가
  - `DELETE /api/watchlists/{watchlist_id}/items/{ticker}` - 종목 제거
  - `PUT /api/watchlists/{watchlist_id}/items/reorder` - 순서 변경

- **서비스 레이어** (`app/backend/services/watchlist_service.py` - 신규)
  - `create_watchlist()` - 관심종목 리스트 생성
  - `add_ticker()` - 종목 추가 (중복 체크)
  - `remove_ticker()` - 종목 제거
  - `get_watchlist_with_prices()` - 리스트 + 실시간 가격 조회
  - `reorder_items()` - 순서 업데이트

- **웹소켓** (`app/backend/websocket/price_stream.py` - 신규)
  - 실시간 가격 스트리밍
  - 관심종목만 선택적 구독
  - 효율적인 브로드캐스팅

### 💾 Database
- **테이블 확인/수정**
  - `watchlists` 테이블
    - 컬럼: id, user_id, name, description, created_at, updated_at

- **관심종목 항목 테이블** (스키마 확인 필요)
  - `watchlist_items` (존재하지 않으면 생성)
    - 컬럼: id, watchlist_id, ticker, sort_order, added_at
    - UNIQUE(watchlist_id, ticker) - 중복 방지

- **인덱스**
  - `watchlists(user_id)`
  - `watchlist_items(watchlist_id, sort_order)`

### 📡 Data Fetcher
- **실시간 가격 스트림**
  - FMP WebSocket 또는 폴링
  - 관심종목만 선택적 업데이트
  - Redis Pub/Sub으로 백엔드에 전달

- **배치 가격 조회**
  - 관심종목 리스트 로드 시 일괄 조회
  - `/quote/{tickers}` API 활용

---

## 개발 우선순위 제안

### Phase 1: 핵심 기능 (2-3주)
1. **관심종목 위젯** - 가장 독립적이고 사용자 참여도 높음
2. **거래 입력 폼** - 포트폴리오 기능의 기반

### Phase 2: 데이터 분석 (2-3주)
3. **포트폴리오 대시보드** - 거래 데이터 활용
4. **종목 스크리너** - 데이터 집약적, 최적화 필요

### Phase 3: 고급 기능 (1-2주)
5. **알림 관리** - 백그라운드 작업 필요

---

## 기술 스택 요약

### Frontend
- React 18
- Zustand (상태 관리)
- React-Grid-Layout (대시보드)
- Recharts / Chart.js (차트)
- TanStack Table (테이블)
- React Hook Form (폼)
- TailwindCSS (스타일링)

### Backend
- FastAPI
- SQLAlchemy
- JWT 인증
- Pydantic (검증)
- APScheduler (백그라운드 작업)
- Redis (캐싱)

### Database
- SQLite (개발/소규모)
- PostgreSQL (프로덕션 권장)

### Data Fetcher
- FMP API
- Requests / httpx
- Schedule / APScheduler

---

## 공통 개발 가이드라인

### 코드 컨벤션
- Frontend: ESLint + Prettier
- Backend: Black + isort
- 타입 힌팅 필수 (Python, TypeScript)

### 에러 핸들링
- 모든 API는 일관된 에러 응답 형식
- 프론트엔드에서 사용자 친화적 에러 메시지

### 성능 최적화
- API 응답 캐싱 (Redis)
- DB 쿼리 최적화 (인덱스, 페이지네이션)
- 프론트엔드 lazy loading

### 테스팅
- Backend: pytest
- Frontend: Vitest + React Testing Library
- E2E: Playwright (선택사항)

### 보안
- SQL Injection 방지 (ORM 사용)
- XSS 방지 (입력 sanitization)
- CSRF 토큰
- Rate limiting

---

## 다음 단계

1. 각 기능별 상세 기술 명세서 작성
2. UI/UX 와이어프레임 제작
3. DB 스키마 최종 확정 및 마이그레이션 스크립트
4. API 명세서 (Swagger/OpenAPI)
5. 개발 스프린트 계획 수립

---

**문서 버전**: 1.0
**작성일**: 2026-01-07
**작성자**: Claude Code
