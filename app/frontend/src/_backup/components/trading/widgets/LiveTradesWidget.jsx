import TradingWidgetShell from './TradingWidgetShell';
import LiveTradesPanel from '../panels/LiveTradesPanel';

export default function LiveTradesWidget({ trades, connected, assetType, onRemove }) {
  return (
    <TradingWidgetShell
      title="Live Trades"
      assetType={assetType}
      connected={connected}
      onRemove={onRemove}
      footer="Source: Binance Futures aggTrade"
    >
      <LiveTradesPanel trades={trades} hideHeader />
    </TradingWidgetShell>
  );
}
