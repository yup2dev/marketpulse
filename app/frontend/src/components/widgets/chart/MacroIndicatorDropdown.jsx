import DropdownShell from './DropdownShell';
import { MACRO_INDICATORS } from '../constants';

const MacroIndicatorDropdown = ({ show, onClose, tokens, tickers, onAdd }) => {
  if (!show) return null;

  return (
    <DropdownShell title="Macro Indicators" onClose={onClose} tokens={tokens} className="min-w-[300px]">
      <div className="py-1">
        {MACRO_INDICATORS.map((indicator) => (
          <button
            key={indicator.id}
            onClick={() => onAdd(indicator)}
            className="w-full px-3 py-2 hover:bg-gray-800 transition-colors text-left"
            disabled={tickers.some(t => t.symbol === indicator.id)}
          >
            <div className="text-sm font-medium text-white">{indicator.name}</div>
            <div className="text-xs text-gray-400">{indicator.description}</div>
          </button>
        ))}
      </div>
    </DropdownShell>
  );
};

export default MacroIndicatorDropdown;
