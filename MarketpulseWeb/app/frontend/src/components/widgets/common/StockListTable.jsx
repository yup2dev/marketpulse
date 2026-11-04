/**
 * StockListTable — Toss Securities-inspired stock list display.
 *
 * Reusable across: Watchlist items, Screener results, any stock list context.
 * Renders a clean list with ticker name, sector badge, price, change, market cap.
 *
 * Props:
 *   items       — array of stock objects
 *   columns     — which data columns to show (defaults: name, price, change, marketCap)
 *   onTickerClick — callback(ticker_cd)  — navigate or select
 *   actions     — (item) => ReactNode  — trailing action buttons per row
 *   emptyMessage — string
 *   compact     — boolean (smaller text)
 */
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const SECTOR_COLORS = {
  Technology:             'bg-blue-500/15 text-blue-400',
  Healthcare:             'bg-emerald-500/15 text-emerald-400',
  'Financial Services':   'bg-amber-500/15 text-amber-400',
  'Consumer Cyclical':    'bg-orange-500/15 text-orange-400',
  'Consumer Defensive':   'bg-lime-500/15 text-lime-400',
  'Communication Services': 'bg-violet-500/15 text-violet-400',
  Energy:                 'bg-red-500/15 text-red-400',
  Industrials:            'bg-cyan-500/15 text-cyan-400',
  'Real Estate':          'bg-pink-500/15 text-pink-400',
  Utilities:              'bg-teal-500/15 text-teal-400',
  'Basic Materials':      'bg-yellow-500/15 text-yellow-400',
};

function SectorBadge({ sector }) {
  if (!sector) return null;
  const color = SECTOR_COLORS[sector] || 'bg-gray-500/15 text-gray-400';
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${color}`}>
      {sector}
    </span>
  );
}

function fmtPrice(v) {
  if (v == null) return '—';
  return Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtChange(v) {
  if (v == null) return '—';
  const n = Number(v);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function fmtMarketCap(v) {
  if (v == null) return '—';
  const n = Number(v);
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

function ChangeIndicator({ value }) {
  if (value == null) return <Minus size={10} className="text-gray-500" />;
  const n = Number(value);
  if (n > 0) return <TrendingUp size={10} className="text-green-400" />;
  if (n < 0) return <TrendingDown size={10} className="text-red-400" />;
  return <Minus size={10} className="text-gray-500" />;
}

function changeColor(v) {
  if (v == null) return 'text-gray-400';
  const n = Number(v);
  if (n > 0) return 'text-green-400';
  if (n < 0) return 'text-red-400';
  return 'text-gray-400';
}

export default function StockListTable({
  items = [],
  onTickerClick,
  actions,
  emptyMessage = 'No stocks to display',
  compact = false,
  showSector = true,
  showMarketCap = true,
}) {
  const textSize = compact ? 'text-[11px]' : 'text-xs';

  if (!items.length) {
    return (
      <div className="flex items-center justify-center h-full min-h-[80px] text-gray-500 text-xs">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center px-3 py-2 border-b border-gray-800 bg-[#0d0d12] sticky top-0 z-10">
        <div className="flex-1 min-w-0">
          <span className={`${textSize} text-gray-500 font-medium`}>Name</span>
        </div>
        <div className="w-24 text-right">
          <span className={`${textSize} text-gray-500 font-medium`}>Price</span>
        </div>
        <div className="w-20 text-right">
          <span className={`${textSize} text-gray-500 font-medium`}>Change</span>
        </div>
        {showMarketCap && (
          <div className="w-24 text-right">
            <span className={`${textSize} text-gray-500 font-medium`}>Mkt Cap</span>
          </div>
        )}
        {actions && <div className="w-10" />}
      </div>

      {/* Rows */}
      {items.map((item, i) => {
        const ticker = item.ticker_cd || item.stk_cd || item.symbol || '';
        const name = item.ticker_name || item.stk_nm || item.name || ticker;
        const price = item.close_price ?? item.price ?? item.current_price;
        const change = item.change_rate ?? item.changePercent ?? item.change_pct;
        const mktCap = item.market_cap ?? item.marketCap;
        const sector = item.sector;

        return (
          <div
            key={item._key || item.item_id || ticker || i}
            className="flex items-center px-3 py-2.5 border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors group"
          >
            {/* Name + Sector */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onTickerClick?.(ticker)}
                  className="text-left min-w-0 group/ticker"
                >
                  <span className={`${textSize} font-semibold text-white group-hover/ticker:text-cyan-400 transition-colors`}>
                    {ticker}
                  </span>
                  {name !== ticker && (
                    <span className={`${textSize} text-gray-500 ml-1.5 truncate`}>{name}</span>
                  )}
                </button>
                {showSector && <SectorBadge sector={sector} />}
              </div>
            </div>

            {/* Price */}
            <div className="w-24 text-right">
              <span className={`${textSize} text-gray-200 tabular-nums font-medium`}>
                {fmtPrice(price)}
              </span>
            </div>

            {/* Change */}
            <div className="w-20 text-right flex items-center justify-end gap-1">
              <ChangeIndicator value={change} />
              <span className={`${textSize} tabular-nums font-medium ${changeColor(change)}`}>
                {fmtChange(change)}
              </span>
            </div>

            {/* Market Cap */}
            {showMarketCap && (
              <div className="w-24 text-right">
                <span className={`${textSize} text-gray-400 tabular-nums`}>
                  {fmtMarketCap(mktCap)}
                </span>
              </div>
            )}

            {/* Actions */}
            {actions && (
              <div className="w-10 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                {actions(item)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { SectorBadge, fmtPrice, fmtChange, fmtMarketCap };