import { RefreshCw, X } from 'lucide-react';

/**
 * Common widget header component
 * Provides consistent header layout with drag handle, title, and actions
 */
const WidgetHeader = ({
  icon: Icon,
  iconColor = 'text-blue-400',
  title,
  subtitle,
  loading = false,
  onRefresh,
  onRemove,
  children,
  className = ''
}) => {
  return (
    <div className={`flex items-center justify-between p-3 border-b border-gray-800 ${className}`}>
      {/* Left side - Drag handle area with icon and title */}
      <div className="flex items-center gap-2 cursor-move drag-handle-area flex-1 min-w-0">
        {Icon && <Icon size={18} className={iconColor} />}
        <div className="flex flex-col min-w-0">
          <h3 className="font-semibold text-white truncate">{title}</h3>
          {subtitle && (
            <span className="text-xs text-gray-500 truncate">{subtitle}</span>
          )}
        </div>
      </div>

      {/* Right side - Action buttons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Custom action buttons (optional) */}
        {children}

        {/* Refresh button */}
        {onRefresh && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRefresh();
            }}
            className="hover:text-white p-1.5 text-gray-400 transition-colors"
            title="Refresh"
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        )}

        {/* Remove button */}
        {onRemove && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="hover:text-red-400 p-1.5 text-gray-400 transition-colors"
            title="Remove"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default WidgetHeader;
