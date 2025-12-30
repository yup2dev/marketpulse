import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { CARD_CLASSES } from '../../styles/designTokens';

/**
 * MetricCard - Performance metric display component
 * Displays a metric with label, value, trend indicator, and optional icon
 */
const MetricCard = ({
  label,
  value,
  trend, // 'up', 'down', or null
  icon: Icon,
  className = ''
}) => {
  const getTrendColor = () => {
    if (!trend) return 'text-gray-400';
    return trend === 'up' ? 'text-green-400' : 'text-red-400';
  };

  const TrendIcon = trend === 'up' ? TrendingUp : TrendingDown;

  return (
    <div className={`${CARD_CLASSES.default} ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-400 mb-1">{label}</p>
          <p className={`text-2xl font-bold ${getTrendColor()}`}>
            {value}
          </p>
        </div>
        {(Icon || trend) && (
          <div className="ml-3">
            {Icon && (
              <div className={`p-2 rounded-lg ${trend === 'up' ? 'bg-green-500/10' : trend === 'down' ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
                <Icon className={getTrendColor()} size={20} />
              </div>
            )}
            {!Icon && trend && (
              <TrendIcon className={getTrendColor()} size={20} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricCard;
