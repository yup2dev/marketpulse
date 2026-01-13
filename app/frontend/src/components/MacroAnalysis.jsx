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
  ArrowDownRight,
  Target
} from 'lucide-react';
import { useLoading } from '../contexts/LoadingContext';
import { API_BASE } from '../config/api';
import { CARD_CLASSES } from '../styles/designTokens';
import UniversalChartWidget from './common/UniversalChartWidget';
import RegimeDashboard from './macro/RegimeDashboard';
import FedPolicyGauge from './macro/FedPolicyGauge';
import YieldCurveChart from './macro/YieldCurveChart';
import InflationDecomposition from './macro/InflationDecomposition';
import LaborMarketHeatmap from './macro/LaborMarketHeatmap';
import FinancialConditionsWidget from './macro/FinancialConditionsWidget';
import SentimentComposite from './macro/SentimentComposite';

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
    { id: 'overview', name: 'Overview' },
    { id: 'regime', name: 'Economic Regime' },
    { id: 'fed-policy', name: 'Fed Policy' },
    { id: 'yield-curve', name: 'Yield Curve' },
    { id: 'inflation', name: 'Inflation' },
    { id: 'labor', name: 'Labor Market' },
    { id: 'financial-conditions', name: 'Financial Conditions' },
    { id: 'sentiment', name: 'Market Sentiment' },
    { id: 'commodities', name: 'Commodities' },
    { id: 'banking', name: 'Banking & Credit' },
    { id: 'money', name: 'Money Supply' },
    { id: 'rates', name: 'Interest Rates' },
    { id: 'trade', name: 'Trade & Forex' },
    { id: 'realestate', name: 'Real Estate' },
  ];

  useEffect(() => {
    fetchOverviewData();
  }, []);

  useEffect(() => {
    if (selectedSeries && selectedSeries.type !== 'indicator') {
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

  const fetchIndicatorHistory = async (indicatorKey, period = '5y') => {
    showLoading('지표 데이터를 불러오는 중...');
    try {
      const response = await fetch(`${API_BASE}/macro/indicators/${indicatorKey}/history?period=${period}`);
      const data = await response.json();
      setSeriesData(data);
      setRatioData(null);  // Clear ratio data when showing indicator
    } catch (error) {
      console.error('Error fetching indicator history:', error);
    } finally {
      hideLoading();
    }
  };

  const renderMetricCard = (title, value, unit, change, Icon, indicatorKey) => (
    <div
      className={`${CARD_CLASSES.default} p-4 cursor-pointer hover:border-blue-500 transition-colors ${
        selectedSeries?.key === indicatorKey ? 'border-blue-500' : ''
      }`}
      onClick={() => {
        setSelectedSeries({ key: indicatorKey, name: title, type: 'indicator' });
        setSelectedRatio(null);
        fetchIndicatorHistory(indicatorKey);
      }}
    >
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
          Latest macroeconomic data. Click on each card to view historical data.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {indicators.gdp && renderMetricCard(
            'GDP',
            indicators.gdp.value,
            'B USD',
            indicators.gdp.change,
            BarChart3,
            'gdp'
          )}
          {indicators.unemployment && renderMetricCard(
            'Unemployment Rate',
            indicators.unemployment.value,
            '%',
            indicators.unemployment.change,
            TrendingDown,
            'unemployment'
          )}
          {indicators.cpi && renderMetricCard(
            'CPI (Inflation)',
            indicators.cpi.value,
            'Index',
            indicators.cpi.change,
            TrendingUp,
            'cpi'
          )}
          {indicators.fed_funds_rate && renderMetricCard(
            'Fed Funds Rate',
            indicators.fed_funds_rate.value,
            '%',
            indicators.fed_funds_rate.change,
            DollarSign,
            'fed_funds_rate'
          )}
          {indicators.retail_sales && renderMetricCard(
            'Retail Sales',
            indicators.retail_sales.value,
            'M USD',
            indicators.retail_sales.change,
            CreditCard,
            'retail_sales'
          )}
          {indicators.consumer_sentiment && renderMetricCard(
            'Consumer Sentiment',
            indicators.consumer_sentiment.value,
            'Index',
            indicators.consumer_sentiment.change,
            Activity,
            'consumer_sentiment'
          )}
        </div>
      </div>

      {/* Chart for selected indicator */}
      {selectedSeries && seriesData && (
        <UniversalChartWidget
          series={[
            {
              id: seriesData.key || selectedSeries.key,
              name: seriesData.name || selectedSeries.name,
              data: seriesData.data || [],
              color: '#3b82f6',
              visible: true
            }
          ]}
          title={seriesData.name || selectedSeries.name}
          subtitle={seriesData.unit || ''}
          showTimeRanges={true}
          showNormalize={false}
          showVolume={false}
          showTechnicalIndicators={true}
          onPeriodChange={(period) => {
            if (selectedSeries.type === 'indicator') {
              fetchIndicatorHistory(selectedSeries.key, period);
            } else {
              fetchSeriesHistory(selectedSeries.key, period);
            }
          }}
        />
      )}
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
            onPeriodChange={(period) => fetchSeriesHistory(selectedSeries.key, period)}
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
            onPeriodChange={(period) => fetchRatioHistory(selectedRatio, period)}
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
            onPeriodChange={(period) => fetchSeriesHistory(selectedSeries.key, period)}
          />
        )}
      </div>
    );
  };

  const renderRegime = () => {
    return <RegimeDashboard />;
  };

  const renderFedPolicy = () => {
    return <FedPolicyGauge />;
  };

  const renderYieldCurve = () => {
    return <YieldCurveChart />;
  };

  const renderInflation = () => {
    return <InflationDecomposition />;
  };

  const renderLabor = () => {
    return <LaborMarketHeatmap />;
  };

  const renderFinancialConditions = () => {
    return <FinancialConditionsWidget />;
  };

  const renderSentiment = () => {
    return <SentimentComposite />;
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
            onPeriodChange={(period) => fetchSeriesHistory(selectedSeries.key, period)}
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
      <div className="border-b border-gray-800 mb-6">
        <div className="flex gap-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`pb-3 px-1 text-sm font-medium transition-colors relative whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab.name}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'regime' && renderRegime()}
        {activeTab === 'fed-policy' && renderFedPolicy()}
        {activeTab === 'yield-curve' && renderYieldCurve()}
        {activeTab === 'inflation' && renderInflation()}
        {activeTab === 'labor' && renderLabor()}
        {activeTab === 'financial-conditions' && renderFinancialConditions()}
        {activeTab === 'sentiment' && renderSentiment()}
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
