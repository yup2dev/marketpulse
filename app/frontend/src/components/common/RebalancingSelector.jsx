import React from 'react';
import { RefreshCw } from 'lucide-react';
import { INPUT_CLASSES } from '../../styles/designTokens';

/**
 * RebalancingSelector - Rebalancing period selection component
 */
const RebalancingSelector = ({ value, onChange, className = '' }) => {
  const periods = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  return (
    <div className={className}>
      <label className="block text-sm text-gray-400 mb-1.5">
        <RefreshCw className="inline mr-1" size={14} />
        Rebalancing Period
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_CLASSES.default}
      >
        {periods.map(({ value: periodValue, label }) => (
          <option key={periodValue} value={periodValue}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default RebalancingSelector;
