/**
 * Standard Widget Header Component
 * All widgets must include: Close, Refresh, Symbol Selector, Resize Handle
 * Empty spaces show Add Widget button
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { RefreshCw, X, ChevronDown, Plus } from 'lucide-react';

/**
 * WidgetHeader - Standard header for all widgets
 */
export function WidgetHeader({
  title,
  icon: Icon,
  iconColor = 'text-blue-400',
  symbol,
  onSymbolChange,
  onRefresh,
  onClose,
  loading,
  subtitle
}) {
  const [showSymbolInput, setShowSymbolInput] = useState(false);
  const [inputValue, setInputValue] = useState(symbol || '');

  const handleSymbolSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim() && onSymbolChange) {
      onSymbolChange(inputValue.trim().toUpperCase());
    }
    setShowSymbolInput(false);
  };

  return (
    <div className="p-3 border-b border-gray-800 shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={16} className={iconColor} />}
          <div>
            <span className="text-sm font-medium text-white">{title}</span>
            {subtitle && <span className="text-xs text-gray-500 ml-2">{subtitle}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Symbol Selector */}
          {onSymbolChange && (
            showSymbolInput ? (
              <form onSubmit={handleSymbolSubmit} className="flex items-center">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value.toUpperCase())}
                  className="w-20 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:outline-none focus:border-blue-500"
                  placeholder="Symbol"
                  autoFocus
                  onBlur={() => setShowSymbolInput(false)}
                />
              </form>
            ) : (
              <button
                onClick={() => setShowSymbolInput(true)}
                className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300"
                title="Change Symbol"
              >
                {symbol || 'Select'}
                <ChevronDown size={12} />
              </button>
            )
          )}

          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          )}

          {/* Close Button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400 transition-colors"
              title="Close"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * ResizeHandle - Corner drag handle for resizing widgets
 */
export function ResizeHandle({ onResize }) {
  const handleRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      if (onResize) {
        onResize(e.movementX, e.movementY);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onResize]);

  return (
    <div
      ref={handleRef}
      onMouseDown={handleMouseDown}
      className={`absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10 group ${isDragging ? 'opacity-100' : ''}`}
    >
      {/* Resize corner lines */}
      <svg
        className="w-full h-full text-gray-600 group-hover:text-gray-400 transition-colors"
        viewBox="0 0 16 16"
      >
        <path
          d="M14 10L10 14M14 6L6 14M14 14L14 14"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

/**
 * ResizableWidget - Widget container with resize functionality
 */
export function ResizableWidget({
  children,
  title,
  icon,
  iconColor,
  symbol,
  onSymbolChange,
  onRefresh,
  onClose,
  loading,
  subtitle,
  minWidth = 200,
  minHeight = 150,
  initialWidth,
  initialHeight,
  onSizeChange,
  className = ''
}) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({
    width: initialWidth || 'auto',
    height: initialHeight || 'auto'
  });

  const handleResize = useCallback((deltaX, deltaY) => {
    setSize(prev => {
      const newWidth = prev.width === 'auto'
        ? (containerRef.current?.offsetWidth || minWidth) + deltaX
        : Math.max(minWidth, prev.width + deltaX);
      const newHeight = prev.height === 'auto'
        ? (containerRef.current?.offsetHeight || minHeight) + deltaY
        : Math.max(minHeight, prev.height + deltaY);

      const newSize = { width: newWidth, height: newHeight };
      if (onSizeChange) {
        onSizeChange(newSize);
      }
      return newSize;
    });
  }, [minWidth, minHeight, onSizeChange]);

  const style = {
    width: size.width === 'auto' ? '100%' : `${size.width}px`,
    height: size.height === 'auto' ? 'auto' : `${size.height}px`,
    minWidth: `${minWidth}px`,
    minHeight: `${minHeight}px`,
  };

  return (
    <div
      ref={containerRef}
      className={`bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden flex flex-col relative ${className}`}
      style={style}
    >
      <WidgetHeader
        title={title}
        icon={icon}
        iconColor={iconColor}
        symbol={symbol}
        onSymbolChange={onSymbolChange}
        onRefresh={onRefresh}
        onClose={onClose}
        loading={loading}
        subtitle={subtitle}
      />
      <div className="flex-1 overflow-auto p-4">
        {children}
      </div>
      <ResizeHandle onResize={handleResize} />
    </div>
  );
}

/**
 * AddWidgetPlaceholder - Placeholder shown when widget is closed
 */
export function AddWidgetPlaceholder({ onAdd, widgetType, label = 'Add Widget' }) {
  return (
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 border-dashed h-full min-h-[200px] flex flex-col items-center justify-center">
      <button
        onClick={() => onAdd && onAdd(widgetType)}
        className="flex flex-col items-center gap-2 p-4 hover:bg-gray-800/50 rounded-lg transition-colors"
      >
        <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
          <Plus size={20} className="text-gray-500" />
        </div>
        <span className="text-gray-500 text-sm">{label}</span>
      </button>
    </div>
  );
}

/**
 * WidgetContainer - Standard widget container with header (without resize)
 */
export function WidgetContainer({ children, className = '', ...headerProps }) {
  return (
    <div className={`bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden h-full flex flex-col ${className}`}>
      <WidgetHeader {...headerProps} />
      <div className="flex-1 overflow-auto p-4">
        {children}
      </div>
    </div>
  );
}

export default WidgetHeader;
