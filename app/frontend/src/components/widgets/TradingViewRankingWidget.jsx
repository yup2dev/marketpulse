/**
 * TradingViewRankingWidget — 시장 급등/급락/거래량 랭킹 (TradingView Hotlists 임베드).
 *
 * 기존 MarketRankingWidget(KIS/Yahoo 기반)의 TradingView 대체본.
 * Hotlists 위젯이 거래소별 Top Gainers / Losers / Most Active를 탭으로 보여준다.
 */
import { TrendingUp } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import TradingViewEmbed from './common/TradingViewEmbed';

const SCRIPT_SRC =
  'https://s3.tradingview.com/external-embedding/embed-widget-hotlists.js';

const CONFIG = {
  colorTheme: 'dark',
  dateRange: '1D',
  exchange: 'US',          // 급등/급락/거래량 기준 거래소 (US)
  showChart: true,
  locale: 'kr',
  width: '100%',
  height: '100%',
  isTransparent: true,
  showSymbolLogo: true,
  showFloatingTooltip: true,
};

export default function TradingViewRankingWidget({ onRemove }) {
  return (
    <BaseWidget
      title="Market Ranking (TV)"
      icon={TrendingUp}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
    >
      <div style={{ height: '100%', minHeight: 300 }}>
        <TradingViewEmbed scriptSrc={SCRIPT_SRC} config={CONFIG} />
      </div>
    </BaseWidget>
  );
}
