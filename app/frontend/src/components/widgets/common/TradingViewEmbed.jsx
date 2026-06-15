/**
 * TradingViewEmbed — TradingView 공식 임베드 위젯 로더.
 *
 * 표준 구조(__widget + copyright + script)를 한 번만 주입한다.
 * - copyright div: TradingView 로더가 querySelector로 참조 → 없으면 null 참조로 터진다.
 * - StrictMode 이중 마운트 가드: 같은 src 스크립트 재주입/제거는 비동기 로더를 깨뜨린다
 *   (스크립트가 실행될 때 부모가 사라져 'null.querySelector' 에러).
 *
 * 높이는 config(height:'100%') + 부모 체인 height:100%로 채운다. 데이터/네트워크는
 * 전부 TradingView가 처리 → 우리 서버·Yahoo·Fetcher 불필요.
 */
import { useEffect, useRef } from 'react';

export default function TradingViewEmbed({ scriptSrc, config }) {
  const containerRef = useRef(null);
  const loaded = useRef(false);
  const configKey = JSON.stringify(config);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || loaded.current) return;
    loaded.current = true;

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
  }, [scriptSrc, configKey]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ height: '100%', width: '100%' }}
    />
  );
}
