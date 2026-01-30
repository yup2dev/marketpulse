/**
 * UtilWidgetHeader - Enhanced header with all controls
 * Supports icon, title, symbol selector, series selector, export, and actions
 */
import { RefreshCw, X, Download } from 'lucide-react';
import useTheme from '../../../hooks/useTheme';
import SymbolSelector from './SymbolSelector';
import SeriesSelector from './SeriesSelector';
import { exportToExcel, generateFilename } from '../../../utils/exportUtils';

/**
 * @param {Object} props
 * @param {React.ComponentType} props.icon - Lucide icon component
 * @param {string} props.iconColor - Icon color class (default: 'text-blue-400')
 * @param {string} props.title - Widget title
 * @param {string} props.subtitle - Optional subtitle
 * @param {string} props.symbol - Current symbol for selector
 * @param {Function} props.onSymbolChange - Callback when symbol changes
 * @param {boolean} props.showSymbolSelector - Show symbol selector (default: false)
 * @param {Array} props.series - Series data for series selector
 * @param {Function} props.onSeriesToggle - Callback when series toggles
 * @param {Array} props.exportData - Data array for export
 * @param {Array} props.exportColumns - Column definitions for export
 * @param {string} props.exportFilename - Filename prefix for export
 * @param {boolean} props.loading - Loading state
 * @param {Function} props.onRefresh - Refresh callback
 * @param {Function} props.onRemove - Remove callback
 * @param {React.ReactNode} props.children - Additional header content
 * @param {React.ReactNode} props.headerExtra - Extra content after selectors
 * @param {string} props.className - Additional CSS classes
 */
const UtilWidgetHeader = ({
  icon: Icon,
  iconColor = 'text-blue-400',
  title,
  subtitle,
  symbol,
  onSymbolChange,
  showSymbolSelector = false,
  series,
  onSeriesToggle,
  exportData,
  exportColumns,
  exportFilename,
  loading = false,
  onRefresh,
  onRemove,
  children,
  headerExtra,
  className = ''
}) => {
  const { classes } = useTheme();

  const handleExport = () => {
    if (exportData && exportColumns) {
      const filename = generateFilename(exportFilename || 'data', symbol);
      exportToExcel(exportData, exportColumns, filename);
    }
  };

  return (
    <div className={`flex items-center justify-between p-3 border-b ${classes.widget.header} ${className}`}>
      {/* Left side - Icon, title, and selectors */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {Icon && <Icon size={18} className={iconColor} />}
        <div className="flex flex-col min-w-0">
          <h3 className="font-semibold text-white truncate">{title}</h3>
          {subtitle && (
            <span className="text-xs text-gray-500 truncate">{subtitle}</span>
          )}
        </div>

        {/* Symbol Selector */}
        {showSymbolSelector && symbol && onSymbolChange && (
          <SymbolSelector
            symbol={symbol}
            onSymbolChange={onSymbolChange}
            size="sm"
          />
        )}

        {/* Series Selector */}
        {series && series.length > 0 && onSeriesToggle && (
          <SeriesSelector
            series={series}
            onSeriesToggle={onSeriesToggle}
            size="sm"
          />
        )}

        {/* Extra header content */}
        {headerExtra}
      </div>

      {/* Right side - Action buttons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Custom action buttons */}
        {children}

        {/* Export button */}
        {exportData && exportColumns && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              handleExport();
            }}
            className={`p-1.5 transition-colors ${classes.button.ghost}`}
            title="Export to Excel"
          >
            <Download size={16} />
          </button>
        )}

        {/* Refresh button */}
        {onRefresh && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRefresh();
            }}
            className={`p-1.5 transition-colors ${classes.button.ghost}`}
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
            className={`hover:text-red-400 p-1.5 transition-colors ${classes.button.ghost}`}
            title="Remove"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default UtilWidgetHeader;
