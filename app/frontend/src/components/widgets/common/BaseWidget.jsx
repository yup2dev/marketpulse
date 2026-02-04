/**
 * BaseWidget - Common widget wrapper with shared functionality
 * Features:
 * - Drag handle for GridLayout
 * - View mode toggle (chart/table)
 * - Period selector
 * - Refresh button
 * - Remove button
 * - Loading state
 * - Source footer
 */
import { useState } from 'react';
import { GripVertical, X, RefreshCw, BarChart2, Table, Calendar, ChevronDown } from 'lucide-react';

// Period options for different data types
export const PERIOD_OPTIONS = {
  short: [
    { id: '1mo', label: '1M' },
    { id: '3mo', label: '3M' },
    { id: '6mo', label: '6M' },
    { id: '1y', label: '1Y' },
  ],
  medium: [
    { id: '6mo', label: '6M' },
    { id: '1y', label: '1Y' },
    { id: '2y', label: '2Y' },
    { id: '3y', label: '3Y' },
  ],
  long: [
    { id: '1y', label: '1Y' },
    { id: '3y', label: '3Y' },
    { id: '5y', label: '5Y' },
    { id: '10y', label: '10Y' },
  ],
  macro: [
    { id: '1y', label: '1Y' },
    { id: '2y', label: '2Y' },
    { id: '3y', label: '3Y' },
    { id: '5y', label: '5Y' },
  ],
};

export default function BaseWidget({
  title,
  subtitle,
  icon: Icon,
  iconColor = 'text-cyan-400',
  children,
  loading = false,
  onRefresh,
  onRemove,
  // View mode
  viewMode = 'chart',
  onViewModeChange,
  showViewToggle = true,
  // Period selector
  period,
  onPeriodChange,
  periodType = 'macro', // 'short' | 'medium' | 'long' | 'macro'
  showPeriodSelector = true,
  // Source
  source,
  // Custom header content
  headerExtra,
}) {
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const periodOptions = PERIOD_OPTIONS[periodType] || PERIOD_OPTIONS.macro;

  return (
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-[#0d0d12] gap-2">
        {/* Left: Drag handle + Title */}
        <div className="flex items-center gap-2 cursor-move drag-handle-area flex-1 min-w-0">
          <GripVertical size={14} className="text-gray-600 flex-shrink-0" />
          {Icon && <Icon size={14} className={`${iconColor} flex-shrink-0`} />}
          <div className="min-w-0">
            <span className="text-sm font-medium text-white truncate block">{title}</span>
            {subtitle && <span className="text-xs text-gray-500 truncate block">{subtitle}</span>}
          </div>
        </div>

        {/* Center: Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* View Toggle */}
          {showViewToggle && onViewModeChange && (
            <div className="flex items-center bg-gray-800 rounded p-0.5">
              <button
                onClick={() => onViewModeChange('chart')}
                className={`p-1 rounded transition-colors ${
                  viewMode === 'chart' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
                title="Chart View"
              >
                <BarChart2 size={12} />
              </button>
              <button
                onClick={() => onViewModeChange('table')}
                className={`p-1 rounded transition-colors ${
                  viewMode === 'table' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
                title="Table View"
              >
                <Table size={12} />
              </button>
            </div>
          )}

          {/* Period Selector */}
          {showPeriodSelector && onPeriodChange && (
            <div className="relative">
              <button
                onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300 transition-colors"
              >
                <Calendar size={10} />
                <span>{periodOptions.find(p => p.id === period)?.label || period}</span>
                <ChevronDown size={10} />
              </button>
              {showPeriodDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowPeriodDropdown(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 bg-[#1a1a1f] border border-gray-700 rounded shadow-lg z-50 py-1 min-w-[60px]">
                    {periodOptions.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          onPeriodChange(opt.id);
                          setShowPeriodDropdown(false);
                        }}
                        className={`w-full px-3 py-1.5 text-xs text-left hover:bg-gray-800 transition-colors ${
                          period === opt.id ? 'text-cyan-400' : 'text-gray-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Custom header content */}
          {headerExtra}

          {/* Refresh */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
          )}

          {/* Remove */}
          {onRemove && (
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
              title="Remove"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          children
        )}
      </div>

      {/* Footer with source */}
      {source && (
        <div className="px-3 py-1.5 border-t border-gray-800 flex-shrink-0">
          <p className="text-[10px] text-gray-600">Source: {source}</p>
        </div>
      )}
    </div>
  );
}

