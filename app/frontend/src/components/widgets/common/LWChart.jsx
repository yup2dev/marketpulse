/**
 * LWChart — Lightweight Charts (TradingView OSS) wrapper
 *
 * Drop-in for Recharts where you have time-series data and need:
 *   - built-in zoom / pan
 *   - crisp high-DPI rendering
 *   - crosshair tooltip
 *   - much better perf with thousands of points
 *
 * Props:
 *   series       [{time:'YYYY-MM-DD'|number, value:number}]  (single series)
 *   multiSeries  [{name, data:[{time,value}], color, lineWidth?, type?}]
 *   type         'line' | 'area' | 'histogram'
 *   color        line / bar colour
 *   topColor     area gradient top (hex with alpha)
 *   bottomColor  area gradient bottom
 *   referenceLine number  — horizontal dashed line
 *   formatter    (value)=>string  — tooltip value formatter
 *   priceFormat  lightweight-charts PriceFormat object
 *   height       number (px, default 100%)
 *   className    string
 */
import { useEffect, useRef, useLayoutEffect } from 'react';
import {
  createChart,
  ColorType,
  LineStyle,
  CrosshairMode,
} from 'lightweight-charts';

const DARK_THEME = {
  layout: {
    background:  { type: ColorType.Solid, color: 'transparent' },
    textColor:   '#6b7280',
    fontSize:    10,
    fontFamily:  'ui-sans-serif, system-ui, sans-serif',
  },
  grid: {
    vertLines:   { color: '#1f2937', style: LineStyle.Dotted },
    horzLines:   { color: '#1f2937', style: LineStyle.Dotted },
  },
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: { color: '#4b5563', labelBackgroundColor: '#1f2937' },
    horzLine: { color: '#4b5563', labelBackgroundColor: '#1f2937' },
  },
  rightPriceScale: {
    borderColor: '#374151',
    textColor:   '#6b7280',
  },
  timeScale: {
    borderColor:     '#374151',
    textColor:       '#6b7280',
    timeVisible:     true,
    secondsVisible:  false,
    fixLeftEdge:     true,
    fixRightEdge:    true,
  },
};

export default function LWChart({
  series,
  multiSeries,
  type = 'area',
  color = '#3b82f6',
  topColor,
  bottomColor,
  referenceLine,
  formatter,
  priceFormat,
  height,
  className = '',
}) {
  const containerRef = useRef(null);
  const chartRef     = useRef(null);
  const seriesRefs   = useRef([]);

  // ── Create chart on mount ────────────────────────────────────────────────
  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      ...DARK_THEME,
      width:  containerRef.current.clientWidth,
      height: height || containerRef.current.clientHeight || 200,
      handleScroll:  true,
      handleScale:   true,
      localization: {
        priceFormatter: formatter || (v => typeof v === 'number' ? v.toFixed(2) : v),
      },
    });

    chartRef.current = chart;

    // Responsive resize observer
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height: h } = e.contentRect;
        chart.applyOptions({ width, height: height || h });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRefs.current = [];
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Add / update series when data changes ────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // Remove old series
    seriesRefs.current.forEach(s => { try { chart.removeSeries(s); } catch {} });
    seriesRefs.current = [];

    const addSingle = (data, opts = {}) => {
      if (!data?.length) return;
      const seriesType = opts.type || type;
      const c = opts.color || color;

      let s;
      if (seriesType === 'histogram') {
        s = chart.addHistogramSeries({
          color: c,
          priceFormat: priceFormat,
        });
        s.setData(data.map(d => ({ ...d, color: d.value >= 0 ? (opts.posColor || c) : (opts.negColor || '#ef4444') })));
      } else if (seriesType === 'area') {
        s = chart.addAreaSeries({
          lineColor:   c,
          topColor:    opts.topColor    || topColor    || `${c}40`,
          bottomColor: opts.bottomColor || bottomColor || `${c}05`,
          lineWidth:   opts.lineWidth || 2,
          priceFormat,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius:  4,
        });
        s.setData(data);
      } else {
        // line
        s = chart.addLineSeries({
          color:     c,
          lineWidth: opts.lineWidth || 2,
          priceFormat,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius:  4,
        });
        s.setData(data);
      }

      if (opts.name) {
        s.applyOptions({ title: opts.name });
      }

      seriesRefs.current.push(s);
    };

    if (multiSeries?.length) {
      multiSeries.forEach(s => addSingle(s.data, s));
    } else if (series?.length) {
      addSingle(series, { color, topColor, bottomColor, type });
    }

    // Reference line (e.g. y=0 or y=2 for inflation target)
    if (referenceLine != null && seriesRefs.current.length) {
      seriesRefs.current[0].createPriceLine({
        price: referenceLine,
        color: '#4b5563',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: '',
      });
    }

    // Fit all data in view
    chart.timeScale().fitContent();
  }, [series, multiSeries, type, color, topColor, bottomColor, referenceLine, formatter, priceFormat]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${className}`}
      style={height ? { height } : undefined}
    />
  );
}
