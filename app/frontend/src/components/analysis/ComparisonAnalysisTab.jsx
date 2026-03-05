/**
 * Comparison Analysis Tab - Multi-stock comparison with financial metrics
 * Design based on professional trading terminal style
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, X, RefreshCw, Copy, MoreVertical } from 'lucide-react';
import { API_BASE } from '../../config/api';
import TickerSearch from '../common/TickerSearch';

// Category tabs with their metrics
const CATEGORIES = [
  {
    id: 'valuation',
    name: 'Valuation Multiples',
    metrics: [
      { key: 'pe_ratio', label: 'P/E Ratio' },
      { key: 'forward_pe', label: 'Forward P/E' },
      { key: 'peg_ratio', label: 'PEG Ratio' },
      { key: 'ps_ratio', label: 'P/S Ratio' },
      { key: 'pb_ratio', label: 'P/B Ratio' },
      { key: 'ev_ebitda', label: 'EV/EBITDA' },
      { key: 'ev_revenue', label: 'EV/Revenue' },
      { key: 'price_to_fcf', label: 'Price/FCF' },
    ]
  },
  {
    id: 'financial',
    name: 'Financial Ratios',
    metrics: [
      { key: 'current_ratio', label: 'Current Ratio' },
      { key: 'quick_ratio', label: 'Quick Ratio' },
      { key: 'debt_to_equity', label: 'Debt/Equity' },
      { key: 'debt_to_assets', label: 'Debt/Assets' },
      { key: 'interest_coverage', label: 'Interest Coverage' },
    ]
  },
  {
    id: 'liquidity',
    name: 'Liquidity',
    metrics: [
      { key: 'current_ratio', label: 'Current Ratio' },
      { key: 'quick_ratio', label: 'Quick Ratio' },
      { key: 'cash_ratio', label: 'Cash Ratio' },
      { key: 'working_capital', label: 'Working Capital' },
    ]
  },
  {
    id: 'efficiency',
    name: 'Efficiency',
    metrics: [
      { key: 'days_sales_outstanding', label: 'Days of Sales Outstanding' },
      { key: 'days_inventory_outstanding', label: 'Days of Inventory Outstanding' },
      { key: 'operating_cycle', label: 'Operating Cycle' },
      { key: 'days_payables_outstanding', label: 'Days of Payables Outstanding' },
      { key: 'cash_conversion_cycle', label: 'Cash Conversion Cycle' },
      { key: 'receivables_turnover', label: 'Receivables Turnover' },
      { key: 'inventory_turnover', label: 'Inventory Turnover' },
      { key: 'asset_turnover', label: 'Asset Turnover' },
    ]
  },
  {
    id: 'profitability',
    name: 'Profitability',
    metrics: [
      { key: 'gross_margin', label: 'Gross Margin' },
      { key: 'operating_margin', label: 'Operating Margin' },
      { key: 'net_margin', label: 'Net Margin' },
      { key: 'roe', label: 'ROE' },
      { key: 'roa', label: 'ROA' },
      { key: 'roic', label: 'ROIC' },
    ]
  },
  {
    id: 'leverage',
    name: 'Leverage',
    metrics: [
      { key: 'debt_to_equity', label: 'Debt/Equity' },
      { key: 'debt_to_assets', label: 'Debt/Assets' },
      { key: 'long_term_debt_to_equity', label: 'LT Debt/Equity' },
      { key: 'financial_leverage', label: 'Financial Leverage' },
    ]
  },
  {
    id: 'coverage',
    name: 'Coverage',
    metrics: [
      { key: 'interest_coverage', label: 'Interest Coverage' },
      { key: 'debt_service_coverage', label: 'Debt Service Coverage' },
      { key: 'fixed_charge_coverage', label: 'Fixed Charge Coverage' },
    ]
  },
  {
    id: 'cashflow',
    name: 'Operating Cash Flow',
    metrics: [
      { key: 'operating_cash_flow', label: 'Operating CF' },
      { key: 'free_cash_flow', label: 'Free Cash Flow' },
      { key: 'fcf_margin', label: 'FCF Margin' },
      { key: 'ocf_to_debt', label: 'OCF/Debt' },
      { key: 'capex_to_revenue', label: 'CapEx/Revenue' },
    ]
  },
];

const PERIODS = [
  { id: 'FY', label: 'FY' },
  { id: 'Q1', label: 'Q1' },
  { id: 'Q2', label: 'Q2' },
  { id: 'Q3', label: 'Q3' },
  { id: 'Q4', label: 'Q4' },
  { id: 'TTM', label: 'TTM' },
];

const YEARS = ['2025', '2024', '2023', '2022', '2021'];

export default function ComparisonAnalysisTab({ symbol: initialSymbol = 'AAPL' }) {
  const [symbols, setSymbols] = useState([initialSymbol]);
  const [stockData, setStockData] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('valuation');
  const [period, setPeriod] = useState('FY');
  const [year, setYear] = useState('2024');
  const [showAddTicker, setShowAddTicker] = useState(false);
  const addTickerRef = useRef(null);

  // Close add ticker dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (addTickerRef.current && !addTickerRef.current.contains(event.target)) {
        setShowAddTicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load data for all symbols
  const loadData = useCallback(async () => {
    if (symbols.length === 0) return;

    setLoading(true);
    try {
      const dataPromises = symbols.map(async (sym) => {
        const [infoRes, metricsRes, financialsRes] = await Promise.all([
          fetch(`${API_BASE}/stock/info/${sym}`),
          fetch(`${API_BASE}/stock/metrics/${sym}`),
          fetch(`${API_BASE}/stock/financials/${sym}?freq=annual&limit=1`),
        ]);

        const info = infoRes.ok ? await infoRes.json() : {};
        const metrics = metricsRes.ok ? await metricsRes.json() : {};
        const financials = financialsRes.ok ? await financialsRes.json() : {};

        return {
          symbol: sym,
          info,
          metrics,
          financials,
        };
      });

      const results = await Promise.all(dataPromises);
      const dataMap = {};
      results.forEach(r => {
        dataMap[r.symbol] = r;
      });
      setStockData(dataMap);
    } catch (error) {
      console.error('Error loading comparison data:', error);
    } finally {
      setLoading(false);
    }
  }, [symbols]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.length]);

  // Add symbol from TickerSearch
  const addSymbol = (stock) => {
    const sym = stock.symbol;
    if (!symbols.includes(sym) && symbols.length < 10) {
      setSymbols(prev => [...prev, sym]);
    }
    setShowAddTicker(false);
  };

  const removeSymbol = (sym) => {
    if (symbols.length > 1) {
      setSymbols(prev => prev.filter(s => s !== sym));
      setStockData(prev => {
        const newData = { ...prev };
        delete newData[sym];
        return newData;
      });
    }
  };

  const currentCategory = CATEGORIES.find(c => c.id === activeCategory);

  // Format large numbers
  const formatLargeNumber = (num) => {
    if (num === null || num === undefined) return '-';
    if (Math.abs(num) >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (Math.abs(num) >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  // Format percentage (values from API are in decimal form, e.g., 0.42 for 42%)
  const formatPercent = (val) => {
    if (val === null || val === undefined) return '-';
    return (val * 100).toFixed(2) + '%';
  };

  // Format ratio (simple decimal)
  const formatRatio = (val) => {
    if (val === null || val === undefined) return '-';
    return val.toFixed(2);
  };

  // Metrics that should be displayed as percentages
  const PERCENT_METRICS = [
    'gross_margin', 'operating_margin', 'net_margin',
    'roe', 'roa', 'roic', 'fcf_margin',
    'dividend_yield', 'payout_ratio', 'revenue_growth',
    'earnings_growth', 'earnings_quarterly_growth'
  ];

  // Metrics that should be displayed as large numbers
  const LARGE_NUMBER_METRICS = [
    'operating_cash_flow', 'free_cash_flow', 'working_capital',
    'market_cap', 'enterprise_value'
  ];

  // Get metric value from stock data
  const getMetricValue = (sym, metricKey) => {
    const data = stockData[sym];
    if (!data) return '-';

    const metrics = data.metrics || {};
    const fin = data.financials?.periods?.[0];
    const income = fin?.income_statement || {};
    const balance = fin?.balance_sheet || {};
    const cashflow = fin?.cash_flow || {};

    let val = null;

    // First try to get from metrics API
    if (metrics[metricKey] !== undefined && metrics[metricKey] !== null) {
      val = metrics[metricKey];
    } else {
      // Calculate from financials if not available in metrics
      switch (metricKey) {
        // Profitability from financials
        case 'gross_margin':
          val = income.revenue && income.gross_profit
            ? income.gross_profit / income.revenue
            : null;
          break;
        case 'operating_margin':
          val = income.revenue && income.operating_income
            ? income.operating_income / income.revenue
            : null;
          break;
        case 'net_margin':
          val = income.revenue && income.net_income
            ? income.net_income / income.revenue
            : null;
          break;
        case 'fcf_margin':
          val = income.revenue && cashflow.free_cash_flow
            ? cashflow.free_cash_flow / income.revenue
            : null;
          break;
        // Liquidity from financials
        case 'current_ratio':
          val = balance.current_assets && balance.current_liabilities
            ? balance.current_assets / balance.current_liabilities
            : null;
          break;
        case 'quick_ratio':
          val = balance.current_assets && balance.current_liabilities
            ? (balance.current_assets - (balance.inventory || 0)) / balance.current_liabilities
            : null;
          break;
        case 'cash_ratio':
          val = balance.cash && balance.current_liabilities
            ? balance.cash / balance.current_liabilities
            : null;
          break;
        case 'working_capital':
          val = balance.current_assets && balance.current_liabilities
            ? balance.current_assets - balance.current_liabilities
            : null;
          break;
        // Leverage from financials
        case 'debt_to_equity':
          val = balance.total_debt && balance.total_equity
            ? balance.total_debt / balance.total_equity
            : null;
          break;
        case 'debt_to_assets':
          val = balance.total_debt && balance.total_assets
            ? balance.total_debt / balance.total_assets
            : null;
          break;
        case 'long_term_debt_to_equity':
          val = balance.total_debt && balance.total_equity
            ? balance.total_debt / balance.total_equity
            : null;
          break;
        case 'financial_leverage':
          val = balance.total_assets && balance.total_equity
            ? balance.total_assets / balance.total_equity
            : null;
          break;
        // Cash Flow from financials
        case 'operating_cash_flow':
          val = cashflow.operating_cash_flow;
          break;
        case 'free_cash_flow':
          val = cashflow.free_cash_flow;
          break;
        case 'ocf_to_debt':
          val = cashflow.operating_cash_flow && balance.total_debt
            ? cashflow.operating_cash_flow / balance.total_debt
            : null;
          break;
        case 'capex_to_revenue':
          val = cashflow.capital_expenditure && income.revenue
            ? Math.abs(cashflow.capital_expenditure) / income.revenue
            : null;
          break;
        // Coverage metrics
        case 'interest_coverage':
          val = income.operating_income && income.interest_expense
            ? income.operating_income / Math.abs(income.interest_expense)
            : null;
          break;
        case 'debt_service_coverage':
          val = null; // Requires detailed debt info not typically available
          break;
        case 'fixed_charge_coverage':
          val = null; // Requires detailed fixed charges info
          break;
        // Efficiency metrics
        case 'asset_turnover':
          val = income.revenue && balance.total_assets
            ? income.revenue / balance.total_assets
            : null;
          break;
        case 'receivables_turnover':
          val = income.revenue && balance.receivables
            ? income.revenue / balance.receivables
            : null;
          break;
        case 'inventory_turnover':
          val = income.cost_of_revenue && balance.inventory
            ? income.cost_of_revenue / balance.inventory
            : null;
          break;
        // ROE, ROA from financials
        case 'roe':
          val = income.net_income && balance.total_equity
            ? income.net_income / balance.total_equity
            : null;
          break;
        case 'roa':
          val = income.net_income && balance.total_assets
            ? income.net_income / balance.total_assets
            : null;
          break;
        case 'roic':
          val = income.operating_income && balance.total_equity && balance.total_debt
            ? income.operating_income / (balance.total_equity + balance.total_debt)
            : null;
          break;
        default:
          val = null;
      }
    }

    if (val === null || val === undefined) return '-';

    // Format based on metric type
    if (PERCENT_METRICS.includes(metricKey)) {
      return formatPercent(val);
    } else if (LARGE_NUMBER_METRICS.includes(metricKey)) {
      return formatLargeNumber(val);
    } else {
      return formatRatio(val);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Symbol chips */}
          <div className="flex items-center gap-1 flex-wrap">
            {symbols.map((sym, idx) => (
              <div
                key={sym}
                className="flex items-center gap-1 px-2 py-1 bg-gray-800 rounded text-xs"
              >
                <span className="text-cyan-400 font-medium">{idx + 1}</span>
                <span className="text-white">{sym}</span>
                {symbols.length > 1 && (
                  <button
                    onClick={() => removeSymbol(sym)}
                    className="ml-1 text-gray-500 hover:text-red-400"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add ticker */}
          <div className="relative" ref={addTickerRef}>
            <button
              onClick={() => setShowAddTicker(!showAddTicker)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-cyan-400 hover:bg-gray-800 rounded"
            >
              <Plus size={14} />
              Add Additional Ticker
            </button>

            {showAddTicker && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-[#1a1a1f] border border-gray-700 rounded-lg shadow-xl z-50 p-2">
                <TickerSearch
                  onSelect={addSymbol}
                  placeholder="Search ticker (e.g., MSFT, Tesla)..."
                />
                {symbols.length >= 10 && (
                  <p className="text-xs text-yellow-500 mt-2 px-1">Maximum 10 tickers allowed</p>
                )}
              </div>
            )}
          </div>

          {/* Year selector */}
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white"
          >
            {YEARS.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Period tabs */}
          <div className="flex items-center gap-0.5 bg-gray-800 rounded p-0.5">
            {PERIODS.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  period === p.id
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded">
            <Copy size={14} />
          </button>
          <button className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded">
            <MoreVertical size={14} />
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800 overflow-x-auto">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded transition-colors ${
              activeCategory === cat.id
                ? 'text-cyan-400 bg-cyan-400/10'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#0d0d12] z-10">
            <tr className="border-b border-gray-800">
              <th className="text-left py-3 px-4 text-gray-400 font-medium min-w-[200px]">Name</th>
              {currentCategory?.metrics.map(metric => (
                <th key={metric.key} className="text-right py-3 px-4 text-gray-400 font-medium min-w-[150px]">
                  {metric.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {symbols.map((sym, idx) => {
              const data = stockData[sym];
              const info = data?.info || {};

              return (
                <tr
                  key={sym}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {/* Color indicator */}
                      <div
                        className="w-1 h-10 rounded"
                        style={{ backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'][idx % 8] }}
                      />
                      {/* Logo placeholder */}
                      <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center text-xs font-bold text-white">
                        {sym.slice(0, 2)}
                      </div>
                      {/* Name */}
                      <div>
                        <div className="font-semibold text-white">{sym}</div>
                        <div className="text-xs text-gray-400 truncate max-w-[150px]">
                          {info.company_name || info.shortName || sym}
                        </div>
                      </div>
                    </div>
                  </td>
                  {currentCategory?.metrics.map(metric => (
                    <td key={metric.key} className="text-right py-3 px-4 text-white tabular-nums">
                      {loading ? (
                        <div className="h-4 w-16 bg-gray-700 rounded animate-pulse ml-auto" />
                      ) : (
                        getMetricValue(sym, metric.key)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        {symbols.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <p>No stocks selected</p>
            <p className="text-sm">Add tickers to compare</p>
          </div>
        )}
      </div>
    </div>
  );
}
