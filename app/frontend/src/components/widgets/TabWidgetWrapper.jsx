/**
 * TabWidgetWrapper - Wraps tab components to work as widgets with close button
 */
import { X, GripVertical } from 'lucide-react';

export default function TabWidgetWrapper({ children, title, onRemove }) {
  return (
    <div className="bg-[#0d0d12] rounded-lg overflow-hidden flex flex-col h-full border border-gray-800">
      {/* Header with drag handle and close button */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-[#0d0d12]">
        <div className="flex items-center gap-2 cursor-move drag-handle-area flex-1">
          <GripVertical size={14} className="text-gray-600" />
          {title && <span className="text-sm font-medium text-white">{title}</span>}
        </div>
        {onRemove && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
            title="Remove"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {/* Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
