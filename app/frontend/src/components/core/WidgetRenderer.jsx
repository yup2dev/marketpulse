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

// ── Dashboard / Market ─────────────────────────────────────────────────────
import MarketOverview from '../widgets/MarketOverview';
import LiveWatchlist from '../widgets/LiveWatchlist';

// ── Stock ──────────────────────────────────────────────────────────────────
import TickerInformation from '../widgets/TickerInformation';
import TickerQuickStatsWidget from '../widgets/TickerQuickStatsWidget';
import ResizableStockWidget from '../widgets/ResizableStockWidget';
import ChartWidget from '../widgets/ChartWidget';
import KeyMetricsWidget from '../widgets/KeyMetricsWidget';
import FinancialWidget from '../widgets/FinancialWidget';
import FinancialTableWidget from '../widgets/FinancialTableWidget';
import EarningsWidget from '../widgets/EarningsWidget';
import EarningsHistoryWidget from '../widgets/EarningsHistoryWidget';
import AnalystWidget from '../widgets/AnalystWidget';
import InsiderWidget from '../widgets/InsiderWidget';
import RevenueSegmentsWidget from '../widgets/RevenueSegmentsWidget';
import ManagementWidget from '../widgets/ManagementWidget';
import EconomicMoatWidget from '../widgets/EconomicMoatWidget';
import SWOTWidget from '../widgets/SWOTWidget';
import StockSentimentWidget from '../widgets/StockSentimentWidget';
import SocialSentimentWidget from '../widgets/SocialSentimentWidget';
import InvestmentScorecardWidget from '../widgets/InvestmentScorecardWidget';
import MacroCrossWidget from '../widgets/MacroCrossWidget';
import CompanyRelationsWidget from '../widgets/CompanyRelationsWidget';
import InstitutionalPortfolios from '../analysis/InstitutionalPortfolios';
import ComparisonAnalysisTab from '../analysis/ComparisonAnalysisTab';
import OwnershipOverviewWidget from '../widgets/stock/OwnershipOverviewWidget';
import OwnershipInstitutionalWidget from '../widgets/stock/OwnershipInstitutionalWidget';
import OwnershipInsiderWidget from '../widgets/stock/OwnershipInsiderWidget';
import EstimatesTab from '../analysis/EstimatesTab';
import TabWidgetWrapper from '../widgets/TabWidgetWrapper';

