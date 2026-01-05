import React from 'react';
import { Play, Save, DollarSign } from 'lucide-react';
import PortfolioStockSelector from './PortfolioStockSelector';
import {
  DateRangePicker,
  BenchmarkSelector,
  RebalancingSelector
} from '../common';
import { BUTTON_CLASSES, INPUT_CLASSES, CARD_CLASSES } from '../../styles/designTokens';

/**
 * ConfigPanel - Left sidebar configuration panel for backtest settings
 */
const ConfigPanel = ({
  config,
  onConfigChange,
  onRun,
  onSave,
  loading = false,
  className = ''
}) => {
  const handleStockAdd = (stock) => {
    onConfigChange({
      ...config,
      symbols: [...config.symbols, stock.symbol],
      weights: {
        ...config.weights,
        [stock.symbol]: 0
      }
    });
  };

  const handleStockRemove = (symbol) => {
    const newSymbols = config.symbols.filter(s => s !== symbol);
    const newWeights = { ...config.weights };
    delete newWeights[symbol];

    onConfigChange({
      ...config,
      symbols: newSymbols,
      weights: newWeights
    });
  };

  const handleWeightChange = (symbol, weight) => {
    onConfigChange({
      ...config,
      weights: {
        ...config.weights,
        [symbol]: weight
      }
    });
  };

  const handleDateChange = (startDate, endDate) => {
    onConfigChange({
      ...config,
      startDate,
      endDate
    });
  };

  const selectedStocks = config.symbols.map(symbol => ({
    symbol,
    name: symbol,
    weight: config.weights[symbol] || 0
  }));

  return (
    <div className={`${CARD_CLASSES.default} ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-2">Backtest Configuration</h2>
        <p className="text-sm text-gray-400">Configure your portfolio backtest parameters</p>
      </div>

      <div className="space-y-6">
        {/* Stock Selection */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Portfolio Stocks</h3>
          <PortfolioStockSelector
            selectedStocks={selectedStocks}
            onAdd={handleStockAdd}
            onRemove={handleStockRemove}
            showWeights={true}
            onWeightChange={handleWeightChange}
            maxStocks={20}
          />
        </div>

        {/* Benchmark */}
        <BenchmarkSelector
          value={config.benchmark}
          onChange={(value) => onConfigChange({ ...config, benchmark: value })}
        />

        {/* Date Range */}
        <DateRangePicker
          startDate={config.startDate}
          endDate={config.endDate}
          onChange={handleDateChange}
          presets={true}
        />

        {/* Rebalancing */}
        <RebalancingSelector
          value={config.rebalancing}
          onChange={(value) => onConfigChange({ ...config, rebalancing: value })}
        />

        {/* Initial Capital */}
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">
            <DollarSign className="inline mr-1" size={14} />
            Initial Capital
          </label>
          <input
            type="number"
            min="1000"
            step="1000"
            value={config.initialCapital}
            onChange={(e) => onConfigChange({ ...config, initialCapital: parseFloat(e.target.value) })}
            className={INPUT_CLASSES.default}
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-4">
          <button
            onClick={onRun}
            disabled={loading || config.symbols.length === 0}
            className={`w-full ${BUTTON_CLASSES.primary} ${
              (loading || config.symbols.length === 0) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Play className="inline mr-2" size={16} />
            {loading ? 'Running Backtest...' : 'Run Backtest'}
          </button>

          <button
            onClick={onSave}
            disabled={config.symbols.length === 0}
            className={`w-full ${BUTTON_CLASSES.secondary}`}
          >
            <Save className="inline mr-2" size={16} />
            Save Preset
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfigPanel;
