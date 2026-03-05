/**
 * Re-exports WidgetHeader from the canonical location (widgets/common/WidgetHeader).
 * Also provides layout utilities used by the alerts section:
 *   ResizeHandle, ResizableWidget, AddWidgetPlaceholder, WidgetContainer
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import WidgetHeaderImpl, { WidgetHeader as WH } from '../widgets/common/WidgetHeader';

// ── Canonical WidgetHeader (re-exported) ──────────────────────────────────────
export { WH as WidgetHeader };
export default WidgetHeaderImpl;

// ── ResizeHandle ──────────────────────────────────────────────────────────────
export function ResizeHandle({ onResize }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e) => { if (onResize) onResize(e.movementX, e.movementY); };
    const onUp   = () => setIsDragging(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    };
  }, [isDragging, onResize]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10 group ${isDragging ? 'opacity-100' : ''}`}
    >
      <svg className="w-full h-full text-gray-600 group-hover:text-gray-400 transition-colors" viewBox="0 0 16 16">
        <path d="M14 10L10 14M14 6L6 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
}

// ── AddWidgetPlaceholder ──────────────────────────────────────────────────────
export function AddWidgetPlaceholder({ onAdd, widgetType, label = 'Add Widget' }) {
  return (
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 border-dashed h-full min-h-[200px] flex flex-col items-center justify-center">
      <button
        onClick={() => onAdd?.(widgetType)}
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

// ── ResizableWidget ───────────────────────────────────────────────────────────
export function ResizableWidget({
  children, title, icon, iconColor, symbol, onSymbolChange,
  onRefresh, onClose, loading, subtitle,
  minWidth = 200, minHeight = 150, initialWidth, initialHeight,
  onSizeChange, className = '',
}) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: initialWidth || 'auto', height: initialHeight || 'auto' });

  const handleResize = useCallback((deltaX, deltaY) => {
    setSize(prev => {
      const w = prev.width  === 'auto' ? (containerRef.current?.offsetWidth  || minWidth)  + deltaX : Math.max(minWidth,  prev.width  + deltaX);
      const h = prev.height === 'auto' ? (containerRef.current?.offsetHeight || minHeight) + deltaY : Math.max(minHeight, prev.height + deltaY);
      const ns = { width: w, height: h };
      onSizeChange?.(ns);
      return ns;
    });
  }, [minWidth, minHeight, onSizeChange]);

  const style = {
    width:     size.width  === 'auto' ? '100%' : `${size.width}px`,
    height:    size.height === 'auto' ? 'auto'  : `${size.height}px`,
    minWidth:  `${minWidth}px`,
    minHeight: `${minHeight}px`,
  };

  return (
    <div ref={containerRef} className={`bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden flex flex-col relative ${className}`} style={style}>
      <WH title={title} icon={icon} iconColor={iconColor} symbol={symbol} onSymbolChange={onSymbolChange} onRefresh={onRefresh} onClose={onClose} loading={loading} subtitle={subtitle} />
      <div className="flex-1 overflow-auto p-4">{children}</div>
      <ResizeHandle onResize={handleResize} />
    </div>
  );
}

// ── WidgetContainer ───────────────────────────────────────────────────────────
export function WidgetContainer({ children, className = '', ...headerProps }) {
  return (
    <div className={`bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden h-full flex flex-col ${className}`}>
      <WH {...headerProps} />
      <div className="flex-1 overflow-auto p-4">{children}</div>
    </div>
  );
}
