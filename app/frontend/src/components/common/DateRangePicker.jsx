import React from 'react';
import { Calendar } from 'lucide-react';
import { INPUT_CLASSES, BUTTON_CLASSES } from '../../styles/designTokens';

/**
 * DateRangePicker - Date range selection component with quick presets
 */
const DateRangePicker = ({
  startDate,
  endDate,
  onChange,
  presets = true,
  className = ''
}) => {
  const handlePreset = (years) => {
    const end = new Date();
    const start = new Date();
    start.setFullYear(start.getFullYear() - years);

    onChange(
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    );
  };

  const handleYTD = () => {
    const end = new Date();
    const start = new Date(end.getFullYear(), 0, 1);

    onChange(
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    );
  };

  const handleMax = () => {
    const end = new Date();
    const start = new Date('2000-01-01');

    onChange(
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    );
  };

  const presetButtons = [
    { label: '1Y', action: () => handlePreset(1) },
    { label: '3Y', action: () => handlePreset(3) },
    { label: '5Y', action: () => handlePreset(5) },
    { label: 'YTD', action: handleYTD },
    { label: 'Max', action: handleMax },
  ];

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">
            <Calendar className="inline mr-1" size={14} />
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onChange(e.target.value, endDate)}
            className={INPUT_CLASSES.default}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">
            <Calendar className="inline mr-1" size={14} />
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onChange(startDate, e.target.value)}
            className={INPUT_CLASSES.default}
          />
        </div>
      </div>

      {presets && (
        <div className="flex gap-2">
          {presetButtons.map(({ label, action }) => (
            <button
              key={label}
              onClick={action}
              className="px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded hover:bg-gray-700 hover:text-white transition-all"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
