import React, { useState, useEffect } from 'react';
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
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { API_BASE } from '../config/api';
import { CARD_CLASSES } from '../styles/designTokens';

/**
 * MacroAnalysis - Comprehensive Macroeconomic Analysis Dashboard
 * Shows all macro data from FRED, AlphaVantage, and other sources
 */
const MacroAnalysis = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [indicators, setIndicators] = useState({});
  const [fredSeries, setFredSeries] = useState([]);
  const [forexRates, setForexRates] = useState([]);
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [seriesData, setSeriesData] = useState(null);
  const [loading, setLoading] = useState(true);

  const TABS = [
    { id: 'overview', name: 'Overview', icon: Activity },
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

  const fetchOverviewData = async () => {
    setLoading(true);
    try {
      const [indicatorsRes, fredSeriesRes, forexRes] = await Promise.all([
        fetch(`${API_BASE}/macro/indicators/overview`),
        fetch(`${API_BASE}/macro/fred/series`),
        fetch(`${API_BASE}/macro/forex/rates`)
      ]);

      const indicatorsData = await indicatorsRes.json();
      const fredData = await fredSeriesRes.json();
      const forexData = await forexRes.json();

      setIndicators(indicatorsData.indicators || {});
      setFredSeries(fredData.series || []);
      setForexRates(forexData.forex_rates || []);
    } catch (error) {
      console.error('Error fetching macro data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSeriesHistory = async (seriesKey, period = '5y') => {
    try {
      const response = await fetch(`${API_BASE}/macro/fred/series/${seriesKey}?period=${period}`);
      const data = await response.json();
      setSeriesData(data);
    } catch (error) {
      console.error('Error fetching series history:', error);
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

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Core Economic Indicators */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Core Economic Indicators</h2>
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
    </div>
  );

  const renderCategoryData = (category) => {
    const categoryMap = {
      'banking': ['bank_loans', 'foreign_bank_assets', 'consumer_credit'],
      'money': ['money_supply_m1', 'money_supply_m2'],
      'rates': ['treasury_10y', 'treasury_2y'],
      'trade': ['trade_balance'],
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
          <div className={CARD_CLASSES.default}>
            <div className="p-4 border-b border-gray-800">
              <h3 className="text-lg font-semibold text-white">{seriesData.name}</h3>
              <p className="text-sm text-gray-400">{seriesData.category} - {seriesData.unit}</p>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={seriesData.data}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey="date"
                    stroke="#666"
                    tick={{ fill: '#666', fontSize: 12 }}
                  />
                  <YAxis
                    stroke="#666"
                    tick={{ fill: '#666', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: '8px'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#colorValue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
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
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedSeries(null);
                setSeriesData(null);
              }}
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
        {activeTab === 'banking' && renderCategoryData('banking')}
        {activeTab === 'money' && renderCategoryData('money')}
        {activeTab === 'rates' && renderCategoryData('rates')}
        {activeTab === 'trade' && renderCategoryData('trade')}
        {activeTab === 'realestate' && renderCategoryData('realestate')}
      </div>
    </div>
  );
};

export default MacroAnalysis;
