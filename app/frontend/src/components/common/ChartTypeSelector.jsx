/**
 * ChartTypeSelector — compact icon-button pill group for switching chart types.
 * Can be embedded in any widget header or used standalone.
 */
import { TrendingUp, Activity, BarChart2, Layers, PieChart, Circle } from 'lucide-react';

const ALL_TYPES = [
  { id: 'line',       label: 'Line',    Icon: TrendingUp },
  { id: 'area',       label: 'Area',    Icon: Activity   },
  { id: 'bar',        label: 'Bar',     Icon: BarChart2  },
  { id: 'stackedBar', label: 'Stacked', Icon: Layers     },
  { id: 'pie',        label: 'Pie',     Icon: PieChart   },
  { id: 'donut',      label: 'Donut',   Icon: Circle     },
];

/**
 * @param {string}   value     – currently active type id
 * @param {function} onChange  – called with new type id
 * @param {string[]} [types]   – allowed type ids (default: all 6)
 */
export default function ChartTypeSelector({ value, onChange, types }) {
  const options = types
    ? ALL_TYPES.filter(t => types.includes(t.id))
    : ALL_TYPES;

  return (
    <div className="flex items-center gap-0.5 bg-gray-800/60 rounded p-0.5">
      {options.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          title={label}
          className={`p-1 rounded transition-colors ${
            value === id
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
          }`}
        >
          <Icon size={12} />
        </button>
      ))}
    </div>
  );
}
