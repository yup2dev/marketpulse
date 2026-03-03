/**
 * WidgetContainer — common shell wrapping every dashboard widget.
 *
 * Props:
 *   widgetDef   — entry from WIDGET_REGISTRY (id, name, icon, ...)
 *   config      — current widget config object
 *   onRemove    — () => void
 *   children    — the widget's actual content
 *   className   — extra CSS class for the outer div
 *   noPadding   — skip inner padding (e.g. for tables that manage their own)
 */
import { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { X, GripVertical, Maximize2 } from 'lucide-react';

function DynamicIcon({ name, size = 14, className }) {
  const Icon = LucideIcons[name];
  if (!Icon) return null;
  return <Icon size={size} className={className} />;
}

export default function WidgetContainer({
  widgetDef,
  config,
  onRemove,
  children,
  className = '',
  noPadding = false,
  title,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const displayTitle = title || widgetDef?.name || 'Widget';
  const iconName     = widgetDef?.icon;

  return (
    <div
      className={`flex flex-col h-full bg-[#0d0d12] border border-gray-800 rounded-lg overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-800/60 flex-shrink-0 drag-handle">
        {/* Drag handle */}
        <GripVertical size={12} className="text-gray-600 flex-shrink-0 cursor-grab" />

        {/* Icon + title */}
        {iconName && (
          <DynamicIcon name={iconName} size={13} className="text-gray-500 flex-shrink-0" />
        )}
        <span className="text-xs font-medium text-gray-300 truncate flex-1">{displayTitle}</span>

        {/* Actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => setIsCollapsed(c => !c)}
            className="p-0.5 rounded text-gray-600 hover:text-gray-300 transition-colors"
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            <Maximize2 size={11} />
          </button>
          {onRemove && (
            <button
              onClick={onRemove}
              className="p-0.5 rounded text-gray-600 hover:text-red-400 transition-colors"
              title="Remove widget"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className={`flex-1 overflow-auto min-h-0 ${noPadding ? '' : 'p-0'}`}>
          {children}
        </div>
      )}
    </div>
  );
}
