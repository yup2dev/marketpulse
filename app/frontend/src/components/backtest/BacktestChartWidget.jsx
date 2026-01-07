import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';
import useTheme from '../../hooks/useTheme';
import UniversalChartWidget from '../common/UniversalChartWidget';
import { CHART_COLORS } from '../widgets/common';

/**
 * BacktestChartWidget - Enhanced chart for backtest results
 * Shows portfolio equity curve, benchmark, and technical indicators
 * Uses UniversalChartWidget for all chart functionality
 */
const BacktestChartWidget = ({ results, config }) => {
  const { classes } = useTheme();
  // Transform backtest results to series format for UniversalChartWidget
  const series = useMemo(() => {
    if (!results) return [];

    const { portfolio_values, benchmark_values } = results;

    return [
      {
        id: 'portfolio',
        name: 'Portfolio',
        data: portfolio_values.map(pv => ({
          date: pv.date,
          value: pv.value,
        })),
        color: CHART_COLORS[0],
        visible: true
      },
      {
        id: 'benchmark',
        name: config?.benchmark || 'Benchmark',
        data: benchmark_values.map(bv => ({
          date: bv.date,
          value: bv.value,
        })),
        color: CHART_COLORS[1],
        visible: true
      }
    ];
  }, [results, config]);

  if (!results) {
    return (
      <div className={`${classes.widget.container} rounded-lg border p-8 text-center`}>
        <Activity className="mx-auto text-gray-600 mb-4" size={48} />
        <p className="text-gray-400">Run backtest to see equity curve</p>
      </div>
    );
  }

  return (
    <UniversalChartWidget
      series={series}
      title="Equity Curve"
      subtitle={`Portfolio vs ${config?.benchmark || 'Benchmark'}`}
      showTimeRanges={false}
      showNormalize={true}
      showVolume={false}
      showTechnicalIndicators={true}
    />
  );
};

export default BacktestChartWidget;
