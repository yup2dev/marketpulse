# MarketPulse Dashboard

위젯 기반 금융 데이터 시각화 대시보드

## 기능

- **실시간 주식 정보**: 주가, 변동률, 거래량 등
- **가격 차트**: 캔들스틱 차트와 거래량
- **회사 프로필**: 기업 정보, 섹터, 산업 등
- **경제 지표**: GDP, 실업률, CPI, 금리 등
- **다크 테마**: 눈에 편한 다크 모드 UI
- **위젯 시스템**: 각 위젯을 독립적으로 새로고침 가능

## 프로젝트 구조

```
marketpulse_app/
├── main.py                 # FastAPI 메인 애플리케이션
├── api/
│   └── routes/            # API 라우터
│       ├── stock.py       # 주식 데이터 엔드포인트
│       ├── economic.py    # 경제 지표 엔드포인트
│       ├── news.py        # 뉴스 엔드포인트
│       └── dashboard.py   # 대시보드 엔드포인트
├── services/
│   └── data_service.py    # 데이터 페처 통합
├── static/
│   ├── css/
│   │   └── style.css      # 다크 테마 스타일
│   └── js/
│       ├── app.js         # 메인 애플리케이션 로직
│       ├── widgets.js     # 위젯 관리
│       └── charts.js      # 차트 관리
└── templates/
    └── index.html         # 메인 대시보드 페이지
```

## 설치 및 실행

### 1. 의존성 설치

```bash
pip install -r marketpulse_app/requirements.txt
```

### 2. 환경 변수 설정 (선택사항)

API 키가 필요한 경우 `.env` 파일을 생성하세요:

```
ALPHAVANTAGE_API_KEY=your_key_here
POLYGON_API_KEY=your_key_here
FMP_API_KEY=your_key_here
```

### 3. 서버 실행

```bash
cd marketpulse_app
python main.py
```

또는:

```bash
uvicorn marketpulse_app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 브라우저에서 접속

```
http://localhost:8000/api/
```

## API 엔드포인트

### 주식 데이터
- `GET /api/stock/quote/{symbol}` - 현재 주가 정보
- `GET /api/stock/history/{symbol}?period=1mo` - 과거 주가 데이터
- `GET /api/stock/info/{symbol}` - 회사 정보

### 경제 지표
- `GET /api/economic/indicators` - 주요 경제 지표

### 뉴스
- `GET /api/news/?symbol={symbol}&limit=10` - 시장 뉴스

### 대시보드
- `GET /api/` - 메인 대시보드 페이지
- `GET /api/overview/{symbol}` - 주식 전체 개요

## 사용 방법

1. **검색창**: 상단 검색창에 종목 심볼 입력 (예: NVDA, AAPL, TSLA)
2. **위젯 새로고침**: 각 위젯 우측 상단의 새로고침 버튼 클릭
3. **탭 전환**: Overview, Financials, Technical Analysis, News 탭 전환
4. **키보드 단축키**: Ctrl+K로 검색창 포커스

## 기술 스택

### 백엔드
- FastAPI - 고성능 웹 프레임워크
- Uvicorn - ASGI 서버
- Jinja2 - 템플릿 엔진

### 프론트엔드
- Vanilla JavaScript - 프레임워크 없이 순수 JS
- Chart.js - 차트 라이브러리
- CSS Grid & Flexbox - 반응형 레이아웃

### 데이터 소스
- Yahoo Finance - 주가 및 회사 정보
- FRED - 경제 지표
- Polygon.io - 뉴스 및 시장 데이터
- Financial Modeling Prep - 재무 데이터

## 커스터마이징

### 새로운 위젯 추가

1. `templates/index.html`에 위젯 HTML 추가
2. `static/css/style.css`에 스타일 추가
3. `static/js/widgets.js`에 업데이트 함수 추가
4. `api/routes/`에 필요한 엔드포인트 추가

### 테마 변경

`static/css/style.css`의 `:root` 변수 수정:

```css
:root {
    --bg-primary: #0a0e14;
    --accent-primary: #00d9ff;
    /* ... */
}
```

## 라이선스

MIT License
