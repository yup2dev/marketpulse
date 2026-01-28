/**
 * Company Calendar Tab - Compact grid layout with multiple widgets
 */
import { useState } from 'react';
import EarningsHistoryWidget from '../widgets/EarningsHistoryWidget';
import StockSplitsWidget from '../widgets/StockSplitsWidget';
import DividendWidget from '../widgets/DividendWidget';
import CompanyFilingsWidget from '../widgets/CompanyFilingsWidget';

const CompanyCalendarTab = ({ symbol = 'AAPL' }) => {
  const [currentSymbol] = useState(symbol);

  return (
    <div className="h-full">
      {/* Grid Layout - 2x2 with adjustable sizes */}
      <div className="grid grid-cols-12 gap-1 h-[calc(100vh-180px)]">
        {/* Top Left - Earnings History (larger) */}
        <div className="col-span-7 row-span-1 min-h-[280px]">
          <EarningsHistoryWidget symbol={currentSymbol} />
        </div>

        {/* Top Right - Stock Splits */}
        <div className="col-span-5 row-span-1 min-h-[280px]">
          <StockSplitsWidget symbol={currentSymbol} />
        </div>

        {/* Bottom Left - Dividend Payment */}
        <div className="col-span-7 row-span-1 min-h-[280px]">
          <DividendWidget symbol={currentSymbol} />
        </div>

        {/* Bottom Right - Company Filings */}
        <div className="col-span-5 row-span-1 min-h-[280px]">
          <CompanyFilingsWidget symbol={currentSymbol} />
        </div>
      </div>
    </div>
  );
};

export default CompanyCalendarTab;
