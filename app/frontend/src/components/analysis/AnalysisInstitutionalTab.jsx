/**
 * Analysis Institutional Tab - Data-Focused Layout
 */
import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { useStockContext } from './AnalysisDashboard';
import { API_BASE } from '../../config/api';

export default function AnalysisInstitutionalTab() {
  const { symbol } = useStockContext();
  const [institutions, setInstitutions] = useState([]);
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [selectedInst, setSelectedInst] = useState('');

  useEffect(() => {
    loadInstitutions();
  }, []);

  const loadInstitutions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/portfolio/13f/institutions`);
      if (res.ok) {
        const data = await res.json();
        setInstitutions(data.institutions || []);
      }
    } catch (error) {
      console.error('Error loading institutions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPortfolio = async (instKey) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/portfolio/13f/${instKey}`);
      if (res.ok) {
        const data = await res.json();
        setPortfolios(prev => {
          const filtered = prev.filter(p => p.id !== data.id);
          return [...filtered, data];
        });
      }
    } catch (error) {
      console.error('Error loading portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (value) => {
    if (value === null || value === undefined) return '-';
    if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toLocaleString()}`;
  };

  // Filter portfolios that hold the current symbol
  const relevantPortfolios = symbol
    ? portfolios.filter(p => p.stocks?.some(s => s.symbol?.toUpperCase() === symbol.toUpperCase()))
    : portfolios;

  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid grid-cols-12 gap-4">
        {/* Institution Selector */}
        <div className="col-span-12">
          <div className="bg-[#0d0d12] rounded-lg p-4 border border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Building2 className="text-blue-500" size={20} />
                <select
                  value={selectedInst}
                  onChange={(e) => {
                    setSelectedInst(e.target.value);
                    if (e.target.value) loadPortfolio(e.target.value);
                  }}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500 min-w-[300px]"
                  disabled={loading}
                >
                  <option value="">Select Institution ({institutions.length} available)</option>
                  {institutions.map(inst => (
                    <option key={inst.key} value={inst.key}>
                      {inst.manager} - {inst.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={loadInstitutions}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
            {symbol && portfolios.length > 0 && (
              <div className="mt-3 text-sm text-gray-400">
                Showing institutions holding <span className="text-blue-400 font-medium">{symbol}</span>: {relevantPortfolios.length} found
              </div>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        {relevantPortfolios.length > 0 && (
          <div className="col-span-12">
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-[#0d0d12] rounded-lg p-4 border border-gray-800">
                <div className="text-gray-400 text-xs mb-1">Total Institutions</div>
                <div className="text-2xl font-bold text-white">{relevantPortfolios.length}</div>
              </div>
              <div className="bg-[#0d0d12] rounded-lg p-4 border border-gray-800">
                <div className="text-gray-400 text-xs mb-1">Total AUM</div>
                <div className="text-2xl font-bold text-white">
                  {formatNumber(relevantPortfolios.reduce((sum, p) => sum + (p.total_value || 0), 0))}
                </div>
              </div>
              <div className="bg-[#0d0d12] rounded-lg p-4 border border-gray-800">
                <div className="text-gray-400 text-xs mb-1">Avg Holdings</div>
                <div className="text-2xl font-bold text-white">
                  {Math.round(relevantPortfolios.reduce((sum, p) => sum + (p.num_holdings || 0), 0) / relevantPortfolios.length) || 0}
                </div>
              </div>
              <div className="bg-[#0d0d12] rounded-lg p-4 border border-gray-800">
                <div className="text-gray-400 text-xs mb-1">Avg Change QoQ</div>
                <div className={`text-2xl font-bold ${
                  relevantPortfolios.reduce((sum, p) => sum + (p.value_change_pct || 0), 0) / relevantPortfolios.length > 0
                    ? 'text-green-400' : 'text-red-400'
                }`}>
                  {((relevantPortfolios.reduce((sum, p) => sum + (p.value_change_pct || 0), 0) / relevantPortfolios.length) || 0).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Portfolios List */}
        <div className="col-span-12">
          {portfolios.length === 0 ? (
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-12 text-center">
              <Building2 size={48} className="mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400">Select an institution to view their holdings</p>
            </div>
          ) : relevantPortfolios.length === 0 ? (
            <div className="bg-[#0d0d12] rounded-lg border border-gray-800 p-12 text-center">
              <p className="text-gray-400">No institutions holding {symbol} found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {relevantPortfolios.map(portfolio => (
                <div key={portfolio.id} className="bg-[#0d0d12] rounded-lg border border-gray-800">
                  {/* Portfolio Header */}
                  <div className="p-4 border-b border-gray-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-semibold text-white">{portfolio.manager}</h4>
                        <p className="text-sm text-gray-400">{portfolio.name}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-white">{formatNumber(portfolio.total_value)}</div>
                        {portfolio.value_change_pct !== undefined && (
                          <div className={`flex items-center justify-end gap-1 text-sm ${
                            portfolio.value_change_pct > 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {portfolio.value_change_pct > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            {portfolio.value_change_pct > 0 ? '+' : ''}{portfolio.value_change_pct.toFixed(1)}%
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>Filed: {portfolio.filing_date}</span>
                      <span>Period: {portfolio.period_end}</span>
                      <span>{portfolio.num_holdings} Holdings</span>
                    </div>
                  </div>

                  {/* Toggle Holdings */}
                  <button
                    onClick={() => setExpandedId(expandedId === portfolio.id ? null : portfolio.id)}
                    className="w-full px-4 py-3 flex items-center justify-center gap-2 text-sm text-gray-300 hover:bg-gray-800/50"
                  >
                    {expandedId === portfolio.id ? (
                      <><ChevronUp size={16} /> Hide Holdings</>
                    ) : (
                      <><ChevronDown size={16} /> View Holdings ({portfolio.stocks?.length || 0})</>
                    )}
                  </button>

                  {/* Holdings Table */}
                  {expandedId === portfolio.id && portfolio.stocks && (
                    <div className="border-t border-gray-800">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-800 bg-gray-800/30">
                            <th className="text-left py-2 px-4 text-gray-500 text-xs font-medium">#</th>
                            <th className="text-left py-2 px-4 text-gray-500 text-xs font-medium">Symbol</th>
                            <th className="text-left py-2 px-4 text-gray-500 text-xs font-medium">Name</th>
                            <th className="text-right py-2 px-4 text-gray-500 text-xs font-medium">Value</th>
                            <th className="text-right py-2 px-4 text-gray-500 text-xs font-medium">Shares</th>
                            <th className="text-right py-2 px-4 text-gray-500 text-xs font-medium">Weight</th>
                            <th className="text-right py-2 px-4 text-gray-500 text-xs font-medium">Change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {portfolio.stocks.slice(0, 20).map((stock, idx) => (
                            <tr
                              key={stock.symbol || idx}
                              className={`border-b border-gray-800/50 hover:bg-gray-800/30 ${
                                stock.symbol?.toUpperCase() === symbol?.toUpperCase() ? 'bg-blue-900/20' : ''
                              }`}
                            >
                              <td className="py-2 px-4 text-gray-500">{idx + 1}</td>
                              <td className="py-2 px-4">
                                <span className={`font-medium ${
                                  stock.symbol?.toUpperCase() === symbol?.toUpperCase() ? 'text-blue-400' : 'text-white'
                                }`}>
                                  {stock.symbol || stock.cusip}
                                </span>
                              </td>
                              <td className="py-2 px-4 text-gray-400 truncate max-w-[200px]">{stock.name}</td>
                              <td className="py-2 px-4 text-right text-white">{formatNumber(stock.value)}</td>
                              <td className="py-2 px-4 text-right text-gray-300">
                                {stock.shares ? (stock.shares / 1e6).toFixed(2) + 'M' : '-'}
                              </td>
                              <td className="py-2 px-4 text-right text-blue-400 font-medium">{stock.weight || 0}%</td>
                              <td className="py-2 px-4 text-right">
                                <span className={`flex items-center justify-end gap-1 ${
                                  (stock.change_pct || 0) > 0 ? 'text-green-400' : (stock.change_pct || 0) < 0 ? 'text-red-400' : 'text-gray-400'
                                }`}>
                                  {(stock.change_pct || 0) > 0 && <TrendingUp size={12} />}
                                  {(stock.change_pct || 0) < 0 && <TrendingDown size={12} />}
                                  {(stock.change_pct || 0) > 0 ? '+' : ''}{stock.change_pct || 0}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {portfolio.stocks.length > 20 && (
                        <div className="p-3 text-center text-sm text-gray-500">
                          Showing top 20 of {portfolio.stocks.length} holdings
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
