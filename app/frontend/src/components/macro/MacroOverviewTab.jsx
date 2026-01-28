/**
 * Macro Overview Tab - Data-driven economic indicators dashboard
 */
import { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Minus, RefreshCw } from 'lucide-react';
import { API_BASE } from '../../config/api';

export default function MacroOverviewTab() {
  const [loading, setLoading] = useState(true);
  const [regimeData, setRegimeData] = useState(null);
  const [fedData, setFedData] = useState(null);
  const [indicators, setIndicators] = useState({});

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [regimeRes, fedRes] = await Promise.all([
        fetch(`${API_BASE}/macro/regime/current`).catch(() => null),
        fetch(`${API_BASE}/macro/fed-policy/stance`).catch(() => null)
      ]);

      if (regimeRes?.ok) {
        setRegimeData(await regimeRes.json());
      }
      if (fedRes?.ok) {
        setFedData(await fedRes.json());
      }

      // Mock data for indicators
      setIndicators({
        cpi_yoy: 3.2,
        core_pce: 2.8,
        unemployment: 3.9,
        gdp_growth: 2.1,
        sp500: 5234,
        sp500_change: 0.85,
        treasury_10y: 4.28,
        treasury_10y_change: -0.03,
        vix: 14.2,
        vix_change: -5.2,
        dxy: 104.5,
        dxy_change: 0.15
      });
    } catch (error) {
      console.error('Error fetching macro data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getChangeColor = (value) => {
    if (value > 0) return 'text-green-400';
    if (value < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  const getChangeIcon = (value) => {
    if (value > 0) return <ArrowUp size={14} className="text-green-400" />;
    if (value < 0) return <ArrowDown size={14} className="text-red-400" />;
    return <Minus size={14} className="text-gray-400" />;
  };

  const formatChange = (value) => {
    if (value === undefined || value === null) return '-';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const regimeConfig = {
    goldilocks: { name: 'Goldilocks', color: 'text-green-400', desc: 'Low inflation, steady growth' },
    reflation: { name: 'Reflation', color: 'text-amber-400', desc: 'Rising inflation, strong growth' },
    stagflation: { name: 'Stagflation', color: 'text-red-400', desc: 'High inflation, weak growth' },
    deflation: { name: 'Deflation', color: 'text-blue-400', desc: 'Falling prices, weak growth' }
  };

  const fedStanceConfig = {
    hawkish: { name: 'Hawkish', color: 'text-red-400', desc: 'Tightening policy' },
    neutral: { name: 'Neutral', color: 'text-amber-400', desc: 'Balanced stance' },
    dovish: { name: 'Dovish', color: 'text-green-400', desc: 'Easing policy' }
  };

  const currentRegime = regimeConfig[regimeData?.current_regime] || regimeConfig.goldilocks;
  const currentFedStance = fedStanceConfig[fedData?.stance] || fedStanceConfig.neutral;

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800 animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="h-8 bg-gray-700 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Economic Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Economic Regime */}
        <div className="bg-[#1a1a1a] rounded-lg p-5 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-400">Economic Regime</h3>
            <button onClick={fetchAllData} className="text-gray-400 hover:text-white">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className={`text-2xl font-bold ${currentRegime.color} mb-1`}>
            {currentRegime.name}
          </div>
          <p className="text-gray-500 text-sm">{currentRegime.desc}</p>
          <div className="mt-3 pt-3 border-t border-gray-800 grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-500 text-xs">Growth Score</span>
              <div className="text-white font-medium">{regimeData?.growth_score?.toFixed(1) || '-'}</div>
            </div>
            <div>
              <span className="text-gray-500 text-xs">Inflation Score</span>
              <div className="text-white font-medium">{regimeData?.inflation_score?.toFixed(1) || '-'}</div>
            </div>
          </div>
        </div>

        {/* Fed Policy Stance */}
        <div className="bg-[#1a1a1a] rounded-lg p-5 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Fed Policy Stance</h3>
          <div className={`text-2xl font-bold ${currentFedStance.color} mb-1`}>
            {currentFedStance.name}
          </div>
          <p className="text-gray-500 text-sm">{currentFedStance.desc}</p>
          <div className="mt-3 pt-3 border-t border-gray-800 grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-500 text-xs">Stance Score</span>
              <div className="text-white font-medium">{fedData?.stance_score?.toFixed(0) || '-'}</div>
            </div>
            <div>
              <span className="text-gray-500 text-xs">Fed Funds Rate</span>
              <div className="text-white font-medium">{fedData?.fed_funds_rate || '-'}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Indicators Table */}
      <div className="bg-[#1a1a1a] rounded-lg border border-gray-800">
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Key Economic Indicators</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                <th className="px-4 py-3 font-medium">Indicator</th>
                <th className="px-4 py-3 font-medium text-right">Value</th>
                <th className="px-4 py-3 font-medium text-right">Change</th>
                <th className="px-4 py-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-3 font-medium text-white">CPI YoY</td>
                <td className="px-4 py-3 text-right text-white">{indicators.cpi_yoy?.toFixed(1)}%</td>
                <td className="px-4 py-3 text-right">-</td>
                <td className="px-4 py-3 text-gray-400 text-sm">Consumer Price Index (Year-over-Year)</td>
              </tr>
              <tr className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-3 font-medium text-white">Core PCE</td>
                <td className="px-4 py-3 text-right text-white">{indicators.core_pce?.toFixed(1)}%</td>
                <td className="px-4 py-3 text-right">-</td>
                <td className="px-4 py-3 text-gray-400 text-sm">Fed's preferred inflation measure</td>
              </tr>
              <tr className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-3 font-medium text-white">Unemployment</td>
                <td className="px-4 py-3 text-right text-white">{indicators.unemployment?.toFixed(1)}%</td>
                <td className="px-4 py-3 text-right">-</td>
                <td className="px-4 py-3 text-gray-400 text-sm">U.S. Unemployment Rate</td>
              </tr>
              <tr className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-3 font-medium text-white">GDP Growth</td>
                <td className="px-4 py-3 text-right text-white">{indicators.gdp_growth?.toFixed(1)}%</td>
                <td className="px-4 py-3 text-right">-</td>
                <td className="px-4 py-3 text-gray-400 text-sm">Real GDP Growth Rate (Annualized)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Market Indicators Table */}
      <div className="bg-[#1a1a1a] rounded-lg border border-gray-800">
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Market Indicators</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                <th className="px-4 py-3 font-medium">Indicator</th>
                <th className="px-4 py-3 font-medium text-right">Value</th>
                <th className="px-4 py-3 font-medium text-right">Change</th>
                <th className="px-4 py-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-3 font-medium text-white">S&P 500</td>
                <td className="px-4 py-3 text-right text-white">{indicators.sp500?.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <div className={`flex items-center justify-end gap-1 ${getChangeColor(indicators.sp500_change)}`}>
                    {getChangeIcon(indicators.sp500_change)}
                    {formatChange(indicators.sp500_change)}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">U.S. Large Cap Index</td>
              </tr>
              <tr className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-3 font-medium text-white">10Y Treasury</td>
                <td className="px-4 py-3 text-right text-white">{indicators.treasury_10y?.toFixed(2)}%</td>
                <td className="px-4 py-3 text-right">
                  <div className={`flex items-center justify-end gap-1 ${getChangeColor(indicators.treasury_10y_change)}`}>
                    {getChangeIcon(indicators.treasury_10y_change)}
                    {formatChange(indicators.treasury_10y_change)}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">10-Year Treasury Yield</td>
              </tr>
              <tr className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-3 font-medium text-white">VIX</td>
                <td className="px-4 py-3 text-right text-white">{indicators.vix?.toFixed(1)}</td>
                <td className="px-4 py-3 text-right">
                  <div className={`flex items-center justify-end gap-1 ${getChangeColor(indicators.vix_change)}`}>
                    {getChangeIcon(indicators.vix_change)}
                    {formatChange(indicators.vix_change)}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">Volatility Index (Fear Gauge)</td>
              </tr>
              <tr className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-3 font-medium text-white">DXY</td>
                <td className="px-4 py-3 text-right text-white">{indicators.dxy?.toFixed(1)}</td>
                <td className="px-4 py-3 text-right">
                  <div className={`flex items-center justify-end gap-1 ${getChangeColor(indicators.dxy_change)}`}>
                    {getChangeIcon(indicators.dxy_change)}
                    {formatChange(indicators.dxy_change)}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">U.S. Dollar Index</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
