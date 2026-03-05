/**
 * WidgetRenderer — single switch-based factory for every widget type.
 * Replaces the 4 separate switch blocks in the old dashboard files.
 *
 * Props:
 *   widget         — { id, type, config?, ... }
 *   symbol         — active ticker symbol (stock/dashboard screens)
 *   onSymbolChange — callback(newSymbol)
 *   portfolioData  — full portfolio state from usePortfolioState (portfolio screen)
 *   onRemove       — callback to remove the widget from the grid
 */
import UniversalWidget from './UniversalWidget';
import { UNIVERSAL_WIDGET_CONFIGS } from '../../registry/widgetConfigs';

// ── Stock ──────────────────────────────────────────────────────────────────
import ChartWidget from '../widgets/ChartWidget';
import CompanyRelationsWidget from '../widgets/CompanyRelationsWidget';
import InstitutionalPortfolios from '../analysis/InstitutionalPortfolios';
import ComparisonAnalysisTab from '../analysis/ComparisonAnalysisTab';
import EstimatesTab from '../analysis/EstimatesTab';
import TabWidgetWrapper from '../widgets/TabWidgetWrapper';

// ── Macro ──────────────────────────────────────────────────────────────────
import MacroFinConditionsTab from '../macro/MacroFinConditionsTab';
import MacroSentimentTab from '../macro/MacroSentimentTab';
import MacroCommoditiesTab from '../macro/MacroCommoditiesTab';

// ── Alerts ─────────────────────────────────────────────────────────────────
import AlertStatisticsWidget from '../alerts/widgets/AlertStatisticsWidget';
import RecentTriggersWidget from '../alerts/widgets/RecentTriggersWidget';
import ActiveAlertsWidget from '../alerts/widgets/ActiveAlertsWidget';

// ── Portfolio ──────────────────────────────────────────────────────────────
import PortfolioStatsWidget from '../widgets/portfolio/PortfolioStatsWidget';
import PortfolioPnLChartWidget from '../widgets/portfolio/PortfolioPnLChartWidget';
import PortfolioHoldingsWidget from '../widgets/portfolio/PortfolioHoldingsWidget';
import PortfolioBalancesWidget from '../widgets/portfolio/PortfolioBalancesWidget';
import PortfolioPositionsWidget from '../widgets/portfolio/PortfolioPositionsWidget';
import PortfolioTradeHistoryWidget from '../widgets/portfolio/PortfolioTradeHistoryWidget';
import { formatCurrency, formatPercent, formatKRW as _fmtKRW } from '../../hooks/usePortfolioState';

