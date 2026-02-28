/**
 * CandleChart – Canvas-based 1m OHLCV candlestick chart.
 * Uses a Canvas element for pixel-perfect rendering at any container size.
 */
import { useRef, useEffect, useMemo } from 'react';

const PAD = { top: 8, right: 68, bottom: 20, left: 4 };
const DPR = window.devicePixelRatio || 1;

function fmtPrice(p) {
  return p >= 100 ? p.toFixed(1) : p >= 1 ? p.toFixed(3) : p.toFixed(6);
}

function fmtTime(ts) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export default function CandleChart({ candles, liveCandle, symbol }) {
  const canvasRef = useRef(null);

  const visible = useMemo(() => {
    const arr = liveCandle ? [...candles, liveCandle] : [...candles];
    return arr.slice(-100);
  }, [candles, liveCandle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || visible.length === 0) return;

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    if (W === 0 || H === 0) return;

    canvas.width  = W * DPR;
    canvas.height = H * DPR;

    const ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);
    ctx.clearRect(0, 0, W, H);

    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top  - PAD.bottom;

    // Price domain
    const lows  = visible.map(c => c.low);
    const highs = visible.map(c => c.high);
    let minP = Math.min(...lows);
    let maxP = Math.max(...highs);
    const pad = (maxP - minP) * 0.06 || 1;
    minP -= pad;
    maxP += pad;
    const range = maxP - minP;

    const toY = (p)  => PAD.top + chartH - ((p - minP) / range) * chartH;
    const N = visible.length;
    const slotW = chartW / N;
    const bodyW = Math.max(1, slotW * 0.65);
    const toX   = (i) => PAD.left + i * slotW + slotW / 2;

    // ── Grid lines ──────────────────────────────────────────────────────
    const TICKS = 5;
    ctx.font      = `${10}px 'JetBrains Mono', 'Courier New', monospace`;
    ctx.textAlign = 'left';
    for (let i = 0; i <= TICKS; i++) {
      const price = minP + (i / TICKS) * range;
      const y     = toY(price);
      ctx.beginPath();
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth   = 0.5;
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(W - PAD.right, y);
      ctx.stroke();
      ctx.fillStyle = '#4b5563';
      ctx.fillText(fmtPrice(price), W - PAD.right + 4, y + 4);
    }

    // ── Time axis (bottom) – every ~10 candles ───────────────────────────
    const timeStep = Math.max(1, Math.floor(N / 8));
    ctx.fillStyle   = '#4b5563';
    ctx.textAlign   = 'center';
    ctx.font        = `9px 'Courier New', monospace`;
    for (let i = 0; i < N; i += timeStep) {
      const cx = toX(i);
      ctx.fillText(fmtTime(visible[i].time), cx, H - 4);
    }

    // ── Candles ──────────────────────────────────────────────────────────
    visible.forEach((c, i) => {
      const isLive  = i === N - 1 && liveCandle !== null;
      const isBull  = c.close >= c.open;
      const color   = isBull ? '#22c55e' : '#ef4444';
      const cx      = toX(i);

      // Wick
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth   = Math.max(0.5, slotW * 0.08);
      ctx.moveTo(cx, toY(c.high));
      ctx.lineTo(cx, toY(c.low));
      ctx.stroke();

      // Body
      const bodyTop = toY(Math.max(c.open, c.close));
      const bodyBot = toY(Math.min(c.open, c.close));
      const bh      = Math.max(1, bodyBot - bodyTop);

      if (isLive) {
        // Open bar: draw as hollow rectangle
        ctx.strokeStyle = color;
        ctx.lineWidth   = 1;
        ctx.strokeRect(cx - bodyW / 2, bodyTop, bodyW, bh);
      } else {
        ctx.fillStyle = color;
        ctx.globalAlpha = isBull ? 0.85 : 1;
        ctx.fillRect(cx - bodyW / 2, bodyTop, bodyW, bh);
        ctx.globalAlpha = 1;
      }
    });

    // ── Last price dashed line + label ────────────────────────────────────
    const last = visible[N - 1];
    if (last) {
      const lastY = toY(last.close);

      ctx.beginPath();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth   = 0.8;
      ctx.setLineDash([4, 3]);
      ctx.moveTo(PAD.left, lastY);
      ctx.lineTo(W - PAD.right, lastY);
      ctx.stroke();
      ctx.setLineDash([]);

      const labelW = 62;
      const labelH = 14;
      const lx     = W - PAD.right + 2;
      const ly     = lastY - labelH / 2;
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(lx, ly, labelW, labelH);

      ctx.fillStyle   = '#000';
      ctx.font        = `bold 10px 'Courier New', monospace`;
      ctx.textAlign   = 'left';
      ctx.fillText(fmtPrice(last.close), lx + 3, ly + 10);
    }
  }, [visible, liveCandle]);

  // Redraw on window resize
  useEffect(() => {
    const handler = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        // Force re-run the draw effect by triggering a dummy re-render
        canvas.style.opacity = canvas.style.opacity === '0.99' ? '1' : '0.99';
      }
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="text-[10px] text-gray-600 px-1 mb-0.5 shrink-0 flex items-center gap-2">
        <span>{symbol}</span>
        <span className="text-gray-800">·</span>
        <span>1m Candlestick</span>
      </div>
      <canvas
        ref={canvasRef}
        className="flex-1 w-full block"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}
