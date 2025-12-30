import React, { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';
import ConfigPanel from './backtest/ConfigPanel';
import ResultsDashboard from './backtest/ResultsDashboard';
import { DESIGN_TOKENS } from '../styles/designTokens';

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'http://localhost:8000/api';

/**
 * UnifiedBacktest - Main backtesting component
 * Combines all backtesting functionality in one place
 */
const UnifiedBacktest = () => {
  const [config, setConfig] = useState({
    symbols: [],
    weights: {},
    benchmark: 'SPY',
    startDate: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 years ago
    endDate: new Date().toISOString().split('T')[0],
    rebalancing: 'monthly',
    initialCapital: 100000,
  });

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load portfolio from external source (e.g., from PortfolioSettings)
  useEffect(() => {
    const loadedPortfolio = sessionStorage.getItem('loadedPortfolio');
    if (loadedPortfolio) {
      try {
        const portfolio = JSON.parse(loadedPortfolio);
        if (portfolio.stocks && portfolio.stocks.length > 0) {
          const symbols = portfolio.stocks.map(s => s.symbol);
          const weights = portfolio.stocks.reduce((acc, s) => ({
            ...acc,
            [s.symbol]: s.weight || 0
          }), {});

          setConfig(prev => ({
            ...prev,
            symbols,
            weights
          }));

          // Clear the session storage
          sessionStorage.removeItem('loadedPortfolio');
        }
      } catch (err) {
        console.error('Error loading portfolio:', err);
      }
    }
  }, []);

  const handleRunBacktest = async () => {
    if (config.symbols.length === 0) {
      alert('Please add at least one stock to your portfolio');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/backtest/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbols: config.symbols,
          start_date: config.startDate,
          end_date: config.endDate,
          rebalancing_period: config.rebalancing,
          initial_capital: config.initialCapital,
          benchmark_symbol: config.benchmark,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResults(data.data);
    } catch (err) {
      console.error('Backtest error:', err);
      setError(err.message || 'Failed to run backtest');
      alert(`Error: ${err.message || 'Failed to run backtest'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreset = () => {
    const presetName = prompt('Enter a name for this preset:');
    if (!presetName) return;

    const preset = {
      id: Date.now(),
      name: presetName,
      config: { ...config },
      createdAt: new Date().toISOString(),
    };

    const presets = JSON.parse(localStorage.getItem('backtest-presets') || '[]');
    localStorage.setItem('backtest-presets', JSON.stringify([...presets, preset]));

    alert('Preset saved successfully!');
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Backtest Strategy</h2>
            <p className="text-gray-400">Test your portfolio strategies with historical data</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Panel - Configuration */}
          <div className="lg:col-span-4 xl:col-span-3">
            <ConfigPanel
              config={config}
              onConfigChange={setConfig}
              onRun={handleRunBacktest}
              onSave={handleSavePreset}
              loading={loading}
            />
          </div>

          {/* Right Panel - Results */}
          <div className="lg:col-span-8 xl:col-span-9">
            {error && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
                <p className="text-red-400">{error}</p>
              </div>
            )}

            <ResultsDashboard results={results} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedBacktest;
