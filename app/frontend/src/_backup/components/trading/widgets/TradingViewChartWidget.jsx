/**
 * TradingViewChartWidget
 * Embeds the free TradingView Advanced Chart widget.
 * Works for both crypto (BINANCE:BTCUSDT) and stocks (AAPL, MSFT, …).
 */
import { useEffect, useRef, useState } from 'react';
import { GripVertical, X } from 'lucide-react';

const INTERVALS = [
  { label: '1m',  value: '1'   },
  { label: '5m',  value: '5'   },
  { label: '15m', value: '15'  },
  { label: '1H',  value: '60'  },
  { label: '4H',  value: '240' },
  { label: '1D',  value: 'D'   },
  { label: '1W',  value: 'W'   },
];

// Load tv.js once globally
let _tvLoaded   = false;
let _tvLoading  = false;
const _tvCbs    = [];

function loadTVScript(cb) {
  if (_tvLoaded)   { cb(); return; }
  _tvCbs.push(cb);
  if (_tvLoading)  return;
  _tvLoading = true;
  const s = document.createElement('script');
  s.id    = 'tv-script';
  s.src   = 'https://s3.tradingview.com/tv.js';
  s.async = true;
  s.onload = () => {
    _tvLoaded  = true;
    _tvLoading = false;
    _tvCbs.forEach(fn => fn());
    _tvCbs.length = 0;
  };
  document.head.appendChild(s);
}

// Inner chart — re-mounts (via key) when symbol or interval changes
function TVChartInner({ tvSymbol, interval }) {
  const idRef  = useRef(`tv_${Math.random().toString(36).slice(2, 9)}`);
  const divRef = useRef(null);

  useEffect(() => {
    const create = () => {
      if (!window.TradingView || !divRef.current) return;
      // Clear any leftover iframe from previous mount
      divRef.current.innerHTML = '';
      new window.TradingView.widget({
        autosize:            true,
        symbol:              tvSymbol,
        interval,
        timezone:            'Etc/UTC',
        theme:               'dark',
        style:               '1',
        locale:              'en',
        toolbar_bg:          '#0a0a0f',
        enable_publishing:   false,
        allow_symbol_change: false,
        hide_side_toolbar:   false,
        save_image:          false,
        container_id:        idRef.current,
      });
    };
    loadTVScript(create);
  }, []); // empty — parent re-mounts via key on symbol/interval change

  return <div ref={divRef} id={idRef.current} className="w-full h-full" />;
}

export default function TradingViewChartWidget({ symbol, assetType, onRemove }) {
  const [interval, setIntervalVal] = useState('1');
  const tvSymbol = assetType === 'crypto' ? `BINANCE:${symbol}` : symbol;

  return (
    <div className="bg-[#0d0d12] rounded-lg border border-gray-800 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 shrink-0">
        <GripVertical size={14} className="text-gray-600 flex-shrink-0 cursor-move drag-handle-area" />
        <div className="drag-handle-area cursor-move flex-1 flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-white truncate">{symbol}</span>
          <span className="text-[10px] text-gray-600">
            {assetType === 'crypto' ? 'Binance Futures' : 'TradingView'}
          </span>
        </div>

        {/* Interval chips */}
        <div className="flex items-center gap-0.5" onMouseDown={e => e.stopPropagation()}>
          {INTERVALS.map(iv => (
            <button
              key={iv.value}
              onClick={() => setIntervalVal(iv.value)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                interval === iv.value
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {iv.label}
            </button>
          ))}
        </div>

        {onRemove && (
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onRemove(); }}
            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors flex-shrink-0"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Chart — key forces full re-mount on symbol or interval change */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <TVChartInner key={`${tvSymbol}_${interval}`} tvSymbol={tvSymbol} interval={interval} />
      </div>

      <div className="px-3 py-1 border-t border-gray-800 shrink-0">
        <span className="text-[10px] text-gray-700">Source: TradingView</span>
      </div>
    </div>
  );
}
