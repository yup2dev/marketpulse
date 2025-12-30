import React, { useState, useEffect } from 'react';
import { Save, Trash2, X, Play } from 'lucide-react';
import { BUTTON_CLASSES, CARD_CLASSES, INPUT_CLASSES } from '../styles/designTokens';

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'http://localhost:8000/api';

const PortfolioSettings = ({ onNavigate }) => {
  const [portfolios, setPortfolios] = useState([]);
  const [currentPortfolio, setCurrentPortfolio] = useState({
    name: '',
    description: '',
    type: 'custom', // 'custom' or 'universe'
    universe: 'sp500',
    stocks: [],
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [universes, setUniverses] = useState([]);
  const [universeStocks, setUniverseStocks] = useState([]);
  // Load saved portfolios from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('portfolios');
    if (saved) {
      setPortfolios(JSON.parse(saved));
    }
  }, []);

  // Load available universes
  useEffect(() => {
    fetchUniverses();
  }, []);

  const fetchUniverses = async () => {
    try {
      const response = await fetch(`${API_BASE}/backtest/universes`);
      if (response.ok) {
        const data = await response.json();
        setUniverses(data.universes || []);
      }
    } catch (error) {
      console.error('Error fetching universes:', error);
    }
  };

  const fetchUniverseStocks = async (universeId) => {
    try {
      const response = await fetch(`${API_BASE}/backtest/universe/${universeId}`);
      if (response.ok) {
        const data = await response.json();
        setUniverseStocks(data.stocks || []);
      }
    } catch (error) {
      console.error('Error fetching universe stocks:', error);
    }
  };

  const searchStocks = async (query) => {
    if (!query || query.length < 1) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/stock/search?query=${query}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      }
    } catch (error) {
      console.error('Error searching stocks:', error);
    }
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    searchStocks(query);
  };

  const addStock = (stock) => {
    if (!currentPortfolio.stocks.find(s => s.symbol === stock.symbol)) {
      const newStock = {
        ...stock,
        weight: 0
      };
      const updatedStocks = [...currentPortfolio.stocks, newStock];
      setCurrentPortfolio({ ...currentPortfolio, stocks: updatedStocks });
      normalizeWeights(updatedStocks);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeStock = (symbol) => {
    const updatedStocks = currentPortfolio.stocks.filter(s => s.symbol !== symbol);
    setCurrentPortfolio({ ...currentPortfolio, stocks: updatedStocks });
    normalizeWeights(updatedStocks);
  };

  const updateStockWeight = (symbol, weight) => {
    const updatedStocks = currentPortfolio.stocks.map(s =>
      s.symbol === symbol ? { ...s, weight: parseFloat(weight) || 0 } : s
    );
    setCurrentPortfolio({ ...currentPortfolio, stocks: updatedStocks });
  };

  const normalizeWeights = (stocks) => {
    if (stocks.length === 0) return;
    const equalWeight = 100 / stocks.length;
    const updatedStocks = stocks.map(s => ({ ...s, weight: parseFloat(equalWeight.toFixed(2)) }));
    setCurrentPortfolio({ ...currentPortfolio, stocks: updatedStocks });
  };

  const handleTypeChange = async (type) => {
    setCurrentPortfolio({ ...currentPortfolio, type });
    if (type === 'universe') {
      await fetchUniverseStocks(currentPortfolio.universe);
    }
  };

  const handleUniverseChange = async (universe) => {
    setCurrentPortfolio({ ...currentPortfolio, universe });
    await fetchUniverseStocks(universe);
  };

  const loadUniverseStocks = async () => {
    try {
      // Fetch fresh data from API
      const response = await fetch(`${API_BASE}/backtest/universe/${currentPortfolio.universe}`);
      if (response.ok) {
        const data = await response.json();
        const fetchedStocks = data.stocks || [];

        if (fetchedStocks.length === 0) {
          alert('No stocks found in this universe');
          return;
        }

        // Take first 20 stocks
        const selected = fetchedStocks.slice(0, 20);
        const equalWeight = 100 / selected.length;
        const stocks = selected.map(s => ({
          symbol: s.symbol,
          name: s.name,
          weight: parseFloat(equalWeight.toFixed(2))
        }));

        setCurrentPortfolio({ ...currentPortfolio, stocks });
        alert(`Loaded ${stocks.length} stocks from ${currentPortfolio.universe.toUpperCase()}`);
      } else {
        alert('Failed to load stocks from universe');
      }
    } catch (error) {
      console.error('Error loading universe stocks:', error);
      alert('Error loading stocks from universe');
    }
  };

  const savePortfolio = () => {
    if (!currentPortfolio.name) {
      alert('포트폴리오 이름을 입력해주세요');
      return;
    }

    const totalWeight = currentPortfolio.stocks.reduce((sum, s) => sum + s.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.1) {
      alert('종목 비중의 합이 100%가 되어야 합니다');
      return;
    }

    const newPortfolio = {
      ...currentPortfolio,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    };

    const updatedPortfolios = [...portfolios, newPortfolio];
    setPortfolios(updatedPortfolios);
    localStorage.setItem('portfolios', JSON.stringify(updatedPortfolios));

    alert('포트폴리오가 저장되었습니다');
    resetForm();
  };

  const loadPortfolio = (portfolio) => {
    setCurrentPortfolio(portfolio);
  };

  const deletePortfolio = (id) => {
    if (confirm('정말 이 포트폴리오를 삭제하시겠습니까?')) {
      const updatedPortfolios = portfolios.filter(p => p.id !== id);
      setPortfolios(updatedPortfolios);
      localStorage.setItem('portfolios', JSON.stringify(updatedPortfolios));
    }
  };

  const resetForm = () => {
    setCurrentPortfolio({
      name: '',
      description: '',
      type: 'custom',
      universe: 'sp500',
      stocks: [],
    });
  };

  const handleTestInBacktest = () => {
    if (currentPortfolio.stocks.length === 0) {
      alert('Please add at least one stock to test');
      return;
    }

    const totalWeight = currentPortfolio.stocks.reduce((sum, s) => sum + s.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.1) {
      alert('Stock weights must total 100%');
      return;
    }

    // Save to sessionStorage for UnifiedBacktest to load
    sessionStorage.setItem('loadedPortfolio', JSON.stringify(currentPortfolio));

    // Navigate to UnifiedBacktest
    if (onNavigate) {
      onNavigate('unified-backtest');
    }
  };

  const totalWeight = currentPortfolio.stocks.reduce((sum, s) => sum + s.weight, 0);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Portfolio Settings</h2>
            <p className="text-gray-400">Configure and manage your investment portfolios</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleTestInBacktest}
              disabled={currentPortfolio.stocks.length === 0}
              className={`flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-white text-sm font-medium ${
                currentPortfolio.stocks.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Play size={18} />
              Test in Backtest
            </button>
            <button
              onClick={savePortfolio}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-white text-sm font-medium"
            >
              <Save size={18} />
              Save Portfolio
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Portfolio Configuration */}
        <div className={`lg:col-span-2 ${CARD_CLASSES.default} overflow-y-auto`}>
          <h2 className="text-xl font-semibold text-white mb-4">Configure Portfolio</h2>

          {/* Basic Info */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Portfolio Name</label>
              <input
                type="text"
                value={currentPortfolio.name}
                onChange={(e) => setCurrentPortfolio({ ...currentPortfolio, name: e.target.value })}
                className={INPUT_CLASSES.default}
                placeholder="My Portfolio"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
              <textarea
                value={currentPortfolio.description}
                onChange={(e) => setCurrentPortfolio({ ...currentPortfolio, description: e.target.value })}
                className={INPUT_CLASSES.default}
                rows="2"
                placeholder="Portfolio description..."
              />
            </div>
          </div>

          {/* Portfolio Type */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Portfolio Type</label>
            <div className="flex gap-4">
              <button
                onClick={() => handleTypeChange('custom')}
                className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                  currentPortfolio.type === 'custom'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#0a0e14] text-gray-400 hover:bg-gray-700'
                }`}
              >
                Custom Selection
              </button>
              <button
                onClick={() => handleTypeChange('universe')}
                className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                  currentPortfolio.type === 'universe'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#0a0e14] text-gray-400 hover:bg-gray-700'
                }`}
              >
                From Universe
              </button>
            </div>
          </div>

          {/* Universe Selection */}
          {currentPortfolio.type === 'universe' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">Select Universe</label>
              <select
                value={currentPortfolio.universe}
                onChange={(e) => handleUniverseChange(e.target.value)}
                className={INPUT_CLASSES.default}
              >
                {universes.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.count} stocks)</option>
                ))}
              </select>
              <button
                onClick={loadUniverseStocks}
                className={`mt-2 w-full ${BUTTON_CLASSES.primary}`}
              >
                Load Top 20 Stocks from Universe
              </button>
            </div>
          )}

          {/* Stock Search (Custom Type) */}
          {currentPortfolio.type === 'custom' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">Add Stocks</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className={INPUT_CLASSES.default}
                  placeholder="Search stocks by symbol or name..."
                />
                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-[#1a1f2e] border border-gray-700 rounded-lg max-h-60 overflow-y-auto">
                    {searchResults.map(stock => (
                      <button
                        key={stock.symbol}
                        onClick={() => addStock(stock)}
                        className="w-full px-4 py-2 text-left hover:bg-[#0a0e14] text-white transition-colors"
                      >
                        <div className="font-medium">{stock.symbol}</div>
                        <div className="text-sm text-gray-400">{stock.name}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Selected Stocks */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">
                Selected Stocks ({currentPortfolio.stocks.length})
              </label>
              <div className="text-sm text-gray-400">
                Total Weight: <span className={totalWeight === 100 ? 'text-green-500' : 'text-red-500'}>
                  {totalWeight.toFixed(2)}%
                </span>
              </div>
            </div>

            {currentPortfolio.stocks.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No stocks selected
              </div>
            ) : (
              <div className="space-y-2">
                {currentPortfolio.stocks.map(stock => (
                  <div key={stock.symbol} className="flex items-center gap-2 bg-[#0a0e14] p-3 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-white">{stock.symbol}</div>
                      <div className="text-sm text-gray-400">{stock.name}</div>
                    </div>
                    <input
                      type="number"
                      value={stock.weight}
                      onChange={(e) => updateStockWeight(stock.symbol, e.target.value)}
                      className="w-20 px-2 py-1 bg-[#1a1f2e] border border-gray-700 rounded text-white text-right focus:outline-none focus:border-blue-500"
                      step="0.1"
                      min="0"
                      max="100"
                    />
                    <span className="text-gray-400">%</span>
                    <button
                      onClick={() => removeStock(stock.symbol)}
                      className="p-1 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => normalizeWeights(currentPortfolio.stocks)}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Equal Weight All
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Right: Saved Portfolios */}
        <div className={`${CARD_CLASSES.default} overflow-y-auto`}>
          <h2 className="text-xl font-semibold text-white mb-4">Saved Portfolios</h2>

          {portfolios.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No saved portfolios
            </div>
          ) : (
            <div className="space-y-3">
              {portfolios.map(portfolio => (
                <div key={portfolio.id} className="bg-[#0a0e14] p-4 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-medium text-white">{portfolio.name}</h3>
                      {portfolio.description && (
                        <p className="text-sm text-gray-400 mt-1">{portfolio.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => deletePortfolio(portfolio.id)}
                      className="p-1 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="text-sm text-gray-400 mb-3">
                    <div>{portfolio.stocks.length} stocks | {portfolio.type === 'custom' ? 'Custom' : 'Universe'}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadPortfolio(portfolio)}
                      className={`flex-1 ${BUTTON_CLASSES.secondary} !py-1.5 text-sm`}
                    >
                      Load
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default PortfolioSettings;
