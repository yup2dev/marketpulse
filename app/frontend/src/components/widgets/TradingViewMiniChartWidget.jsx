/**
 * TradingViewMiniChartWidget — 단일 종목 미니 차트 (TradingView mini-symbol-overview 임베드).
 *
 * BaseWidget 내장 SymbolSelector로 종목을 바꾸고, headerExtra의 range 칩으로 기간을 바꾼다.
 * TradingViewEmbed는 1회 주입 가드가 있으므로 symbol/range/theme가 바뀌면 key로 리마운트해
 * 새 컨테이너에 새 임베드를 올린다. 데이터는 전부 TradingView가 처리 → 서버/키/Fetcher 불필요.
 *
 * 심볼은 'AAPL'처럼 티커만 넣으면 TradingView가 거래소를 자동 해석하고,
 * 'KRX:005930'처럼 거래소 접두사도 그대로 통과한다.
 */
import { useState } from 'react';
import { CandlestickChart } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import TradingViewEmbed from './common/TradingViewEmbed';
import useThemeStore from '../../store/themeStore';

const SCRIPT_SRC =
  'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';

// TradingView mini widget이 지원하는 dateRange 값
const RANGE_OPTIONS = [
  { id: '1D',  label: '1D' },
  { id: '1M',  label: '1M' },
  { id: '3M',  label: '3M' },
  { id: '12M', label: '1Y' },
  { id: '60M', label: '5Y' },
  { id: 'ALL', label: 'All' },
];

export default function TradingViewMiniChartWidget({ symbol: seedSymbol, onRemove }) {
  const [symbol, setSymbol]       = useState(seedSymbol || 'AAPL');
  const [dateRange, setDateRange] = useState('1M');
  const theme = useThemeStore(state => state.theme);

  const config = {
    symbol,
    dateRange,
    colorTheme: theme === 'light' ? 'light' : 'dark',
    locale: 'kr',
    isTransparent: true,
    autosize: true,
    width: '100%',
    height: '100%',
  };

  return (
    <BaseWidget
      title="Mini Chart (TV)"
      icon={CandlestickChart}
      onRemove={onRemove}
      symbol={symbol}
      onSymbolChange={setSymbol}
      showViewToggle={false}
      showPeriodSelector={false}
      syncable
      headerExtra={
        <div className="flex items-center gap-0.5">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setDateRange(opt.id)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                dateRange === opt.id
                  ? 'bg-cyan-900/30 text-cyan-400'
                  : 'text-gray-500 hover:text-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      }
    >
      <div style={{ height: '100%', width: '100%' }}>
        <TradingViewEmbed
          key={`${symbol}-${dateRange}-${theme}`}
          scriptSrc={SCRIPT_SRC}
          config={config}
        />
      </div>
    </BaseWidget>
  );
}
