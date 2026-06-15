/**
 * TradingViewEmbed — TradingView 공식 임베드 위젯 로더.
 *
 * TradingView 위젯은 `.tradingview-widget-container` 안에 `__widget` div와
 * 설정(JSON)을 본문으로 갖는 <script src=...embed-widget-*.js>를 넣으면 iframe으로
 * 렌더된다. 데이터/네트워크는 전부 TradingView가 처리 → 우리 서버·Yahoo·Fetcher 불필요.
 *
 * config는 컴포넌트 상수로 넘긴다(매 렌더 새 객체면 재로드되니 상위에서 고정할 것).
 */
import { useEffect, useRef } from 'react';

export default function TradingViewEmbed({ scriptSrc, config }) {
  const containerRef = useRef(null);
  const configKey = JSON.stringify(config);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    container.innerHTML = '';
    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container__widget';
    widget.style.height = '100%';
    widget.style.width = '100%';
    container.appendChild(widget);

    const script = document.createElement('script');
    script.src = scriptSrc;
    script.async = true;
    script.type = 'text/javascript';
    script.innerHTML = configKey; // TradingView 로더는 script 본문(JSON)을 설정으로 읽는다
    container.appendChild(script);

    return () => { container.innerHTML = ''; };
  }, [scriptSrc, configKey]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ height: '100%', width: '100%' }}
    />
  );
}
