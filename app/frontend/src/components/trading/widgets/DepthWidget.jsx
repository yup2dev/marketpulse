import TradingWidgetShell from './TradingWidgetShell';
import DepthChart from '../panels/DepthChart';
import StockOrderBookPanel from '../panels/StockOrderBookPanel';

export default function DepthWidget({
  bids, asks,           // crypto (Binance)
  stockBids, stockAsks, stockSource,  // stock (Polygon)
  assetType, connected, onRemove,
}) {
  const isStock = assetType === 'stock';
  return (
    <TradingWidgetShell
      title={isStock ? '호가창' : 'Order Book'}
      subtitle={isStock ? 'NBBO Depth · Polygon' : 'Depth Chart · Binance'}
      connected={isStock ? undefined : connected}
      onRemove={onRemove}
      footer={isStock ? 'Source: Polygon.io NBBO quotes' : 'Source: Binance Futures'}
    >
      <div className="w-full h-full p-1.5 overflow-hidden">
        {isStock
          ? <StockOrderBookPanel bids={stockBids} asks={stockAsks} source={stockSource} />
          : <DepthChart bids={bids} asks={asks} />
        }
      </div>
    </TradingWidgetShell>
  );
}
