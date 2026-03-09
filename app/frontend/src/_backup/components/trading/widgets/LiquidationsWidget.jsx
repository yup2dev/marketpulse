import TradingWidgetShell from './TradingWidgetShell';
import LiquidationsPanel from '../panels/LiquidationsPanel';

export default function LiquidationsWidget({ liquidations, connected, assetType, onRemove }) {
  return (
    <TradingWidgetShell
      title="Liquidations"
      subtitle="Binance Futures"
      assetType={assetType}
      connected={connected}
      onRemove={onRemove}
      footer="Source: Binance Futures forceOrder"
    >
      <LiquidationsPanel liquidations={liquidations} hideHeader />
    </TradingWidgetShell>
  );
}
