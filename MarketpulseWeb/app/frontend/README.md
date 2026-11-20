# MarketPulse Frontend

React-based frontend dashboard for MarketPulse financial data visualization.

## Features

- Real-time market data visualization
- Customizable dashboard with drag-and-drop widgets
- Interactive charts using Recharts
- Responsive grid layout
- Dark theme UI
- API connection status indicator

## Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Update the API URL if needed (default: `http://localhost:8000`):

```
VITE_API_URL=http://localhost:8000
```

## Running the Application

### Development Mode

```bash
npm run devㅞㅡ
```

The application will be available at http://localhost:5173

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
src/
├─ main.jsx · App.jsx · index.css   진입점 · 라우트 · 전역 CSS(테마 변수)
├─ app/            앱 껍데기 — 모든 화면을 감싸는 틀 (AppLayout · ProtectedRoute · ErrorBoundary ·
│                  GlobalLoadingOverlay · FetcherStatus · CopilotPanel)
├─ pages/          라우트 하나 = 폴더 하나. 그 화면에서만 쓰는 부품은 그 안에
│  ├─ dashboard/   DashboardPage · DashboardGrid · DashboardPane · SplitPaneLayout
│  ├─ settings/    SettingsPage · WidgetEditor · WidgetSettings · WidgetTypeAdmin …
│  └─ auth/        Login · Register
├─ widget/         위젯 시스템 — 위젯이 어떻게 정의되고 그려지는가
│  ├─ engine/      mp-widgets 라이브러리 (DataWidget · 스펙 · views/) — README.md 참고
│  ├─ registry/    위젯 정의 · 화면 배치 · 크기 (widgetEndpoints · urlWidgetMap · widgetSizes · builtinWidgets …)
│  ├─ render/      UniversalWidget · UserWidget · WidgetRenderer · WidgetMenu · autoRender
│  └─ widgets/     컴포넌트가 따로 있는 개별 위젯 (chartstudio · backtest · providerViews 템플릿)
├─ common/         도메인 무관 공통 — 아래 api/format/ui 는 common/index.js 로만 import
│  ├─ api/ · format/ · ui/   요청 · 표기 · Modal/dialog/notify
│  ├─ widget/      모든 위젯이 쓰는 껍데기·부품 (BaseWidget · WidgetCard · WidgetState · Select · Popover …)
│  ├─ components/  범용 부품 (CommonTable · CommonChart · SymbolAutocomplete · StockSelector · ThemeToggle …)
│  └─ util/        exportUtils · themeUtils
├─ lib/            외부 라이브러리 감싸기 — plotly (PlotlyChart · PlotlyRawChart · plotlyTheme)
├─ hooks/          앱 수준 훅 · store/ zustand 전역 상태 · contexts/ React context · styles/ JS 테마 토큰
```

어디에 둘지 정하는 기준:

1. 라우트 화면이면 `pages/`, 모든 화면을 감싸는 틀이면 `app/`.
2. 위젯을 정의하거나 그리는 코드면 `widget/`, 위젯들이 같이 쓰는 UI 부품이면 `common/widget/`.
3. 도메인과 무관하고 두 곳 이상에서 쓰면 `common/`. 한 곳에서만 쓰면 그 화면·위젯 폴더에 둔다.
4. 외부 라이브러리를 직접 감싸는 코드는 `lib/`.
5. `components/` 같은 이름만 보고 역할을 알 수 없는 폴더는 만들지 않는다.

## API Integration

Shared code lives in `src/common/` and is imported only through `src/common/index.js`.

- `common/api/base.js` — backend URL (`VITE_API_URL`, falls back to `http://localhost:8000`)
- `common/api/client.js` — `apiClient` (Bearer token, 401/403 → refresh → retry, `stream()` for SSE)
- `common/api/endpoints.js` — per-domain API objects (`authAPI`, `portfolioAPI`, …)
- `common/api/useApi.js` — GET hook
- `common/api/localFetcher.js` — local Fetcher (`127.0.0.1:8765`): health, shutdown, token hand-off
- `common/format/` — number/date formatting (`fmtPct`, `fmtCompact`, `fmtNumber`, `fmtPrice`, `fmtDate`)

```javascript
import { useApi, portfolioAPI, fmtPct } from '../common';

// path is relative to /api; reloads when the path changes, optional silent refresh interval
const { data, loading, error, reload } = useApi('/stock/ranking/live?market=us', { refresh: 30000 });

const portfolios = await portfolioAPI.getAll();
```

## Components

### Dashboard

The main dashboard component with:
- Draggable and resizable widgets
- Multiple breakpoints for responsive design
- Layout persistence in localStorage
- API connection status indicator

### DataWidget

Reusable widget component supporting:
- Table and chart views
- Date range selection
- Refresh functionality
- Custom styling

## Development

### Code Style

The project uses ESLint for code quality:

```bash
npm run lint
```

### Technologies

- React 19
- Vite 7
- Tailwind CSS 4
- Recharts
- React Grid Layout
- Lucide React (icons)

## Backend Connection

Make sure the backend is running at http://localhost:8000 before starting the frontend.

See `../backend/README.md` for backend setup instructions.

## License

MIT License
