/**
 * TradingWidgetShell — lightweight wrapper used by CVD, Depth, Trades, Liquidations widgets.
 * Adds drag handle, title bar, remove button, and crypto-only guard.
 */
import { GripVertical, X } from 'lucide-react';

export default function TradingWidgetShell({
  title,
  subtitle,
  assetType,
  connected,
  onRemove,
  children,
  footer,
}) {
  const isCryptoOnly = assetType != null && assetType !== 'crypto';

  return (
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 shrink-0">
        <div className="drag-handle-area cursor-move flex items-center gap-2 flex-1 min-w-0">
          <GripVertical size={14} className="text-gray-600 flex-shrink-0" />
          <span className="text-xs font-semibold text-gray-300 truncate">{title}</span>
          {subtitle && <span className="text-[10px] text-gray-600 truncate">{subtitle}</span>}
          {connected !== undefined && !isCryptoOnly && (
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              connected ? 'bg-green-400 animate-pulse' : 'bg-gray-700'
            }`} />
          )}
        </div>

        {onRemove && (
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onRemove(); }}
            className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors flex-shrink-0"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {isCryptoOnly ? (
          <div className="flex flex-col items-center justify-center h-full gap-1.5 text-gray-700">
            <span className="text-sm">Crypto only</span>
            <span className="text-[10px] text-gray-800">Switch to Crypto mode to view</span>
          </div>
        ) : children}
      </div>

      {footer && (
        <div className="px-3 py-1 border-t border-gray-800 shrink-0">
          <span className="text-[10px] text-gray-700">{footer}</span>
        </div>
      )}
    </div>
  );
}
