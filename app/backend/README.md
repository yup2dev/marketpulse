# MarketPulse Backend

FastAPI-based backend server for MarketPulse financial dashboard.

## Setup

### 1. Create Virtual Environment

```bash
cd backend
python -m venv venv
```

### 2. Activate Virtual Environment

**Windows:**
```bash
venv\Scripts\activate
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Copy `.env.example` to `.env` and update with your configuration:

```bash
cp .env.example .env
```

## Running the Server

### Development Mode

```bash
python run.py
```

Or using uvicorn directly:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- API: http://localhost:8000
- API Documentation: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

## API Endpoints

### Core Endpoints

- `GET /` - API information
- `GET /health` - Health check
- `GET /docs` - Interactive API documentation

### Stock Data

- `GET /api/stock/overview` - Stock market overview
- `GET /api/stock/{symbol}/price` - Get current price for a symbol
- `GET /api/stock/{symbol}/history` - Get historical data

### Economic Data

- `GET /api/economic/indicators` - Economic indicators
- `GET /api/economic/overview` - Economic overview

### News

- `GET /api/news/latest` - Latest financial news
- `GET /api/news/{symbol}` - News for specific symbol

### Dashboard

- `GET /api/dashboard/overview` - Dashboard overview data
- `GET /api/dashboard/summary` - Dashboard summary

## Project Structure

```
backend/
├── api/
│   └── routes/          # API route handlers
│       ├── stock.py
│       ├── economic.py
│       ├── news.py
│       └── dashboard.py
├── services/            # Business logic services
├── main.py             # FastAPI application
├── run.py              # Server runner
├── requirements.txt    # Python dependencies
└── .env.example        # Environment variables template
```

## Development

### Running Tests

```bash
pytest
```

### Code Formatting

```bash
black .
```

## CORS Configuration

The backend is configured to accept requests from:
- http://localhost:5173 (Vite default)
- http://localhost:3000 (React default)
- http://127.0.0.1:5173

Update `main.py` to add additional origins if needed.

## License

MIT License
