import React from 'react';
import { TrendingUp, TrendingDown, Activity, Target } from 'lucide-react';
import MetricCard from '../widgets/common/MetricCard';
import EquityCurve from './EquityCurve';
import PerformanceTable from './PerformanceTable';
import { CARD_CLASSES } from '../../styles/designTokens';

/**
 * ResultsDashboard - Display backtest results with charts and metrics
 */
const ResultsDashboard = ({ results, className = '' }) => {
  if (!results) {
    return (
      <div className={`flex flex-col items-center justify-center h-full min-h-[600px] ${className}`}>
        <Activity className="text-gray-600 mb-4" size={64} />
        <h3 className="text-xl font-semibold text-gray-400 mb-2">No Results Yet</h3>
        <p className="text-gray-500 text-center max-w-md">
          Configure your backtest parameters and click "Run Backtest" to see results
        </p>
      </div>
    );
  }

  const { statistics, portfolio_values, benchmark_values, yearly_returns } = results;

  // Format chart data
  const chartData = portfolio_values.map((pv, index) => ({
    date: pv.date,
    portfolio: pv.value,
    benchmark: benchmark_values[index]?.value || null
  }));

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Return"
          value={`${statistics.totalReturn >= 0 ? '+' : ''}${statistics.totalReturn.toFixed(2)}%`}
          trend={statistics.totalReturn >= 0 ? 'up' : 'down'}
          icon={TrendingUp}
        />
        <MetricCard
          label="Annual Return"
          value={`${statistics.annualizedReturn >= 0 ? '+' : ''}${statistics.annualizedReturn.toFixed(2)}%`}
          trend={statistics.annualizedReturn >= 0 ? 'up' : 'down'}
          icon={Target}
        />
        <MetricCard
          label="Sharpe Ratio"
          value={statistics.sharpeRatio.toFixed(2)}
          trend={statistics.sharpeRatio >= 1 ? 'up' : statistics.sharpeRatio >= 0 ? null : 'down'}
          icon={Activity}
        />
        <MetricCard
          label="Max Drawdown"
          value={`${statistics.maxDrawdown.toFixed(2)}%`}
          trend="down"
          icon={TrendingDown}
        />
      </div>

      {/* Equity Curve Chart */}
      <div className={CARD_CLASSES.default}>
        <h3 className="text-lg font-semibold text-white mb-4">Equity Curve</h3>
        <EquityCurve data={chartData} showBenchmark={true} />
      </div>

      {/* Performance Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Performance Metrics */}
        <div className={CARD_CLASSES.default}>
          <h3 className="text-lg font-semibold text-white mb-4">Performance Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Volatility</span>
              <span className="text-sm font-semibold text-white">
                {statistics.volatility?.toFixed(2) || 'N/A'}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Win Rate</span>
              <span className="text-sm font-semibold text-white">
                {statistics.winRate?.toFixed(2) || 'N/A'}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Total Trades</span>
              <span className="text-sm font-semibold text-white">
                {statistics.trades || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Avg Holding Period</span>
              <span className="text-sm font-semibold text-white">
                {statistics.avgHoldingPeriod?.toFixed(0) || 'N/A'} days
              </span>
            </div>
          </div>
        </div>

        {/* Capital Overview */}
        <div className={CARD_CLASSES.default}>
          <h3 className="text-lg font-semibold text-white mb-4">Capital Overview</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Initial Capital</span>
              <span className="text-sm font-semibold text-white">
                ${portfolio_values[0]?.value.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Final Value</span>
              <span className="text-sm font-semibold text-white">
                ${portfolio_values[portfolio_values.length - 1]?.value.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Total Gain/Loss</span>
              <span className={`text-sm font-semibold ${
                statistics.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                ${((portfolio_values[portfolio_values.length - 1]?.value - portfolio_values[0]?.value) || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Best Year</span>
              <span className="text-sm font-semibold text-green-400">
                {Math.max(...yearly_returns.map(y => parseFloat(y.return))).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Yearly Returns Table */}
      <PerformanceTable yearlyReturns={yearly_returns} />
    </div>
  );
};

export default ResultsDashboard;
