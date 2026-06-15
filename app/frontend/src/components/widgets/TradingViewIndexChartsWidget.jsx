/**
 * TradingViewIndexChartsWidget — 주요 지수 가로 티커 바 (TradingView Tickers 임베드).
 *
 * 기존 SparklineWidget('Index Charts', Yahoo 기반)의 TradingView 대체본.
 * 지수/환율/금리를 미니차트와 함께 한 줄로 가로 배치(기존 ticker bar UI와 동일한 형태).
 * 데이터/네트워크는 TradingView가 직접 제공 → 서버·Yahoo·Fetcher 불필요.
 */
import { LineChart } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import TradingViewEmbed from './common/TradingViewEmbed';

const SCRIPT_SRC =
  'https://s3.tradingview.com/external-embedding/embed-widget-tickers.js';

const CONFIG = {
  colorTheme: 'dark',
  locale: 'kr',
  isTransparent: true,
  showSymbolLogo: true,
  symbols: [
    { proName: 'KRX:KOSPI',     title: 'KOSPI' },
    { proName: 'KRX:KOSDAQ',    title: 'KOSDAQ' },
    { proName: 'NASDAQ:NDX',    title: 'Nasdaq 100' },
    { proName: 'SP:SPX',        title: 'S&P 500' },
    { proName: 'DJ:DJI',        title: 'Dow 30' },
    { proName: 'TVC:VIX',       title: 'VIX' },
    { proName: 'FX_IDC:USDKRW', title: 'USD/KRW' },
    { proName: 'TVC:US10Y',     title: 'US 10Y' },
  ],
};

export default function TradingViewIndexChartsWidget({ onRemove }) {
  return (
    <BaseWidget
      title="Index Charts (TV)"
      icon={LineChart}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
    >
      <div style={{ width: '100%' }}>
        <TradingViewEmbed scriptSrc={SCRIPT_SRC} config={CONFIG} />
      </div>
    </BaseWidget>
  );
}
