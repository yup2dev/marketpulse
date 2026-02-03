/**
 * Analysis Overview Tab - Data-Focused Layout
 */
import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, Users, Building2 } from 'lucide-react';
import { useStockContext } from './AnalysisDashboard';
import { API_BASE } from '../../config/api';
import ChartWidget from '../widgets/ChartWidget';

export default function AnalysisOverviewTab() {
  const { symbol } = useStockContext();
  const [quote, setQuote] = useState(null);
  const [info, setInfo] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [analysts, setAnalysts] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (symbol) loadData();
  }, [symbol]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [quoteRes, infoRes, financialsRes, analystsRes] = await Promise.all([
        fetch(`${API_BASE}/stock/quote/${symbol}`),
        fetch(`${API_BASE}/stock/info/${symbol}`),
        fetch(`${API_BASE}/stock/financials/${symbol}?freq=annual&limit=2`),
        fetch(`${API_BASE}/stock/analysts/${symbol}`)
      ]);

      if (quoteRes.ok) setQuote(await quoteRes.json());
      if (infoRes.ok) setInfo(await infoRes.json());
      if (financialsRes.ok) setFinancials(await financialsRes.json());
      if (analystsRes.ok) setAnalysts(await analystsRes.json());
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (value) => {
    if (value === null || value === undefined) return '-';
    if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return value.toLocaleString();
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined) return '-';
    return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
  };

  const getMetrics = () => {
    if (!financials?.periods?.length) return {};

    const latest = financials.periods[0];
    const previous = financials.periods[1];
    const inc = latest?.income_statement || {};
    const bal = latest?.balance_sheet || {};
    const prevInc = previous?.income_statement || {};

    return {
      roe: bal.total_equity && inc.net_income ? (inc.net_income / bal.total_equity * 100) : null,
      roa: bal.total_assets && inc.net_income ? (inc.net_income / bal.total_assets * 100) : null,
      netMargin: inc.revenue && inc.net_income ? (inc.net_income / inc.revenue * 100) : null,
      debtToEquity: bal.total_equity && bal.total_debt ? (bal.total_debt / bal.total_equity) : null,
      revenueGrowth: prevInc.revenue && inc.revenue ? ((inc.revenue - prevInc.revenue) / prevInc.revenue * 100) : null,
      revenue: inc.revenue,
      netIncome: inc.net_income
    };
  };

  const metrics = getMetrics();
  const isPositive = quote?.change >= 0;

  const MetricRow = ({ label, value, highlight = false }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-800/50">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`font-medium ${highlight ? (parseFloat(value) >= 0 ? 'text-green-400' : 'text-red-400') : 'text-white'}`}>
        {value}
      </span>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid grid-cols-12 gap-4">
        {/* Header Info */}
        <div className="col-span-12">
          <div className="bg-[#0d0d12] rounded-lg p-4 border border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">{symbol}</h2>
                  <p className="text-gray-400 text-sm">{info?.name}</p>
                </div>
                {quote && (
                  <div className="flex items-center gap-4 ml-8">
                    <span className="text-2xl font-bold text-white">${quote.price?.toFixed(2)}</span>
                    <div className={`flex items-center gap-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                      {isPositive ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                      <span className="font-medium">
                        {isPositive ? '+' : ''}{quote.change?.toFixed(2)} ({quote.change_percent?.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={loadData}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="col-span-8">
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800 h-[400px]">
            <ChartWidget
              widgetId={`overview-${symbol}`}
              initialSymbols={[symbol]}
            />
          </div>
        </div>

        {/* Key Metrics */}
        <div className="col-span-4">
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800 h-[400px] overflow-hidden">
            <div className="p-4 border-b border-gray-800">
              <h4 className="text-sm font-semibold text-white">Key Metrics</h4>
            </div>
            <div className="p-4 overflow-auto h-[calc(100%-52px)]">
              <MetricRow label="Market Cap" value={formatNumber(info?.market_cap)} />
              <MetricRow label="P/E Ratio" value={info?.pe_ratio?.toFixed(2) || '-'} />
              <MetricRow label="P/B Ratio" value={info?.price_to_book?.toFixed(2) || '-'} />
              <MetricRow label="EPS" value={info?.eps ? `$${info.eps.toFixed(2)}` : '-'} />
              <MetricRow label="Dividend Yield" value={info?.dividend_yield ? `${(info.dividend_yield * 100).toFixed(2)}%` : '-'} />
              <MetricRow label="52W High" value={info?.fifty_two_week_high ? `$${info.fifty_two_week_high.toFixed(2)}` : '-'} />
              <MetricRow label="52W Low" value={info?.fifty_two_week_low ? `$${info.fifty_two_week_low.toFixed(2)}` : '-'} />
              <MetricRow label="Beta" value={info?.beta?.toFixed(2) || '-'} />
            </div>
          </div>
        </div>

        {/* Valuation Metrics */}
        <div className="col-span-4">
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800">
            <div className="p-4 border-b border-gray-800">
              <h4 className="text-sm font-semibold text-white">Valuation</h4>
            </div>
            <div className="p-4">
              <MetricRow label="P/E Ratio" value={info?.pe_ratio?.toFixed(2) || '-'} />
              <MetricRow label="Forward P/E" value={info?.forward_pe?.toFixed(2) || '-'} />
              <MetricRow label="PEG Ratio" value={info?.peg_ratio?.toFixed(2) || '-'} />
              <MetricRow label="P/S Ratio" value={info?.price_to_sales?.toFixed(2) || '-'} />
              <MetricRow label="P/B Ratio" value={info?.price_to_book?.toFixed(2) || '-'} />
              <MetricRow label="EV/EBITDA" value={info?.ev_to_ebitda?.toFixed(2) || '-'} />
            </div>
          </div>
        </div>

        {/* Profitability */}
        <div className="col-span-4">
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800">
            <div className="p-4 border-b border-gray-800">
              <h4 className="text-sm font-semibold text-white">Profitability</h4>
            </div>
            <div className="p-4">
              <MetricRow label="ROE" value={metrics.roe ? `${metrics.roe.toFixed(2)}%` : '-'} highlight />
              <MetricRow label="ROA" value={metrics.roa ? `${metrics.roa.toFixed(2)}%` : '-'} highlight />
              <MetricRow label="Net Margin" value={metrics.netMargin ? `${metrics.netMargin.toFixed(2)}%` : '-'} highlight />
              <MetricRow label="Revenue" value={formatNumber(metrics.revenue)} />
              <MetricRow label="Net Income" value={formatNumber(metrics.netIncome)} />
              <MetricRow label="Revenue Growth" value={metrics.revenueGrowth ? `${metrics.revenueGrowth.toFixed(2)}%` : '-'} highlight />
            </div>
          </div>
        </div>

        {/* Financial Health */}
        <div className="col-span-4">
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800">
            <div className="p-4 border-b border-gray-800">
              <h4 className="text-sm font-semibold text-white">Financial Health</h4>
            </div>
            <div className="p-4">
              <MetricRow label="D/E Ratio" value={metrics.debtToEquity?.toFixed(2) || '-'} />
              <MetricRow label="Current Ratio" value={info?.current_ratio?.toFixed(2) || '-'} />
              <MetricRow label="Quick Ratio" value={info?.quick_ratio?.toFixed(2) || '-'} />
              <MetricRow label="Interest Coverage" value={info?.interest_coverage?.toFixed(2) || '-'} />
            </div>
          </div>
        </div>

        {/* Analyst Ratings */}
        {analysts && (
          <div className="col-span-6">
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800">
              <div className="p-4 border-b border-gray-800 flex items-center gap-2">
                <Users size={16} className="text-purple-500" />
                <h4 className="text-sm font-semibold text-white">Analyst Ratings</h4>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-400">Consensus</span>
                  <span className={`font-bold text-lg ${
                    analysts.recommendation === 'Buy' || analysts.recommendation === 'Strong Buy' ? 'text-green-400' :
                    analysts.recommendation === 'Sell' || analysts.recommendation === 'Strong Sell' ? 'text-red-400' :
                    'text-yellow-400'
                  }`}>
                    {analysts.recommendation || '-'}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-2 text-center text-xs">
                  <div className="bg-green-900/30 rounded p-2">
                    <div className="text-green-400 font-bold">{analysts.strong_buy || 0}</div>
                    <div className="text-gray-400">Strong Buy</div>
                  </div>
                  <div className="bg-green-800/20 rounded p-2">
                    <div className="text-green-300 font-bold">{analysts.buy || 0}</div>
                    <div className="text-gray-400">Buy</div>
                  </div>
                  <div className="bg-yellow-900/20 rounded p-2">
                    <div className="text-yellow-400 font-bold">{analysts.hold || 0}</div>
                    <div className="text-gray-400">Hold</div>
                  </div>
                  <div className="bg-red-800/20 rounded p-2">
                    <div className="text-red-300 font-bold">{analysts.sell || 0}</div>
                    <div className="text-gray-400">Sell</div>
                  </div>
                  <div className="bg-red-900/30 rounded p-2">
                    <div className="text-red-400 font-bold">{analysts.strong_sell || 0}</div>
                    <div className="text-gray-400">Strong Sell</div>
                  </div>
                </div>
                {analysts.target_price && (
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Target Price</span>
                      <span className="text-white font-bold">${analysts.target_price.toFixed(2)}</span>
                    </div>
                    {quote?.price && (
                      <div className="flex justify-between mt-2">
                        <span className="text-gray-400">Upside</span>
                        <span className={`font-medium ${
                          ((analysts.target_price - quote.price) / quote.price) > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {(((analysts.target_price - quote.price) / quote.price) * 100).toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Company Info */}
        <div className="col-span-6">
          <div className="bg-[#0d0d12] rounded-lg border border-gray-800">
            <div className="p-4 border-b border-gray-800 flex items-center gap-2">
              <Building2 size={16} className="text-blue-500" />
              <h4 className="text-sm font-semibold text-white">Company Info</h4>
            </div>
            <div className="p-4">
              <MetricRow label="Sector" value={info?.sector || '-'} />
              <MetricRow label="Industry" value={info?.industry || '-'} />
              <MetricRow label="Employees" value={info?.employees?.toLocaleString() || '-'} />
              <MetricRow label="Country" value={info?.country || '-'} />
              {info?.website && (
                <div className="flex justify-between items-center py-2 border-b border-gray-800/50">
                  <span className="text-gray-400 text-sm">Website</span>
                  <a href={info.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-sm truncate max-w-[200px]">
                    {info.website.replace('https://', '').replace('http://', '')}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
