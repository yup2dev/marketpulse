/**
 * SeriesSelector - Toggle chart series visibility
 * Allows users to show/hide data series on charts
 */
import { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, ChevronDown, Layers } from 'lucide-react';

/**
 * @param {Object} props
 * @param {Array<{id: string, name: string, visible: boolean, color?: string}>} props.series - Available series
 * @param {Function} props.onSeriesToggle - Callback when series visibility changes (id, visible)
 * @param {string} props.size - Size variant: 'sm' | 'md' (default: 'sm')
 * @param {string} props.className - Additional CSS classes
 */
const SeriesSelector = ({
  series = [],
  onSeriesToggle,
  size = 'sm',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const visibleCount = series.filter(s => s.visible).length;

  // Size variants
  const sizeClasses = {
    sm: {
      button: 'text-[10px] px-1.5 py-0.5',
      icon: 10,
      dropdown: 'w-48',
      item: 'text-[10px]',
    },
    md: {
      button: 'text-xs px-2 py-1',
      icon: 12,
      dropdown: 'w-56',
      item: 'text-xs',
    },
  };

  const s = sizeClasses[size] || sizeClasses.sm;

  if (!series || series.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 bg-purple-900/30 text-purple-400 border border-purple-800/50 rounded hover:bg-purple-900/50 transition-colors ${s.button}`}
      >
        <Layers size={s.icon} />
        <span className="font-medium">{visibleCount}/{series.length}</span>
        <ChevronDown size={s.icon} />
      </button>

      {isOpen && (
        <div className={`absolute top-full right-0 mt-1 ${s.dropdown} bg-[#1a1a1f] border border-gray-700 rounded shadow-xl z-50`}>
          <div className="p-1.5 border-b border-gray-700">
            <span className={`text-gray-400 font-medium ${s.item}`}>Chart Series</span>
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {series.map((item) => (
              <button
                key={item.id}
                onClick={() => onSeriesToggle?.(item.id, !item.visible)}
                className="w-full px-2 py-1.5 text-left hover:bg-gray-800 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  {item.color && (
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                  )}
                  <span className={`text-white ${s.item}`}>{item.name}</span>
                </div>
                {item.visible ? (
                  <Eye size={s.icon + 2} className="text-green-500" />
                ) : (
                  <EyeOff size={s.icon + 2} className="text-gray-500" />
                )}
              </button>
            ))}
          </div>
          <div className="p-1.5 border-t border-gray-700 flex gap-1">
            <button
              onClick={() => series.forEach(s => onSeriesToggle?.(s.id, true))}
              className={`flex-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors ${s.item}`}
            >
              Show All
            </button>
            <button
              onClick={() => series.forEach(s => onSeriesToggle?.(s.id, false))}
              className={`flex-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors ${s.item}`}
            >
              Hide All
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeriesSelector;
