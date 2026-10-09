import { TrendingUp, Activity, BarChart2, Layers } from 'lucide-react';
import DropdownShell from './DropdownShell';
import { CHART_TYPES } from '../constants';

// 차트 타입별 아이콘 — candlestick/ohlc 는 같은 아이콘을 쓴다.
const TYPE_ICONS = {
  line: TrendingUp,
  area: Activity,
  candlestick: BarChart2,
  ohlc: BarChart2,
  heikinashi: Layers,
};

const ChartTypeDropdown = ({ show, onClose, tokens, chartType, setChartType }) => {
  if (!show) return null;

  return (
    <DropdownShell title="Chart Type" onClose={onClose} tokens={tokens} className="min-w-[200px]">
      <div className="py-1">
        {CHART_TYPES.map((type) => {
          const Icon = TYPE_ICONS[type.id];
          const selected = chartType === type.id;
          return (
            <button
              key={type.id}
              onClick={() => {
                setChartType(type.id);
                onClose();
              }}
              className={`w-full px-3 py-2 hover:bg-gray-800 transition-colors text-left flex items-center gap-3 ${
                selected ? 'bg-blue-600/20 border-l-2 border-blue-500' : ''
              }`}
            >
              <div className={`w-8 h-8 rounded flex items-center justify-center ${
                selected ? 'bg-blue-600' : 'bg-gray-700'
              }`}>
                {Icon && <Icon size={16} />}
              </div>
              <div>
                <div className="text-sm font-medium text-white">{type.name}</div>
                <div className="text-xs text-gray-400">{type.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </DropdownShell>
  );
};

export default ChartTypeDropdown;
