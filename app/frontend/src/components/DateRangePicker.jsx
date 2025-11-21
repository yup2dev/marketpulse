import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import {
  startOfQuarter,
  endOfQuarter,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subQuarters,
  subMonths,
  subYears,
  format
} from 'date-fns';

const DateRangePicker = ({ onDateChange, className = '' }) => {
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [quickSelect, setQuickSelect] = useState('1M');
  const [showDropdown, setShowDropdown] = useState(false);

  const quickOptions = [
    { label: '1M', value: '1M', type: 'month', count: 1 },
    { label: '3M', value: '3M', type: 'month', count: 3 },
    { label: '6M', value: '6M', type: 'month', count: 6 },
    { label: '1Y', value: '1Y', type: 'year', count: 1 },
    { label: 'Q1', value: 'Q1', type: 'quarter', quarter: 1 },
    { label: 'Q2', value: 'Q2', type: 'quarter', quarter: 2 },
    { label: 'Q3', value: 'Q3', type: 'quarter', quarter: 3 },
    { label: 'Q4', value: 'Q4', type: 'quarter', quarter: 4 },
    { label: 'YTD', value: 'YTD', type: 'ytd' },
  ];

  const handleQuickSelect = (option) => {
    const now = new Date();
    let start, end;

    switch (option.type) {
      case 'month':
        end = endOfMonth(now);
        start = startOfMonth(subMonths(now, option.count - 1));
        break;
      case 'year':
        end = endOfYear(now);
        start = startOfYear(subYears(now, option.count - 1));
        break;
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), (option.quarter - 1) * 3, 1);
        start = startOfQuarter(quarterStart);
        end = endOfQuarter(quarterStart);
        break;
      case 'ytd':
        start = startOfYear(now);
        end = now;
        break;
      default:
        return;
    }

    const range = { start, end };
    setDateRange(range);
    setQuickSelect(option.value);
    setShowDropdown(false);
    onDateChange?.(range);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2">
        {/* Quick Select Buttons */}
        <div className="flex gap-1">
          {['1M', '3M', '6M', '1Y'].map((value) => {
            const option = quickOptions.find(opt => opt.value === value);
            return (
              <button
                key={value}
                onClick={() => handleQuickSelect(option)}
                className={`px-3 py-1.5 text-xs rounded transition-colors ${
                  quickSelect === value
                    ? 'bg-primary text-background-primary font-medium'
                    : 'bg-background-tertiary text-text-secondary hover:bg-background-tertiary/80'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {/* Dropdown for Quarters and YTD */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-background-tertiary text-text-secondary rounded hover:bg-background-tertiary/80 transition-colors"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>기간</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {showDropdown && (
            <div className="absolute top-full mt-1 right-0 bg-background-secondary border border-gray-700 rounded-lg shadow-xl z-50 min-w-[120px]">
              <div className="py-1">
                <div className="px-3 py-1.5 text-xs text-text-tertiary font-medium">분기별</div>
                {quickOptions.filter(opt => opt.type === 'quarter').map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleQuickSelect(option)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-background-tertiary transition-colors ${
                      quickSelect === option.value ? 'text-primary font-medium' : 'text-text-secondary'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
                <div className="border-t border-gray-700 my-1"></div>
                {quickOptions.filter(opt => opt.type === 'ytd').map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleQuickSelect(option)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-background-tertiary transition-colors ${
                      quickSelect === option.value ? 'text-primary font-medium' : 'text-text-secondary'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Date Display */}
        {dateRange.start && dateRange.end && (
          <div className="text-xs text-text-secondary ml-2">
            {format(dateRange.start, 'yyyy-MM-dd')} ~ {format(dateRange.end, 'yyyy-MM-dd')}
          </div>
        )}
      </div>
    </div>
  );
};

export default DateRangePicker;
