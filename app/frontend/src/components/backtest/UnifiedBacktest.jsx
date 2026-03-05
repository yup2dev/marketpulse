import React, { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';
import ConfigPanel from './ConfigPanel';
import ResultsDashboard from './ResultsDashboard';
import { useLoading } from '../../contexts/LoadingContext';
import { apiClient, API_BASE, portfolioAPI } from '../../config/api';
import toast from 'react-hot-toast';

const three_years_ago = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const today = new Date().toISOString().split('T')[0];

const DEFAULT_CONFIG = {
  symbols: [],
  weights: {},
  benchmark: 'SPY',
  startDate: three_years_ago,
  endDate: today,
  rebalancing: 'monthly',
  initialCapital: 100000,
};

const UnifiedBacktest = () => {
  const { showLoading, hideLoading } = useLoading();

  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [portfolios, setPortfolios] = useState([]);
  const [loadingPortfolios, setLoadingPortfolios] = useState(false);

  // Fetch user portfolios for the import selector
  useEffect(() => {
    const fetchPortfolios = async () => {
      setLoadingPortfolios(true);
      try {
        const data = await portfolioAPI.getAll();
        setPortfolios(data.portfolios || data || []);
      } catch {
        /* ignore — user might not have portfolios */
      } finally {
        setLoadingPortfolios(false);
      }
    };
    fetchPortfolios();
  }, []);

  // Support loading portfolio via sessionStorage (from external navigation)
  useEffect(() => {
    const raw = sessionStorage.getItem('loadedPortfolio');
    if (!raw) return;
    try {
      const portfolio = JSON.parse(raw);
      if (portfolio.stocks?.length > 0) {
        const symbols = portfolio.stocks.map(s => s.symbol);
        const weights = portfolio.stocks.reduce((acc, s) => ({ ...acc, [s.symbol]: s.weight ?? 0 }), {});
        setConfig(prev => ({ ...prev, symbols, weights }));
      }
    } catch {
      /* ignore corrupt data */
    }
    sessionStorage.removeItem('loadedPortfolio');
  }, []);

  // Load allocation from a saved portfolio
  const handleLoadPortfolio = async (portfolioId) => {
    try {
      const data = await portfolioAPI.getAllocation(portfolioId);
      const allocation = data.allocation || [];
      if (allocation.length === 0) {
        toast.error('이 포트폴리오에 보유 종목이 없습니다');
        return;
      }
      const symbols = allocation.map(h => h.ticker_cd);
      const weights = allocation.reduce((acc, h) => ({ ...acc, [h.ticker_cd]: h.weight_pct ?? 0 }), {});
      setConfig(prev => ({ ...prev, symbols, weights }));
      toast.success(`${symbols.length}개 종목을 포트폴리오에서 불러왔습니다`);
    } catch {
      toast.error('포트폴리오를 불러오지 못했습니다');
    }
  };

  const handleRunBacktest = async () => {
    if (config.symbols.length === 0) {
      toast.error('종목을 1개 이상 추가해주세요');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);
    showLoading('백테스트를 실행하는 중입니다...');

    try {
      const data = await apiClient.post(`${API_BASE}/backtest/run`, {
        symbols: config.symbols,
        weights: config.weights,
        start_date: config.startDate,
        end_date: config.endDate,
        rebalancing_period: config.rebalancing,
        initial_capital: config.initialCapital,
        benchmark_symbol: config.benchmark,
      });
      setResults(data.data);
    } catch (err) {
      const msg = err.message || '백테스트 실행에 실패했습니다';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      hideLoading();
    }
  };

  const handleSavePreset = () => {
    if (config.symbols.length === 0) return;
    const name = window.prompt('프리셋 이름을 입력하세요:');
    if (!name) return;
    const presets = JSON.parse(localStorage.getItem('backtest-presets') || '[]');
    localStorage.setItem('backtest-presets', JSON.stringify([
      ...presets,
      { id: Date.now(), name, config: { ...config }, createdAt: new Date().toISOString() },
    ]));
    toast.success('프리셋이 저장되었습니다');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Page Header */}
      <div className="px-6 py-3.5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-blue-500/10 rounded-lg">
            <BarChart3 size={18} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white leading-tight">Backtest</h1>
            <p className="text-[11px] text-gray-500">포트폴리오 전략의 과거 성과를 시뮬레이션합니다</p>
          </div>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex">
        {/* Left — Configuration (sticky sidebar) */}
        <div className="w-[300px] flex-shrink-0 border-r border-gray-800">
          <div className="sticky top-14 overflow-y-auto max-h-[calc(100vh-56px)]">
            <ConfigPanel
              config={config}
              onConfigChange={setConfig}
              onRun={handleRunBacktest}
              onSave={handleSavePreset}
              loading={loading}
              portfolios={portfolios}
              loadingPortfolios={loadingPortfolios}
              onLoadPortfolio={handleLoadPortfolio}
            />
          </div>
        </div>

        {/* Right — Results */}
        <div className="flex-1 p-5 min-w-0">
          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-5">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          <ResultsDashboard results={results} config={config} loading={loading} />
        </div>
      </div>
    </div>
  );
};

export default UnifiedBacktest;
