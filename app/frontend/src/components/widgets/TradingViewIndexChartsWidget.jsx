/**
 * TradingViewIndexChartsWidget — 주요 지수 시세 타일 (TradingView Tickers 임베드).
 *
 * 기존 SparklineWidget('Index Charts', Yahoo 기반)의 TradingView 대체본.
 * Tickers 위젯은 심볼+가격+변동%를 정적 타일로(자동 스크롤 없음) 가로 배치하고 폭에 맞춰
 * 줄바꿈한다. single-ticker는 동적 주입 시 document.currentScript 의존으로 렌더 실패 →
 * 랭킹과 동일하게 정상 작동하는 단일 임베드(Tickers)를 사용한다.
 *
 * ⚠️ TradingView 무료 임베드는 거래소 지수(KRX:KOSPI, SP:SPX 등) 데이터를 막아둔다
 *    (로그인 필요) → 빈 타일. 무료로 렌더되는 심볼만 사용하고, 한국은 ETF EWY로 대체.
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
  width: '100%',
  height: '100%', // iframe이 위젯 셀 높이를 채우도록
  symbols: [
    { proName: 'AMEX:EWY',        title: 'Korea (EWY)' },
    { proName: 'FOREXCOM:SPXUSD', title: 'S&P 500' },
    { proName: 'FOREXCOM:NSXUSD', title: 'Nasdaq 100' },
    { proName: 'FOREXCOM:DJI',    title: 'Dow 30' },
    { proName: 'FX_IDC:USDKRW',   title: 'USD/KRW' },
    { proName: 'TVC:DXY',         title: 'Dollar Index' },
    { proName: 'TVC:GOLD',        title: 'Gold' },
    { proName: 'BITSTAMP:BTCUSD', title: 'Bitcoin' },
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
      <div style={{ height: '100%', width: '100%' }}>
        <TradingViewEmbed scriptSrc={SCRIPT_SRC} config={CONFIG} />
      </div>
    </BaseWidget>
  );
}
