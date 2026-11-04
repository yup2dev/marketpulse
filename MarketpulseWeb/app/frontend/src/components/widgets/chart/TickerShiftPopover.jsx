import { Settings, X, ArrowRightLeft } from 'lucide-react';
import { CHART_COLORS } from '../constants';
import { SHIFT_UNITS } from './chartHelpers';

/**
 * 티커 칩의 설정 팝오버 — 시리즈 색상과 시간 시프트(선행/후행).
 *
 * ChartWidget.jsx 의 티커 칩 안에 인라인으로 110줄 들어 있던 것을 분리했다.
 * 칩 자체의 관심사(표시·토글·제거)와 설정 편집이 한 덩어리로 엉켜 있었다.
 */
const TickerShiftPopover = ({ open, ticker, tokens, onClose, updateTickerColor, updateTickerShift }) => {
  if (!open) return null;

  const shiftUnit = ticker.shift?.unit || 'M';

  return (
    <div
      className="absolute top-full left-0 mt-2 z-50 border border-gray-700 rounded-lg shadow-2xl p-3 w-64"
      style={{ backgroundColor: tokens.bg.tertiary }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-white flex items-center gap-1.5">
          <Settings size={12} className="text-amber-400" />
          {ticker.name || ticker.symbol}
        </span>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X size={12} />
        </button>
      </div>

      {/* Color picker */}
      <div className="text-[11px] text-gray-400 mb-1.5">Color</div>
      <div className="flex items-center gap-1.5 mb-3">
        {CHART_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => updateTickerColor(ticker.symbol, color)}
            className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${
              ticker.color === color ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900' : ''
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
        <label
          className="w-5 h-5 rounded-full cursor-pointer border border-dashed border-gray-500 hover:border-white flex items-center justify-center overflow-hidden relative"
          title="Custom color"
        >
          {/* 팔레트 밖 색을 쓰는 중이면 그 색을, 아니면 무지개로 '직접 고르기'를 나타낸다 */}
          <span
            className="absolute inset-0.5 rounded-full"
            style={{
              background: CHART_COLORS.includes(ticker.color)
                ? 'conic-gradient(#ef4444, #f59e0b, #10b981, #06b6d4, #8b5cf6, #ec4899, #ef4444)'
                : ticker.color,
            }}
          />
          <input
            type="color"
            value={ticker.color || '#3b82f6'}
            onChange={(e) => updateTickerColor(ticker.symbol, e.target.value)}
            className="opacity-0 absolute inset-0 cursor-pointer"
          />
        </label>
      </div>

      {/* Time shift */}
      <div className="text-[11px] text-gray-400 mb-1.5 flex items-center gap-1">
        <ArrowRightLeft size={10} />
        Time Shift (Lead/Lag)
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={ticker.shift?.value ?? 0}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            updateTickerShift(ticker.symbol, { value: isNaN(v) ? 0 : v, unit: shiftUnit });
          }}
          className="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-amber-500"
        />
        <div className="flex items-center bg-gray-800 rounded overflow-hidden">
          {SHIFT_UNITS.map((u) => (
            <button
              key={u.id}
              onClick={() => updateTickerShift(ticker.symbol, { value: ticker.shift?.value || 0, unit: u.id })}
              className={`px-2 py-1 text-xs font-medium transition-colors ${
                shiftUnit === u.id ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
              title={u.label}
            >
              {u.id}
            </button>
          ))}
        </div>
        {ticker.shift?.value ? (
          <button
            onClick={() => updateTickerShift(ticker.symbol, null)}
            className="ml-auto text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
          >
            Reset
          </button>
        ) : null}
      </div>
      <div className="text-[11px] text-gray-500 mt-2 leading-relaxed">
        +N = 선행(Lead): 이 시리즈를 오른쪽으로 N만큼 이동시켜 다른 종목과 겹쳐 봅니다.
        −N = 후행(Lag). 예: SIL에 +4M → 반도체보다 4개월 선행 비교.
      </div>
    </div>
  );
};

export default TickerShiftPopover;
