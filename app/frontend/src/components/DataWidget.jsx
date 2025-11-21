import { useState, useEffect } from 'react';
import { Table, BarChart3, RefreshCw, Settings, X, Maximize2 } from 'lucide-react';
import DateRangePicker from './DateRangePicker';
import DataTable from './DataTable';
import DataChart from './DataChart';

const DataWidget = ({
  id,
  title,
  data = [],
  columns = [],
  chartConfig = {},
  onDateChange,
  onRefresh,
  onClose,
  enableDatePicker = true,
  enableViewToggle = true,
  defaultView = 'chart',
  className = '',
}) => {
  const [view, setView] = useState(defaultView);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  return (
    <div className={`flex flex-col h-full bg-background-secondary rounded-lg border border-gray-800 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-background-tertiary border-b border-gray-800">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <h3 className="text-sm font-medium text-text-primary truncate draggable-handle cursor-move">
            {title}
          </h3>

          {/* View Toggle */}
          {enableViewToggle && (
            <div className="flex items-center gap-1 bg-background-secondary rounded p-0.5">
              <button
                onClick={() => setView('table')}
                className={`p-1.5 rounded transition-colors ${
                  view === 'table'
                    ? 'bg-primary text-background-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
                title="Table View"
              >
                <Table className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setView('chart')}
                className={`p-1.5 rounded transition-colors ${
                  view === 'chart'
                    ? 'bg-primary text-background-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
                title="Chart View"
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Date Range Picker */}
          {enableDatePicker && (
            <DateRangePicker onDateChange={onDateChange} />
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-background-secondary rounded transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-background-secondary rounded transition-colors"
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-background-secondary rounded transition-colors"
            title="Maximize"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-text-secondary hover:text-negative hover:bg-background-secondary rounded transition-colors"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">
        {view === 'table' ? (
          <DataTable data={data} columns={columns} />
        ) : (
          <div className="h-full min-h-[300px]">
            <DataChart
              data={data}
              chartType={chartConfig.type || 'line'}
              xKey={chartConfig.xKey}
              yKeys={chartConfig.yKeys || []}
              colors={chartConfig.colors}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DataWidget;
