import TradingWidgetShell from './TradingWidgetShell';
import CVDChart from '../panels/CVDChart';

export default function CVDWidget({ cvdPoints, connected, assetType, onRemove }) {
  const isStock = assetType === 'stock';
  return (
    <TradingWidgetShell
      title="CVD"
      subtitle={isStock ? 'Cumulative Volume Delta · Yahoo Finance' : 'Cumulative Volume Delta · Binance'}
      connected={isStock ? undefined : connected}
      onRemove={onRemove}
      footer={isStock ? 'Source: Yahoo Finance 1m bars (body-weighted delta)' : 'Source: Binance Futures aggTrade'}
    >
      <div className="w-full h-full p-1.5">
        <CVDChart cvdPoints={cvdPoints} />
      </div>
    </TradingWidgetShell>
  );
}
