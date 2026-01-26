/**
 * Macro 개요 탭 - 주요 거시경제 지표 요약 대시보드
 */
import { useState, useEffect } from 'react';
import {
  Globe,
  Target,
  Building2,
  TrendingUp,
  DollarSign,
  Users,
  Activity,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { API_BASE } from '../../config/api';
import { CARD_CLASSES } from '../../styles/designTokens';

// Skeleton Loader Component
const SkeletonCard = ({ className = "" }) => (
  <div className={`animate-pulse ${className}`}>
    <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
    <div className="h-8 bg-gray-700 rounded w-1/2"></div>
  </div>
);

// Metric Card Component
const MetricCard = ({ title, value, change, changeLabel, icon: Icon, color, loading, onClick }) => {
  const isPositive = change > 0;
  const isNegative = change < 0;

  return (
    <div
      onClick={onClick}
      className={`${CARD_CLASSES.default} p-5 hover:border-gray-600 transition-all cursor-pointer group`}
    >
      {loading ? (
        <SkeletonCard />
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm font-medium">{title}</span>
            <div className={`p-2 rounded-lg ${color}`}>
              <Icon size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mb-1">{value}</div>
          {change !== undefined && (
            <div className="flex items-center gap-1">
              {isPositive && <ArrowUp size={14} className="text-green-500" />}
              {isNegative && <ArrowDown size={14} className="text-red-500" />}
              {!isPositive && !isNegative && <Minus size={14} className="text-gray-500" />}
              <span className={`text-sm ${isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-gray-500'}`}>
                {isPositive ? '+' : ''}{change?.toFixed(2)}%
              </span>
              {changeLabel && <span className="text-gray-500 text-xs ml-1">{changeLabel}</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Regime Card Component
const RegimeCard = ({ regime, loading }) => {
  const regimeConfig = {
    goldilocks: { name: 'Goldilocks', emoji: '🌟', color: 'text-green-500', bg: 'bg-green-500/10' },
    reflation: { name: 'Reflation', emoji: '🔥', color: 'text-amber-500', bg: 'bg-amber-500/10' },
    stagflation: { name: 'Stagflation', emoji: '⚠️', color: 'text-red-500', bg: 'bg-red-500/10' },
    deflation: { name: 'Deflation', emoji: '❄️', color: 'text-blue-500', bg: 'bg-blue-500/10' }
  };

  const config = regimeConfig[regime?.current_regime] || regimeConfig.goldilocks;

  return (
    <div className={`${CARD_CLASSES.default} p-5`}>
      {loading ? (
        <SkeletonCard />
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm font-medium">현재 경제 국면</span>
            <Target size={18} className="text-green-500" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{config.emoji}</span>
            <div>
              <div className={`text-xl font-bold ${config.color}`}>{config.name}</div>
              <div className="text-gray-500 text-xs">Growth: {regime?.growth_score?.toFixed(1)} | Inflation: {regime?.inflation_score?.toFixed(1)}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Fed Stance Card Component
const FedStanceCard = ({ stance, loading }) => {
  const stanceConfig = {
    hawkish: { name: 'Hawkish', emoji: '🦅', color: 'text-red-500', bg: 'bg-red-500/10' },
    neutral: { name: 'Neutral', emoji: '⚖️', color: 'text-amber-500', bg: 'bg-amber-500/10' },
    dovish: { name: 'Dovish', emoji: '🕊️', color: 'text-green-500', bg: 'bg-green-500/10' }
  };

  const config = stanceConfig[stance?.stance] || stanceConfig.neutral;

  return (
    <div className={`${CARD_CLASSES.default} p-5`}>
      {loading ? (
        <SkeletonCard />
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm font-medium">Fed 정책 기조</span>
            <Building2 size={18} className="text-green-500" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{config.emoji}</span>
            <div>
              <div className={`text-xl font-bold ${config.color}`}>{config.name}</div>
              <div className="text-gray-500 text-xs">Score: {stance?.stance_score?.toFixed(0)} | Rate: {stance?.fed_funds_rate}%</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Quick Stats Row Component
const QuickStatsRow = ({ data, loading }) => (
  <div className={`${CARD_CLASSES.default} p-5`}>
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-white font-semibold">주요 지표 현황</h3>
      <Activity size={18} className="text-green-500" />
    </div>
    {loading ? (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
      </div>
    ) : (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-3 bg-gray-800/50 rounded-lg">
          <div className="text-gray-400 text-xs mb-1">CPI YoY</div>
          <div className="text-lg font-bold text-white">{data?.cpi_yoy?.toFixed(1)}%</div>
        </div>
        <div className="text-center p-3 bg-gray-800/50 rounded-lg">
          <div className="text-gray-400 text-xs mb-1">Core PCE</div>
          <div className="text-lg font-bold text-white">{data?.core_pce?.toFixed(1)}%</div>
        </div>
        <div className="text-center p-3 bg-gray-800/50 rounded-lg">
          <div className="text-gray-400 text-xs mb-1">실업률</div>
          <div className="text-lg font-bold text-white">{data?.unemployment?.toFixed(1)}%</div>
        </div>
        <div className="text-center p-3 bg-gray-800/50 rounded-lg">
          <div className="text-gray-400 text-xs mb-1">GDP 성장률</div>
          <div className="text-lg font-bold text-white">{data?.gdp_growth?.toFixed(1)}%</div>
        </div>
      </div>
    )}
  </div>
);

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

      // Set some default/mock data for quick stats
      setIndicators({
        cpi_yoy: 3.2,
        core_pce: 2.8,
        unemployment: 3.9,
        gdp_growth: 2.1
      });
    } catch (error) {
      console.error('Error fetching macro data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="space-y-6">
        {/* Header */}
        <div className={`${CARD_CLASSES.default} p-6`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-600/20 rounded-xl">
                <Globe className="text-green-500" size={28} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">거시경제 개요</h2>
                <p className="text-gray-400 text-sm mt-0.5">주요 경제 지표와 시장 현황을 한눈에 확인하세요</p>
              </div>
            </div>
            <button
              onClick={fetchAllData}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title="새로고침"
            >
              <RefreshCw size={18} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Main Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RegimeCard regime={regimeData} loading={loading} />
          <FedStanceCard stance={fedData} loading={loading} />
        </div>

        {/* Quick Stats */}
        <QuickStatsRow data={indicators} loading={loading} />

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="S&P 500"
            value="5,234"
            change={0.85}
            changeLabel="오늘"
            icon={TrendingUp}
            color="bg-blue-500/10 text-blue-500"
            loading={loading}
          />
          <MetricCard
            title="10Y Treasury"
            value="4.28%"
            change={-0.03}
            changeLabel="전일비"
            icon={BarChart3}
            color="bg-purple-500/10 text-purple-500"
            loading={loading}
          />
          <MetricCard
            title="VIX"
            value="14.2"
            change={-5.2}
            changeLabel="전일비"
            icon={Activity}
            color="bg-amber-500/10 text-amber-500"
            loading={loading}
          />
          <MetricCard
            title="DXY"
            value="104.5"
            change={0.15}
            changeLabel="전일비"
            icon={DollarSign}
            color="bg-green-500/10 text-green-500"
            loading={loading}
          />
        </div>

        {/* Navigation Hint */}
        <div className={`${CARD_CLASSES.default} p-4`}>
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <AlertCircle size={16} />
            <span>상단 탭을 클릭하여 각 섹션의 상세 분석을 확인하세요</span>
          </div>
        </div>
      </div>
    </div>
  );
}
