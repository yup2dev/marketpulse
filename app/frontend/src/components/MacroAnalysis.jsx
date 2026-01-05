import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Globe,
  Home,
  CreditCard,
  Building2,
  Activity,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { useLoading } from '../contexts/LoadingContext';
import { API_BASE } from '../config/api';
import { CARD_CLASSES } from '../styles/designTokens';
import UniversalChartWidget from './common/UniversalChartWidget';

/**
 * MacroAnalysis - Comprehensive Macroeconomic Analysis Dashboard
 * Shows all macro data from FRED, AlphaVantage, and other sources
 */
const MacroAnalysis = () => {
  const { showLoading, hideLoading } = useLoading();

  const [activeTab, setActiveTab] = useState('overview');
  const [indicators, setIndicators] = useState({});
  const [fredSeries, setFredSeries] = useState([]);
  const [forexRates, setForexRates] = useState([]);
  const [commodityRatios, setCommodityRatios] = useState({});
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [selectedRatio, setSelectedRatio] = useState(null);
  const [seriesData, setSeriesData] = useState(null);
  const [ratioData, setRatioData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadedTabs, setLoadedTabs] = useState(new Set(['overview']));

  const TABS = [
    { id: 'overview', name: 'Overview', icon: Activity },
    { id: 'commodities', name: 'Commodities', icon: BarChart3 },
    { id: 'banking', name: 'Banking & Credit', icon: Building2 },
    { id: 'money', name: 'Money Supply', icon: DollarSign },
    { id: 'rates', name: 'Interest Rates', icon: TrendingUp },
    { id: 'trade', name: 'Trade & Forex', icon: Globe },
    { id: 'realestate', name: 'Real Estate', icon: Home },
  ];

  useEffect(() => {
    fetchOverviewData();
  }, []);

  useEffect(() => {
    if (selectedSeries) {
      fetchSeriesHistory(selectedSeries.key);
    }
  }, [selectedSeries]);

  useEffect(() => {
    if (selectedRatio) {
      fetchRatioHistory(selectedRatio);
    }
  }, [selectedRatio]);

  const fetchOverviewData = async () => {
    setLoading(true);
    showLoading('거시경제 데이터를 불러오는 중...');
    try {
      // Only fetch indicators for initial load
      const indicatorsRes = await fetch(`${API_BASE}/macro/indicators/overview`);
      const indicatorsData = await indicatorsRes.json();
      setIndicators(indicatorsData.indicators || {});
    } catch (error) {
      console.error('Error fetching overview data:', error);
    } finally {
      setLoading(false);
      hideLoading();
    }
  };

  const fetchCommoditiesData = async () => {
    if (loadedTabs.has('commodities')) return; // Already loaded

    showLoading('상품 데이터를 불러오는 중...');
    try {
      const [fredSeriesRes, ratiosRes] = await Promise.all([
        fetch(`${API_BASE}/macro/fred/series`),
        fetch(`${API_BASE}/macro/commodities/ratios`)
      ]);

      const fredData = await fredSeriesRes.json();
      const ratiosData = await ratiosRes.json();

      setFredSeries(fredData.series || []);
      setCommodityRatios(ratiosData.ratios || {});
      setLoadedTabs(prev => new Set([...prev, 'commodities']));
    } catch (error) {
      console.error('Error fetching commodities data:', error);
    } finally {
      hideLoading();
    }
  };

  const fetchCategoryData = async (category) => {
    if (loadedTabs.has(category)) return; // Already loaded

    showLoading('데이터를 불러오는 중...');
    try {
      const fredSeriesRes = await fetch(`${API_BASE}/macro/fred/series`);
      const fredData = await fredSeriesRes.json();
      setFredSeries(fredData.series || []);
      setLoadedTabs(prev => new Set([...prev, category]));
    } catch (error) {
      console.error(`Error fetching ${category} data:`, error);
    } finally {
      hideLoading();
    }
  };

  const fetchForexData = async () => {
    if (loadedTabs.has('trade')) return; // Already loaded

    showLoading('외환 데이터를 불러오는 중...');
    try {
      const [fredSeriesRes, forexRes] = await Promise.all([
        fetch(`${API_BASE}/macro/fred/series`),
        fetch(`${API_BASE}/macro/forex/rates`)
      ]);

      const fredData = await fredSeriesRes.json();
      const forexData = await forexRes.json();

      setFredSeries(fredData.series || []);
      setForexRates(forexData.forex_rates || []);
      setLoadedTabs(prev => new Set([...prev, 'trade']));
    } catch (error) {
      console.error('Error fetching forex data:', error);
    } finally {
      hideLoading();
    }
  };

  const fetchSeriesHistory = async (seriesKey, period = '5y') => {
    showLoading('시계열 데이터를 불러오는 중...');
    try {
      const response = await fetch(`${API_BASE}/macro/fred/series/${seriesKey}?period=${period}`);
      const data = await response.json();
      setSeriesData(data);
      setRatioData(null);  // Clear ratio data when showing series
    } catch (error) {
      console.error('Error fetching series history:', error);
    } finally {
      hideLoading();
    }
  };

  const fetchRatioHistory = async (ratioType, period = '5y') => {
    showLoading('비율 데이터를 불러오는 중...');
    try {
      const response = await fetch(`${API_BASE}/macro/commodities/ratios/${ratioType}?period=${period}`);
      const data = await response.json();
      setRatioData(data);
      setSeriesData(null);  // Clear series data when showing ratio
    } catch (error) {
      console.error('Error fetching ratio history:', error);
    } finally {
      hideLoading();
    }
  };

  const renderMetricCard = (title, value, unit, change, Icon) => (
    <div className={`${CARD_CLASSES.default} p-4`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="text-xs text-gray-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-white">
            {value !== null && value !== undefined ? value.toLocaleString() : 'N/A'}
            <span className="text-sm text-gray-400 ml-1">{unit}</span>
          </p>
        </div>
        <Icon className="text-blue-400" size={20} />
      </div>
      {change !== null && change !== undefined && (
        <div className={`flex items-center text-sm ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {change >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          <span className="ml-1">{Math.abs(change).toFixed(2)}%</span>
        </div>
      )}
    </div>
  );

  const handleTabChange = async (tabId) => {
    setActiveTab(tabId);
    setSelectedSeries(null);
    setSelectedRatio(null);
    setSeriesData(null);
    setRatioData(null);

    // Load data for the tab if not already loaded
    if (tabId === 'commodities') {
      await fetchCommoditiesData();
    } else if (tabId === 'trade') {
      await fetchForexData();
    } else if (['banking', 'money', 'rates', 'realestate'].includes(tabId)) {
      await fetchCategoryData(tabId);
    }
    // 'overview' doesn't need additional data
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Core Economic Indicators */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Core Economic Indicators</h2>
        <p className="text-sm text-gray-400 mb-4">
          Latest macroeconomic data. Click on each tab above to explore detailed data.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {indicators.gdp && renderMetricCard(
            'GDP',
            indicators.gdp.value,
            'B USD',
            indicators.gdp.change,
            BarChart3
          )}
          {indicators.unemployment && renderMetricCard(
            'Unemployment Rate',
            indicators.unemployment.value,
            '%',
            indicators.unemployment.change,
            TrendingDown
          )}
          {indicators.cpi && renderMetricCard(
            'CPI (Inflation)',
            indicators.cpi.value,
            'Index',
            indicators.cpi.change,
            TrendingUp
          )}
          {indicators.fed_funds_rate && renderMetricCard(
            'Fed Funds Rate',
            indicators.fed_funds_rate.value,
            '%',
            indicators.fed_funds_rate.change,
            DollarSign
          )}
          {indicators.retail_sales && renderMetricCard(
            'Retail Sales',
            indicators.retail_sales.value,
            'M USD',
            indicators.retail_sales.change,
            CreditCard
          )}
          {indicators.consumer_sentiment && renderMetricCard(
            'Consumer Sentiment',
            indicators.consumer_sentiment.value,
            'Index',
            indicators.consumer_sentiment.change,
            Activity
          )}
        </div>
      </div>
    </div>
  );

  const renderCommodities = () => {
    // Show loading state if data not yet loaded
    if (!loadedTabs.has('commodities')) {
      return (
        <div className="text-center py-12">
          <Activity className="animate-spin mx-auto mb-4 text-blue-400" size={48} />
          <p className="text-gray-400">Loading commodities data...</p>
        </div>
      );
    }

    const preciousMetals = fredSeries.filter(s => ['gold', 'silver', 'platinum', 'palladium'].includes(s.key));
    const energy = fredSeries.filter(s => ['crude_oil_wti', 'natural_gas'].includes(s.key));
    const industrialMetals = fredSeries.filter(s => ['copper'].includes(s.key));

    return (
      <div className="space-y-6">
        {/* Commodity Ratios Section */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Commodity Ratios</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(commodityRatios).map(([key, ratio]) => (
              <div
                key={key}
                onClick={() => setSelectedRatio(key)}
                className={`${CARD_CLASSES.default} p-4 cursor-pointer hover:border-blue-500 transition-colors ${
                  selectedRatio === key ? 'border-blue-500' : ''
                }`}
              >
                <p className="text-xs text-gray-400 mb-1">{ratio.name}</p>
                <p className="text-2xl font-bold text-white">
                  {ratio.value?.toFixed(2) || 'N/A'}
                </p>
                <p className="text-xs text-gray-500 mt-1">{ratio.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Precious Metals */}
        {preciousMetals.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Precious Metals</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {preciousMetals.map((series) => (
                <div
                  key={series.key}
                  onClick={() => {
                    setSelectedSeries(series);
                    setSelectedRatio(null);
                  }}
                  className={`${CARD_CLASSES.default} p-4 cursor-pointer hover:border-blue-500 transition-colors ${
                    selectedSeries?.key === series.key ? 'border-blue-500' : ''
                  }`}
                >
                  <p className="text-xs text-gray-400 mb-1">{series.name}</p>
                  <p className="text-2xl font-bold text-white">
                    ${series.value?.toLocaleString() || 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{series.unit}</p>
                  {series.change !== null && (
                    <div className={`flex items-center text-sm mt-2 ${series.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {series.change >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                      <span className="ml-1">{Math.abs(series.change).toFixed(2)}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Energy Commodities */}
        {energy.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Energy</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {energy.map((series) => (
                <div
                  key={series.key}
                  onClick={() => {
                    setSelectedSeries(series);
                    setSelectedRatio(null);
                  }}
                  className={`${CARD_CLASSES.default} p-4 cursor-pointer hover:border-blue-500 transition-colors ${
                    selectedSeries?.key === series.key ? 'border-blue-500' : ''
                  }`}
                >
                  <p className="text-xs text-gray-400 mb-1">{series.name}</p>
                  <p className="text-2xl font-bold text-white">
                    ${series.value?.toLocaleString() || 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{series.unit}</p>
                  {series.change !== null && (
                    <div className={`flex items-center text-sm mt-2 ${series.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {series.change >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                      <span className="ml-1">{Math.abs(series.change).toFixed(2)}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Industrial Metals */}
        {industrialMetals.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Industrial Metals</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {industrialMetals.map((series) => (
                <div
                  key={series.key}
                  onClick={() => {
                    setSelectedSeries(series);
                    setSelectedRatio(null);
                  }}
                  className={`${CARD_CLASSES.default} p-4 cursor-pointer hover:border-blue-500 transition-colors ${
                    selectedSeries?.key === series.key ? 'border-blue-500' : ''
                  }`}
                >
                  <p className="text-xs text-gray-400 mb-1">{series.name}</p>
                  <p className="text-2xl font-bold text-white">
                    ${series.value?.toLocaleString() || 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{series.unit}</p>
                  {series.change !== null && (
                    <div className={`flex items-center text-sm mt-2 ${series.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {series.change >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                      <span className="ml-1">{Math.abs(series.change).toFixed(2)}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chart for selected item */}
        {(selectedSeries && seriesData) && (
          <UniversalChartWidget
            series={[
              {
                id: seriesData.key || 'commodity',
                name: seriesData.name,
                data: seriesData.data,
                color: '#f59e0b',
                visible: true
              }
            ]}
            title={seriesData.name}
            subtitle={`${seriesData.category} - ${seriesData.unit}`}
            showTimeRanges={true}
            showNormalize={false}
            showVolume={false}
            showTechnicalIndicators={true}
          />
        )}

        {/* Chart for selected ratio */}
        {(selectedRatio && ratioData) && (
          <UniversalChartWidget
            series={[
              {
                id: ratioData.ratio_type,
                name: ratioData.name,
                data: ratioData.data,
                color: '#8b5cf6',
                visible: true
              }
            ]}
            title={ratioData.name}
            subtitle={ratioData.description}
            showTimeRanges={true}
            showNormalize={false}
            showVolume={false}
            showTechnicalIndicators={true}
          />
        )}
      </div>
    );
  };

  const renderTrade = () => {
    // Show loading state if data not yet loaded
    if (!loadedTabs.has('trade')) {
      return (
        <div className="text-center py-12">
          <Activity className="animate-spin mx-auto mb-4 text-blue-400" size={48} />
          <p className="text-gray-400">Loading trade data...</p>
        </div>
      );
    }

    const tradeBalance = fredSeries.filter(s => s.key === 'trade_balance');

    return (
      <div className="space-y-6">
        {/* Trade Balance */}
        {tradeBalance.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Trade Balance</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tradeBalance.map((series) => (
                <div
                  key={series.key}
                  onClick={() => {
                    setSelectedSeries(series);
                    setSelectedRatio(null);
                  }}
                  className={`${CARD_CLASSES.default} p-4 cursor-pointer hover:border-blue-500 transition-colors ${
                    selectedSeries?.key === series.key ? 'border-blue-500' : ''
                  }`}
                >
                  <p className="text-xs text-gray-400 mb-1">{series.name}</p>
                  <p className="text-2xl font-bold text-white">
                    ${series.value?.toLocaleString() || 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{series.unit}</p>
                  {series.change !== null && (
                    <div className={`flex items-center text-sm mt-2 ${series.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {series.change >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                      <span className="ml-1">{Math.abs(series.change).toFixed(2)}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Forex Rates */}
        {forexRates.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Major Forex Rates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {forexRates.map((rate) => (
                <div key={rate.pair} className={`${CARD_CLASSES.default} p-4`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">{rate.pair}</p>
                      <p className="text-2xl font-bold text-white">{rate.rate?.toFixed(4)}</p>
                    </div>
                    <Globe className="text-blue-400" size={20} />
                  </div>
                  {rate.change !== null && (
                    <div className={`flex items-center text-sm ${rate.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {rate.change >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                      <span className="ml-1">{Math.abs(rate.change).toFixed(2)}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chart for selected item */}
        {(selectedSeries && seriesData) && (
          <UniversalChartWidget
            series={[
              {
                id: seriesData.key || 'trade',
                name: seriesData.name,
                data: seriesData.data,
                color: '#3b82f6',
                visible: true
              }
            ]}
            title={seriesData.name}
            subtitle={`${seriesData.category} - ${seriesData.unit}`}
            showTimeRanges={true}
            showNormalize={false}
            showVolume={false}
            showTechnicalIndicators={true}
          />
        )}
      </div>
    );
  };

  const renderCategoryData = (category) => {
    // Show loading state if data not yet loaded
    if (!loadedTabs.has(category)) {
      return (
        <div className="text-center py-12">
          <Activity className="animate-spin mx-auto mb-4 text-blue-400" size={48} />
          <p className="text-gray-400">Loading data...</p>
        </div>
      );
    }

    const categoryMap = {
      'banking': ['bank_loans', 'foreign_bank_assets', 'consumer_credit'],
      'money': ['money_supply_m1', 'money_supply_m2'],
      'rates': ['treasury_10y', 'treasury_2y'],
      'realestate': ['case_shiller']
    };

    const seriesKeys = categoryMap[category] || [];
    const filteredSeries = fredSeries.filter(s => seriesKeys.includes(s.key));

    if (filteredSeries.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <p>No data available for this category</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSeries.map((series) => (
            <div
              key={series.key}
              onClick={() => setSelectedSeries(series)}
              className={`${CARD_CLASSES.default} p-4 cursor-pointer hover:border-blue-500 transition-colors ${
                selectedSeries?.key === series.key ? 'border-blue-500' : ''
              }`}
            >
              <p className="text-xs text-gray-400 mb-1">{series.name}</p>
              <p className="text-2xl font-bold text-white">
                {series.value?.toLocaleString() || 'N/A'}
              </p>
              <p className="text-xs text-gray-500 mt-1">{series.unit}</p>
              {series.change !== null && (
                <div className={`flex items-center text-sm mt-2 ${series.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {series.change >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  <span className="ml-1">{Math.abs(series.change).toFixed(2)}%</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Chart for selected series */}
        {selectedSeries && seriesData && (
          <UniversalChartWidget
            series={[
              {
                id: seriesData.key || 'macro_series',
                name: seriesData.name,
                data: seriesData.data,
                color: '#3b82f6',
                visible: true
              }
            ]}
            title={seriesData.name}
            subtitle={`${seriesData.category} - ${seriesData.unit}`}
            showTimeRanges={true}
            showNormalize={false}
            showVolume={false}
            showTechnicalIndicators={true}
          />
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Activity className="animate-spin mx-auto mb-4 text-blue-400" size={48} />
          <p className="text-gray-400">Loading macroeconomic data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Macro Economic Analysis</h1>
        <p className="text-gray-400">
          Comprehensive macroeconomic indicators, banking data, money supply, forex rates, and more
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 mb-6 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <Icon size={16} />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'commodities' && renderCommodities()}
        {activeTab === 'banking' && renderCategoryData('banking')}
        {activeTab === 'money' && renderCategoryData('money')}
        {activeTab === 'rates' && renderCategoryData('rates')}
        {activeTab === 'trade' && renderTrade()}
        {activeTab === 'realestate' && renderCategoryData('realestate')}
      </div>
    </div>
  );
};

export default MacroAnalysis;
