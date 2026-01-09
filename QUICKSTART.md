# MarketPulse Quick Start Guide

## Prerequisites

- Python 3.9+
- Node.js 16+
- Redis (optional, for queue features)

## 1. Environment Setup

### Copy and configure .env file

The `.env` file is already configured in the project root. Verify that it contains your API keys:

```bash
# Check your .env file
cat .env
```

Required API keys:
- `FRED_API_KEY` - Federal Reserve Economic Data (get from https://fred.stlouisfed.org/docs/api/api_key.html)
- `ALPHA_VANTAGE_API_KEY` - Alpha Vantage for Forex data (get from https://www.alphavantage.co/support/#api-key)
- `POLYGON_API_KEY` - Polygon.io for stock data (get from https://polygon.io)
- `FMP_API_KEY` - Financial Modeling Prep (get from https://site.financialmodelingprep.com/developer/docs)

## 2. Backend Setup

### Install Python dependencies

```bash
# Create virtual environment (if not already created)
python -m venv .venv

# Activate virtual environment
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Initialize Database

```bash
# Create database tables
python create_tables.py
```

### Start Backend Server

```bash
# Method 1: Using run.py
cd app/backend
python run.py

# Method 2: Using uvicorn directly
cd app/backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend will automatically:
- Load environment variables from `.env`
- Verify critical API keys
- Start the FastAPI server on http://localhost:8000

You should see:
```
✓ Loaded environment variables from C:\...\marketpulse\.env
✓ All critical API keys loaded
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

## 3. Frontend Setup

### Install Node dependencies

```bash
cd app/frontend
npm install
```

### Start Frontend Development Server

```bash
npm run dev
```

The frontend will start on http://localhost:5173

## 4. Access the Application

1. Open your browser to http://localhost:5173
2. Navigate to the "Macro" tab
3. Click on "Economic Regime" to view the regime dashboard

## Troubleshooting

### "Unable to load regime data" error

This means the backend cannot fetch data from FRED API. Check:

1. **Backend is running**: Visit http://localhost:8000/health
2. **API key is set**: Check that `FRED_API_KEY` is in your `.env` file
3. **Backend logs**: Look for error messages in the terminal where you started the backend

### Missing API keys warning

If you see:
```
⚠ Warning: Missing API keys:
  - FRED_API_KEY (Federal Reserve Economic Data)
```

Solution:
1. Edit the `.env` file in the project root
2. Add your API key: `FRED_API_KEY=your_api_key_here`
3. Restart the backend server

### Database errors

If you see database errors:
```bash
# Recreate the database
python create_tables.py
```

## Environment Variables

The application automatically loads `.env` files from:
- Project root: `C:\Users\TRIA\PycharmProjects\marketpulse\.env`

When the backend starts, it will print confirmation:
```
✓ Loaded environment variables from C:\...\marketpulse\.env
✓ All critical API keys loaded
```

No manual environment variable setup is needed!

## API Endpoints

- Health check: http://localhost:8000/health
- API docs: http://localhost:8000/docs
- Economic regime: http://localhost:8000/api/macro/regime/current
- Regime history: http://localhost:8000/api/macro/regime/history?period=5y

## Next Steps

- Explore other tabs: Overview, Commodities, Banking & Credit, etc.
- Check out the Portfolio and Backtest features
- Review API documentation at http://localhost:8000/docs
