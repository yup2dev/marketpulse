/**
 * TradingViewIndexChartsWidget — 주요 지수 차트 (TradingView Market Overview 임베드).
 *
 * 기존 SparklineWidget('Index Charts', Yahoo 기반)의 TradingView 대체본.
 * 지수/환율/금리를 탭으로 묶어 미니차트로 보여준다. 데이터는 TradingView가 직접 제공.
 */
import { LineChart } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import TradingViewEmbed from './common/TradingViewEmbed';

const SCRIPT_SRC =
  'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js';

const CONFIG = {
  colorTheme: 'dark',
  dateRange: '1D',
  showChart: true,
  locale: 'kr',
  width: '100%',
  height: '100%',
  isTransparent: true,
  showSymbolLogo: true,
  showFloatingTooltip: true,
  tabs: [
    {
      title: 'Indices',
      symbols: [
        { s: 'KRX:KOSPI',   d: 'KOSPI' },
        { s: 'KRX:KOSDAQ',  d: 'KOSDAQ' },
        { s: 'NASDAQ:NDX',  d: 'Nasdaq 100' },
        { s: 'SP:SPX',      d: 'S&P 500' },
        { s: 'DJ:DJI',      d: 'Dow 30' },
        { s: 'TVC:VIX',     d: 'VIX' },
      ],
    },
    {
      title: 'FX / Rates',
      symbols: [
        { s: 'FX_IDC:USDKRW', d: 'USD/KRW' },
        { s: 'TVC:DXY',       d: 'Dollar Index' },
        { s: 'TVC:US10Y',     d: 'US 10Y' },
        { s: 'TVC:US02Y',     d: 'US 2Y' },
      ],
    },
    {
      title: 'Commodities',
      symbols: [
        { s: 'TVC:GOLD',     d: 'Gold' },
        { s: 'TVC:USOIL',    d: 'WTI Oil' },
        { s: 'BINANCE:BTCUSDT', d: 'Bitcoin' },
      ],
    },
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
      <div style={{ height: '100%', minHeight: 240 }}>
        <TradingViewEmbed scriptSrc={SCRIPT_SRC} config={CONFIG} />
      </div>
    </BaseWidget>
  );
}
