/**
 * UtilWidget - Base widget wrapper with consistent styling
 * Provides dark theme container, header with controls, and state handling
 */
import useTheme from '../../../hooks/useTheme';
import UtilWidgetHeader from './UtilWidgetHeader';
import LoadingSpinner from './LoadingSpinner';
import { NoDataState, ErrorState } from './EmptyState';

/**
 * @param {Object} props
 * @param {string} props.title - Widget title
 * @param {string} props.subtitle - Optional subtitle
 * @param {React.ComponentType} props.icon - Lucide icon component
 * @param {string} props.iconColor - Icon color class (default: 'text-blue-400')
 * @param {string} props.symbol - Current symbol for selector
 * @param {Function} props.onSymbolChange - Callback when symbol changes
 * @param {boolean} props.showSymbolSelector - Show symbol selector (default: false)
 * @param {Array<{id: string, name: string, visible: boolean, color?: string}>} props.series - Series for selector
 * @param {Function} props.onSeriesToggle - Callback when series toggles (seriesId, visible)
 * @param {Array<Object>} props.exportData - Data array for export
 * @param {Array<{key: string, header: string, formatter?: Function}>} props.exportColumns - Column definitions
 * @param {string} props.exportFilename - Filename prefix for export
 * @param {boolean} props.loading - Loading state
 * @param {string} props.error - Error message
 * @param {boolean} props.isEmpty - Empty state flag
 * @param {string} props.emptyMessage - Custom empty state message
 * @param {Function} props.onRefresh - Refresh callback
 * @param {Function} props.onRemove - Remove callback
 * @param {React.ReactNode} props.children - Widget content
 * @param {boolean} props.noPadding - Remove content padding (default: false)
 * @param {React.ReactNode} props.headerExtra - Extra content in header
 * @param {React.ReactNode} props.headerActions - Custom header action buttons
 * @param {string} props.className - Additional container classes
 * @param {string} props.contentClassName - Additional content classes
 */
const UtilWidget = ({
  title,
  subtitle,
  icon,
  iconColor = 'text-blue-400',
  symbol,
  onSymbolChange,
  showSymbolSelector = false,
  series,
  onSeriesToggle,
  exportData,
  exportColumns,
  exportFilename,
  loading = false,
  error,
  isEmpty = false,
  emptyMessage = 'No data available',
  onRefresh,
  onRemove,
  children,
  noPadding = false,
  headerExtra,
  headerActions,
  className = '',
  contentClassName = ''
}) => {
  const { classes } = useTheme();

  // Render content based on state
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full min-h-[200px]">
          <LoadingSpinner />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-full min-h-[200px]">
          <ErrorState message={error} onRetry={onRefresh} />
        </div>
      );
    }

    if (isEmpty) {
      return (
        <div className="flex items-center justify-center h-full min-h-[200px]">
          <NoDataState message={emptyMessage} />
        </div>
      );
    }

    return children;
  };

  return (
    <div className={`h-full ${classes.widget.container} rounded-lg border flex flex-col overflow-hidden ${className}`}>
      <UtilWidgetHeader
        icon={icon}
        iconColor={iconColor}
        title={title}
        subtitle={subtitle}
        symbol={symbol}
        onSymbolChange={onSymbolChange}
        showSymbolSelector={showSymbolSelector}
        series={series}
        onSeriesToggle={onSeriesToggle}
        exportData={exportData}
        exportColumns={exportColumns}
        exportFilename={exportFilename}
        loading={loading}
        onRefresh={onRefresh}
        onRemove={onRemove}
        headerExtra={headerExtra}
      >
        {headerActions}
      </UtilWidgetHeader>

      <div className={`flex-1 overflow-auto ${noPadding ? '' : 'p-4'} ${contentClassName}`}>
        {renderContent()}
      </div>
    </div>
  );
};

export default UtilWidget;
