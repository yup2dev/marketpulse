import { TrendingUp, TrendingDown } from 'lucide-react';

/**
 * MetricCard Component
 * Displays a single metric with label, value, and optional trend indicator
 */
const MetricCard = ({
  label,
  value,
  suffix = '',
  prefix = '',
  showTrend = false,
  icon: Icon = null,
  size = 'md',
  isNegative = false,
  className = '',
  color = 'auto'
}) => {
  const getColor = () => {
    if (color !== 'auto') return color;
    if (isNegative) return 'text-red-400';
    if (!showTrend) return 'text-white';
    return value > 0 ? 'text-green-400' : 'text-red-400';
  };

  const sizes = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-3xl'
  };

  const fontSize = sizes[size] || sizes.md;

  return (
    <div className={`bg-[#0a0e14] p-4 rounded-lg ${className}`}>
      <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
        {Icon && <Icon size={12} className="text-gray-500" />}
        {label}
      </div>
      <div className={`${fontSize} font-bold flex items-center gap-1.5 ${getColor()}`}>
        {showTrend && (value > 0 ? <TrendingUp size={size === 'lg' || size === 'xl' ? 20 : 16} /> : <TrendingDown size={size === 'lg' || size === 'xl' ? 20 : 16} />)}
        {prefix}{showTrend && value > 0 ? '+' : ''}{typeof value === 'number' ? value.toFixed(2) : value}{suffix}
      </div>
    </div>
  );
};

export default MetricCard;
