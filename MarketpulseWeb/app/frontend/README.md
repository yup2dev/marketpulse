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
frontend/
├── src/
│   ├── components/        # React components
│   │   ├── Dashboard.jsx  # Main dashboard
│   │   └── DataWidget.jsx # Reusable widget component
│   ├── config/
│   │   └── api.js         # API client and endpoints
│   ├── hooks/
│   │   └── useApi.js      # Custom API hooks
│   ├── App.jsx           # Root component
│   └── main.jsx          # Entry point
├── public/               # Static assets
├── package.json          # Dependencies
└── vite.config.js        # Vite configuration
```

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