// ── Macro ──────────────────────────────────────────────────────────────────
import GDPForecastWidget from '../widgets/macro/GDPForecastWidget';
import InflationMomentumWidget from '../widgets/macro/InflationMomentumWidget';
import InitialClaimsWidget from '../widgets/macro/InitialClaimsWidget';
import JobsBreakdownWidget from '../widgets/macro/JobsBreakdownWidget';
import FedPolicyStanceWidget from '../widgets/macro/FedPolicyStanceWidget';
import YieldCurveSnapshotWidget from '../widgets/macro/YieldCurveSnapshotWidget';
import YieldTrendsWidget from '../widgets/macro/YieldTrendsWidget';
import InflationDecompWidget from '../widgets/macro/InflationDecompWidget';
import InflationTrendsWidget from '../widgets/macro/InflationTrendsWidget';
import LaborMarketWidget from '../widgets/macro/LaborMarketWidget';
import PMIWidget from '../widgets/macro/PMIWidget';
import FedBalanceSheetWidget from '../widgets/macro/FedBalanceSheetWidget';
import RealRatesWidget from '../widgets/macro/RealRatesWidget';
import MacroFinConditionsTab from '../macro/MacroFinConditionsTab';
import MacroSentimentTab from '../macro/MacroSentimentTab';
import MacroCommoditiesTab from '../macro/MacroCommoditiesTab';
import YieldCurveWidget from '../widgets/macro/YieldCurveWidget';
import RegimeWidget from '../widgets/macro/RegimeWidget';

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

    // ── Market / Dashboard ─────────────────────────────────────────────────
    case 'market-overview':
      return <MarketOverview onRemove={onRemove} />;

    case 'live-watchlist':
      return <LiveWatchlist onRemove={onRemove} />;

    // ── Stock ──────────────────────────────────────────────────────────────
    case 'ticker-info':
    case 'ticker-information':
      return (
        <TickerInformation
          symbol={sym}
          onSymbolChange={onSymbolChange}
          onRemove={onRemove}
        />
      );

    case 'ticker-info-widget':
      return <TickerQuickStatsWidget symbol={sym} onRemove={onRemove} />;

    case 'stock-chart':
    case 'advanced-chart':
      return (
        <ChartWidget
          widgetId={widget.id}
          initialSymbols={[sym]}
          onRemove={onRemove}
        />
      );

    case 'stock-quote':
    case 'resizable-stock':
      return <ResizableStockWidget symbol={sym} onRemove={onRemove} />;

    case 'key-metrics':
      return <KeyMetricsWidget symbol={sym} onRemove={onRemove} />;

    case 'financials':
      return <FinancialWidget symbol={sym} onRemove={onRemove} />;

    case 'financial-table':
      return <FinancialTableWidget symbol={sym} onRemove={onRemove} />;

    case 'earnings':
      return <EarningsWidget symbol={sym} onRemove={onRemove} />;

    case 'earnings-history':
      return <EarningsHistoryWidget symbol={sym} onClose={onRemove} />;

    case 'analyst':
      return <AnalystWidget symbol={sym} onRemove={onRemove} />;

    case 'insider':
      return <InsiderWidget symbol={sym} onRemove={onRemove} />;

    case 'revenue-segments':
      return <RevenueSegmentsWidget symbol={sym} onRemove={onRemove} />;

    case 'management':
      return <ManagementWidget symbol={sym} onRemove={onRemove} />;

    case 'economic-moat':
      return <EconomicMoatWidget symbol={sym} onRemove={onRemove} />;

    case 'swot':
      return <SWOTWidget symbol={sym} onRemove={onRemove} />;

    case 'stock-sentiment':
      return <StockSentimentWidget symbol={sym} onRemove={onRemove} />;

    case 'social-sentiment':
      return <SocialSentimentWidget symbol={sym} onRemove={onRemove} />;

    case 'investment-scorecard':
      return <InvestmentScorecardWidget symbol={sym} onRemove={onRemove} />;

    case 'macro-cross':
      return <MacroCrossWidget symbol={sym} onRemove={onRemove} />;

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

    case 'ownership-overview':
      return <OwnershipOverviewWidget symbol={sym} onRemove={onRemove} />;

    case 'ownership-institutional':
      return <OwnershipInstitutionalWidget symbol={sym} onRemove={onRemove} />;

    case 'ownership-insider':
      return <OwnershipInsiderWidget symbol={sym} onRemove={onRemove} />;

    case 'estimates':
      return (
        <TabWidgetWrapper title="Estimates" onRemove={onRemove}>
          <EstimatesTab symbol={sym} />
        </TabWidgetWrapper>
      );

    case 'stock-splits':
      return <UniversalWidget widgetId="stock-splits" symbol={sym} onRemove={onRemove} />;

    case 'dividends':
    case 'dividend':
      return <UniversalWidget widgetId="dividend" symbol={sym} onRemove={onRemove} />;

    case 'company-filings':
      return <UniversalWidget widgetId="company-filings" symbol={sym} onRemove={onRemove} />;

    // ── Macro ──────────────────────────────────────────────────────────────
    case 'gdp-forecast':
      return <GDPForecastWidget onRemove={onRemove} />;

    case 'inflation-momentum':
      return <InflationMomentumWidget onRemove={onRemove} />;

    case 'initial-claims':
      return <InitialClaimsWidget onRemove={onRemove} />;

    case 'jobs-breakdown':
      return <JobsBreakdownWidget onRemove={onRemove} />;

    case 'fed-policy-stance':
      return <FedPolicyStanceWidget onRemove={onRemove} />;

    case 'yield-curve-snapshot':
      return <YieldCurveSnapshotWidget onRemove={onRemove} />;

    case 'yield-trends':
      return <YieldTrendsWidget onRemove={onRemove} />;

    case 'inflation-decomp':
      return <InflationDecompWidget onRemove={onRemove} />;

    case 'inflation-trends':
      return <InflationTrendsWidget onRemove={onRemove} />;

    case 'labor-market-dashboard':
      return <LaborMarketWidget onRemove={onRemove} />;

    case 'pmi':
      return <PMIWidget onRemove={onRemove} />;

    case 'fed-balance-sheet':
      return <FedBalanceSheetWidget onRemove={onRemove} />;

    case 'real-rates':
      return <RealRatesWidget onRemove={onRemove} />;

    case 'yield-curve':
      return <YieldCurveWidget onRemove={onRemove} />;

    case 'regime':
      return <RegimeWidget onRemove={onRemove} />;

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
    // portfolioData is passed from TabDashboard for the portfolio screen
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
