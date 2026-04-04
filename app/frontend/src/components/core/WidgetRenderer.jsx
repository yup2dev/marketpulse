/**
 * WidgetRenderer — routes widget.type to the appropriate component.
 *
 * - portfolio-stats → PortfolioStatsWidget (self-fetching stats cards)
 * - everything else → UniversalWidget (data-driven table/chart)
 */
import UniversalWidget    from './UniversalWidget';
import PortfolioStatsWidget from '../widgets/PortfolioStatsWidget';

export default function WidgetRenderer({ widget, symbol, portfolioData, onRemove }) {
  const portfolioId = portfolioData?.selectedPortfolio?.portfolio_id;

  if (widget.type === 'portfolio-stats') {
    return (
      <PortfolioStatsWidget
        portfolioId={portfolioId}
        onRemove={onRemove}
      />
    );
  }

  return (
    <UniversalWidget
      widgetId={widget.type}
      symbol={symbol || 'AAPL'}
      portfolioId={portfolioId}
      onRemove={onRemove}
    />
  );
}