export default function WidgetRenderer({ widget, symbol, onSymbolChange, portfolioData, onRemove }) {
  const sym = symbol || 'AAPL';

  switch (widget.type) {

    // ── Stock (complex, not in widgetConfigs) ──────────────────────────────
    case 'stock-chart':
    case 'advanced-chart':
      return (
        <ChartWidget
          widgetId={widget.id}
          initialSymbols={[sym]}
          onRemove={onRemove}
        />
      );

    case 'company-relations':
      return <CompanyRelationsWidget symbol={sym} onRemove={onRemove} />;

    case 'institutional-portfolios':
      return (
        <TabWidgetWrapper title="Institutional Portfolios" onRemove={onRemove}>
          <InstitutionalPortfolios />
        </TabWidgetWrapper>
      );

    case 'comparison-analysis':
      return (
        <TabWidgetWrapper title="Comparison Analysis" onRemove={onRemove}>
          <ComparisonAnalysisTab symbol={sym} />
        </TabWidgetWrapper>
      );

    case 'estimates':
      return (
        <TabWidgetWrapper title="Estimates" onRemove={onRemove}>
          <EstimatesTab symbol={sym} />
        </TabWidgetWrapper>
      );

    // ── Macro ──────────────────────────────────────────────────────────────
    case 'fin-conditions-tab':
      return (
        <TabWidgetWrapper title="Financial Conditions" onRemove={onRemove}>
          <MacroFinConditionsTab />
        </TabWidgetWrapper>
      );

    case 'sentiment-tab':
      return (
        <TabWidgetWrapper title="Market Sentiment" onRemove={onRemove}>
          <MacroSentimentTab />
        </TabWidgetWrapper>
      );

    case 'commodities-tab':
      return (
        <TabWidgetWrapper title="Commodities" onRemove={onRemove}>
          <MacroCommoditiesTab />
        </TabWidgetWrapper>
      );

    // ── Alerts ─────────────────────────────────────────────────────────────
    case 'alert-statistics':
      return <AlertStatisticsWidget onRemove={onRemove} />;

    case 'recent-triggers':
      return <RecentTriggersWidget onRemove={onRemove} />;

    case 'active-alerts':
      return <ActiveAlertsWidget onRemove={onRemove} />;

    // ── Portfolio ──────────────────────────────────────────────────────────
    case 'portfolio-stats': {
      const p = portfolioData || {};
      const fmtKRW = p.formatKRW || _fmtKRW;
      return (
        <PortfolioStatsWidget
          stats={p.stats || {}}
          selectedAccountType={p.selectedAccountType || 'all'}
          setSelectedAccountType={p.setSelectedAccountType || (() => {})}
          selectedPeriod={p.selectedPeriod || '30D'}
          setSelectedPeriod={p.setSelectedPeriod || (() => {})}
          formatCurrency={formatCurrency}
          formatPercent={formatPercent}
          lastRefreshed={p.lastRefreshed}
          displayCurrency={p.displayCurrency || 'USD'}
          exchangeRate={p.exchangeRate}
          formatKRW={fmtKRW}
          onRemove={onRemove}
        />
      );
    }

    case 'portfolio-chart': {
      const p = portfolioData || {};
      return (
        <PortfolioPnLChartWidget
          pnlHistory={p.pnlHistory || []}
          chartTab={p.chartTab || 'value'}
          setChartTab={p.setChartTab || (() => {})}
          onRemove={onRemove}
        />
      );
    }

    case 'portfolio-holdings': {
      const p = portfolioData || {};
      const fmtKRW = p.formatKRW || _fmtKRW;
      return (
        <PortfolioHoldingsWidget
          holdings={p.filteredHoldings || []}
          onViewAll={() => {}}
          displayCurrency={p.displayCurrency || 'USD'}
          exchangeRate={p.exchangeRate}
          formatKRW={fmtKRW}
          onRemove={onRemove}
        />
      );
    }

    case 'portfolio-balances': {
      const p = portfolioData || {};
      const fmtKRW = p.formatKRW || _fmtKRW;
      return (
        <PortfolioBalancesWidget
          holdings={p.filteredHoldings || []}
          hideSmallBalances={p.hideSmallBalances || false}
          setHideSmallBalances={p.setHideSmallBalances || (() => {})}
          displayCurrency={p.displayCurrency || 'USD'}
          exchangeRate={p.exchangeRate}
          formatKRW={fmtKRW}
          onRemove={onRemove}
        />
      );
    }

    case 'portfolio-positions': {
      const p = portfolioData || {};
      const fmtKRW = p.formatKRW || _fmtKRW;
      return (
        <PortfolioPositionsWidget
          holdings={p.filteredHoldings || []}
          displayCurrency={p.displayCurrency || 'USD'}
          exchangeRate={p.exchangeRate}
          formatKRW={fmtKRW}
          onRemove={onRemove}
        />
      );
    }

    case 'portfolio-trade-history': {
      const p = portfolioData || {};
      return (
        <PortfolioTradeHistoryWidget
          transactions={p.transactions || []}
          loading={p.loadingTransactions || false}
          onAddTransaction={() => p.setShowAddTransaction?.(true)}
          onEditTransaction={(txn) => p.setEditingTransaction?.(txn)}
          onDeleteTransaction={p.handleDeleteTransaction || (() => {})}
          priceQuotes={p.priceQuotes || {}}
          exchangeRate={p.exchangeRate}
          formatKRW={p.formatKRW || _fmtKRW}
          onRemove={onRemove}
        />
      );
    }

    // ── UniversalWidget fallback ───────────────────────────────────────────
    default:
      if (UNIVERSAL_WIDGET_CONFIGS[widget.type]) {
        return (
          <UniversalWidget
            widgetId={widget.type}
            symbol={sym}
            onRemove={onRemove}
          />
        );
      }
      return (
        <div className="flex items-center justify-center h-full text-gray-500 text-sm">
          Unknown widget: {widget.type}
        </div>
      );
  }
}
