# MarketPulse Roadmap

**작성일**: 2026-05-21  
**기준**: OpenBB Architecture 비교 분석 + 현재 백엔드/프론트엔드 갭 분석

---

## 현재 구조 요약

### 프론트엔드 라우트
| 경로 | 페이지 | 상태 |
|---|---|---|
| `/` | Dashboard (워크스페이스, 스플릿 패인) | 활성 |
| `/stock` | Stock Analysis (7개 탭, 14+ 위젯) | 활성 |
| `/macro` | Macro (4개 탭, 13+ 위젯) | 활성 |
| `/portfolios` | Portfolio (4개 탭, 5 위젯) | 활성 |
| `/quantlib` | QuantLib + Quant Analytics (2개 탭, 6 위젯) | 활성 |
| `/alerts` | Alerts | 라우트만 존재, 위젯 없음 |

### 위젯 아키텍처
| 유형 | 설명 | 사용처 |
|---|---|---|
| **UniversalWidget** | endpoint + 자동 렌더링 (테이블/차트/KV) | 90% 이상 위젯 |
| **Custom Component** | 전용 컴포넌트 (PortfolioStatsWidget, ChartWidget) | 특수 UI |
| **widgetPatterns** | 재사용 프리미티브 (VerticalBarChart, TabBar, KVTable 등) | 내부 위젯 빌딩블록 |

### 데이터 제공자 (백엔드)
| Provider | 경로 | 용도 |
|---|---|---|
| FMP | `services/fmp/` | 주가, 재무제표, 내부자거래, SEC 공시 |
| Yahoo | `services/yahoo/` | 주주, 기관보유 |
| FRED | `services/fred/` | 거시경제 지표 |
| Polygon | `services/polygon/` | 시장 데이터 |
| Social | `services/social/` | Reddit, 소셜 감성 |

---

## 1순위: 백엔드 완비 → 프론트엔드 위젯 연결

백엔드 API가 이미 존재하지만 프론트엔드 위젯이 없는 기능.

### 1.1 Watchlist 위젯
- **백엔드**: `routes/watchlist.py` — CRUD, 종목 추가/삭제, 정렬
- **위젯 형태**: 실시간 가격 목록 + 빠른 추가/삭제 + 드래그 정렬
- **등록 위치**: Dashboard, Stock 페이지 위젯 카탈로그
- **난이도**: 낮음

### 1.2 Screener 위젯
- **백엔드**: `routes/screener.py` — 조건 필터, 프리셋 저장/실행, 섹터 조회
- **위젯 형태**: 필터 폼 + 결과 테이블 + 프리셋 드롭다운
- **등록 위치**: Dashboard 위젯 카탈로그
- **난이도**: 중간

### 1.3 Alerts 위젯
- **백엔드**: `routes/alerts.py` — CRUD, on/off 토글, 히스토리, 테스트 실행
- **위젯 형태**: 활성 알림 카드 + 최근 트리거 타임라인
- **등록 위치**: `/alerts` 페이지 (urlWidgetMap 추가 필요)
- **난이도**: 중간

### 1.4 News Feed 위젯
- **백엔드**: `routes/news.py`
- **위젯 형태**: 뉴스 타임라인 (현재 sentiment 위젯에 일부 포함, 독립 분리)
- **등록 위치**: Dashboard, Stock 페이지
- **난이도**: 낮음

---

## 2순위: 신규 위젯 유형

### 시각화형
| 위젯 | 설명 | 데이터 소스 |
|---|---|---|
| **Heatmap** | 섹터/산업별 트리맵 (S&P 500 스타일) | screener 또는 신규 endpoint |
| **Correlation Matrix** | 다중 종목 상관계수 매트릭스 | quantitative 서비스 확장 |
| **Comparison** | 2~4 종목 나란히 비교 (가격, 재무, 밸류에이션) | stock 서비스 조합 |
| **Mini Chart (Sparkline)** | 작은 차트, 대시보드 개요용 | 기존 price endpoint |

### 인터랙티브형
| 위젯 | 설명 | 비고 |
|---|---|---|
| **Economic Calendar** | 이번 주 경제지표 발표 일정 | FRED 또는 외부 API |
| **Terminal/Command** | 텍스트 명령 입력 → 결과 (OpenBB 스타일) | 모든 endpoint 통합 호출 |
| **Note/Memo** | 종목별/페이지별 메모 기록 | 신규 백엔드 필요 |

---

## 3순위: 인프라 개선

### 3.1 캐싱 계층
- **현재**: 캐싱 없음, 매 요청마다 외부 API 호출
- **목표**: Redis 또는 인메모리 캐시 (TTL 기반)
- **적용 대상**: macro 지표 (갱신 빈도 낮음), stock fundamentals, FRED 시계열
- **참고**: OpenBB는 aiohttp-client-cache 사용 (Redis/SQLite/MongoDB/Filesystem)

### 3.2 Workspace 서버 동기화
- **현재**: 프론트엔드 localStorage에만 저장
- **목표**: 백엔드 `routes/workspace.py` API와 연동 → 멀티 디바이스 지원
- **백엔드**: 이미 CRUD + default 설정 API 존재

### 3.3 Provider 추상화 (OpenBB 패턴)
- **현재**: `services/fmp/`, `services/yahoo/` 등 각각 독립 구현
- **목표**: 공통 Fetcher 인터페이스
  ```
  transform_query() → extract_data() → transform_data()
  ```
- **이점**: 새 데이터 소스 추가 시 구현 일관성, 테스트 용이

### 3.4 WebSocket 실시간 데이터
- **현재**: REST polling
- **목표**: WebSocket으로 실시간 가격 업데이트 (Watchlist, Chart)
- **난이도**: 높음 (백엔드 구조 변경 필요)

---

## 4순위: UX 고도화

| 기능 | 설명 |
|---|---|
| **쿼리 히스토리** | 사용자 검색/조회 이력 저장 및 재실행 |
| **대시보드 템플릿** | 미리 구성된 워크스페이스 프리셋 (Trading, Research, Macro 등) |
| **키보드 단축키** | 위젯 추가, 탭 전환, 스플릿 등 단축키 지원 |
| **위젯 간 연동** | 한 위젯에서 종목 클릭 → 다른 위젯 자동 업데이트 |
| **PDF/보고서 생성** | 대시보드 현재 상태를 PDF로 내보내기 |
| **다크/라이트 테마** | ThemeToggle 존재하지만 실제 테마 전환 구현 확인 필요 |

---

## 참고: OpenBB vs MarketPulse 비교

| 항목 | OpenBB | MarketPulse |
|---|---|---|
| 데이터 제공자 | 90+ providers, 통합 인터페이스 | 5개 (fmp, yahoo, fred, polygon, social) |
| 캐싱 | Redis/SQLite/MongoDB 선택 | 없음 |
| 실시간 | 미지원 | 미지원 |
| 포트폴리오 | Pro만 지원 | 자체 구현 완료 |
| 위젯 시스템 | Pro에서 제공 | 자체 UniversalWidget + Split Pane |
| 쿼리 히스토리 | 미지원 | 미지원 |
| 사용자 인증 | 미지원 (단일 사용자) | JWT 기반 다중 사용자 |
| 데스크톱 | Tauri 앱 | 웹 앱 (Docker) |

### MarketPulse 차별점
- 다중 사용자 인증 시스템
- 위젯 기반 커스터마이징 (스플릿 패인, 워크스페이스)
- 포트폴리오 관리 (트레이드, P&L 추적)
- QuantLib 옵션 프라이싱 통합
- 통계 분석 (CAPM, 정규성 검정, ADF, Rolling)
