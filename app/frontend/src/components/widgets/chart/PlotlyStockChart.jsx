import { useEffect, useRef } from 'react';
import { formatNumber, formatPrice, formatDate, INDICATOR_COLORS, CANDLE_COLORS } from '../constants';
import useThemeStore from '../../../store/themeStore';
import { getPlotlyPalette } from '../../../utils/plotlyTheme';
import { getRegimeColor } from '../../../utils/pairAnalysis';
import { tickerDisplayName } from './chartHelpers';

// Plotly-based stock chart component
const PlotlyStockChart = ({
  chartData,
  tickers,
  chartType,
  normalized,
  showVolume,
  technicalIndicators,
  pairMode,
  pairConfig,
  spreadData,
  indexData,
  regimePeriods,
  outperformPeriods,
  externalReferenceLines,
  externalReferencePoints,
  chartTheme,
  isSeriesMode,
  visibleSeries,
  hasVolumeInSeries,
  formatPrice,
  formatDate,
  formatNumber,
  INDICATOR_COLORS,
  CANDLE_COLORS,
  getRegimeColor,
  selectedDot,
  setSelectedDot,
}) => {
  const divRef = useRef(null);
  const theme = useThemeStore(state => state.theme);

  useEffect(() => {
    if (!divRef.current || !chartData || chartData.length === 0) return;

    const loadPlotly = async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;

      const traces = [];
      const shapes = [];
      const annotations = [];

      const pal = getPlotlyPalette(theme);
      const darkLayout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, system-ui', color: pal.font, size: 11 },
        xaxis: {
          gridcolor: chartTheme?.grid || pal.grid,
          linecolor: pal.line,
          tickfont: { color: pal.tick, size: 10 },
          rangeslider: { visible: false },
          type: 'category',
        },
        yaxis: {
          gridcolor: chartTheme?.grid || pal.grid,
          linecolor: pal.line,
          tickfont: { color: pal.tick, size: 10 },
          automargin: true,
          side: 'right',
        },
        yaxis2: {
          gridcolor: 'rgba(0,0,0,0)',
          linecolor: pal.line,
          tickfont: { color: pal.tick, size: 10 },
          automargin: true,
          side: 'left',
          overlaying: 'y',
        },
        yaxis3: {
          gridcolor: 'rgba(0,0,0,0)',
          linecolor: pal.line,
          tickfont: { color: '#f59e0b', size: 10 },
          automargin: true,
          side: 'left',
          overlaying: 'y',
        },
        margin: { t: 8, r: 60, b: 32, l: 60 },
        legend: { font: { color: pal.legend, size: 10 }, bgcolor: 'rgba(0,0,0,0)', x: 0, y: 1 },
        hoverlabel: { bgcolor: pal.hover.bg, bordercolor: pal.hover.border, font: { color: pal.hover.text, size: 11 } },
        hovermode: 'x unified',
        showlegend: true,
        shapes,
        annotations,
      };

      const dates = chartData.map(d => d.date);

      // Regime background areas
      if (pairMode && pairConfig?.showRegime) {
        regimePeriods?.forEach((period) => {
          shapes.push({
            type: 'rect',
            xref: 'x',
            yref: 'paper',
            x0: period.start,
            x1: period.end,
            y0: 0,
            y1: 1,
            fillcolor: getRegimeColor?.(period.regime) || 'rgba(100,100,100,0.1)',
            line: { width: 0 },
          });
        });
      }

      // Outperform highlight areas
      if (pairMode && pairConfig?.showHighlight) {
        outperformPeriods?.forEach((period) => {
          shapes.push({
            type: 'rect',
            xref: 'x',
            yref: 'paper',
            x0: period.start,
            x1: period.end,
            y0: 0,
            y1: 1,
            fillcolor: 'rgba(34, 197, 94, 0.15)',
            line: { color: 'rgba(34, 197, 94, 0.3)', dash: 'dot', width: 1 },
          });
        });
      }

      // Series mode rendering
      if (isSeriesMode && visibleSeries) {
        visibleSeries.forEach((s) => {
          // Price line
          traces.push({
            type: 'scatter',
            mode: 'lines',
            x: dates,
            y: chartData.map(d => d[s.id]),
            name: s.name,
            yaxis: 'y',
            line: { color: s.color || '#06b6d4', width: 2 },
            connectgaps: true,
          });
          // Volume bars
          if (showVolume && hasVolumeInSeries) {
            traces.push({
              type: 'bar',
              x: dates,
              y: chartData.map(d => d[`${s.id}_volume`]),
              name: `${s.name} Vol`,
              yaxis: 'y2',
              marker: { color: s.color || '#06b6d4', opacity: 0.3 },
              showlegend: false,
            });
          }
        });
      } else {
        // Symbol mode rendering
        const stockTickers = tickers?.filter(t => t.visible) || [];

        stockTickers.forEach((ticker) => {
          if (ticker.type === 'indicator') {
            // Macro indicator - dashed line
            traces.push({
              type: 'scatter',
              mode: 'lines',
              x: dates,
              y: chartData.map(d => d[ticker.symbol]),
              name: tickerDisplayName(ticker),
              yaxis: 'y',
              line: { color: ticker.color, width: 3, dash: 'dot' },
              connectgaps: true,
            });
            return;
          }

          // Stock rendering based on chart type
          const isOHLCType = ['candlestick', 'ohlc', 'heikinashi'].includes(chartType) && !normalized;

          if (isOHLCType) {
            if (chartType === 'ohlc') {
              traces.push({
                type: 'ohlc',
                x: dates,
                open: chartData.map(d => d[`${ticker.symbol}_open`]),
                high: chartData.map(d => d[`${ticker.symbol}_high`]),
                low: chartData.map(d => d[`${ticker.symbol}_low`]),
                close: chartData.map(d => d[`${ticker.symbol}_close`]),
                name: tickerDisplayName(ticker),
                yaxis: 'y',
                increasing: { line: { color: CANDLE_COLORS?.up || '#22c55e' } },
                decreasing: { line: { color: CANDLE_COLORS?.down || '#ef4444' } },
              });
            } else {
              // candlestick and heikinashi
              traces.push({
                type: 'candlestick',
                x: dates,
                open: chartData.map(d => d[`${ticker.symbol}_open`]),
                high: chartData.map(d => d[`${ticker.symbol}_high`]),
                low: chartData.map(d => d[`${ticker.symbol}_low`]),
                close: chartData.map(d => d[`${ticker.symbol}_close`]),
                name: tickerDisplayName(ticker),
                yaxis: 'y',
                increasing: { line: { color: CANDLE_COLORS?.up || '#22c55e' }, fillcolor: CANDLE_COLORS?.up || '#22c55e' },
                decreasing: { line: { color: CANDLE_COLORS?.down || '#ef4444' }, fillcolor: CANDLE_COLORS?.down || '#ef4444' },
              });
            }
          } else if (chartType === 'area') {
            traces.push({
              type: 'scatter',
              mode: 'lines',
              x: dates,
              y: chartData.map(d => d[ticker.symbol]),
              name: tickerDisplayName(ticker),
              yaxis: 'y',
              line: { color: ticker.color, width: 2 },
              fill: 'tozeroy',
              fillcolor: ticker.color.replace(')', ', 0.1)').replace('rgb', 'rgba').replace('#', 'rgba(') || 'rgba(6,182,212,0.1)',
              connectgaps: true,
            });
          } else {
            // line (default)
            traces.push({
              type: 'scatter',
              mode: 'lines',
              x: dates,
              y: chartData.map(d => d[ticker.symbol]),
              name: tickerDisplayName(ticker),
              yaxis: 'y',
              line: { color: ticker.color, width: 2 },
              connectgaps: true,
            });
          }

          // Volume bars
          if (showVolume) {
            traces.push({
              type: 'bar',
              x: dates,
              y: chartData.map(d => d[`${ticker.symbol}_volume`]),
              name: `${ticker.symbol} Vol`,
              yaxis: 'y2',
              marker: { color: ticker.color, opacity: 0.3 },
              showlegend: false,
            });
          }
        });

        // Technical indicator overlays
        if (!normalized && technicalIndicators) {
          technicalIndicators.filter(ti => ti.visible).forEach((indicator) => {
            const { indicatorId, symbol } = indicator;

            if (indicatorId === 'BBANDS') {
              traces.push({
                type: 'scatter', mode: 'lines',
                x: dates, y: chartData.map(d => d[`${symbol}_${indicatorId}_upper`]),
                name: `${symbol} BB Upper`, yaxis: 'y',
                line: { color: INDICATOR_COLORS?.BBANDS_upper || '#6b7280', width: 1, dash: 'dash' },
                connectgaps: true, showlegend: true,
              });
              traces.push({
                type: 'scatter', mode: 'lines',
                x: dates, y: chartData.map(d => d[`${symbol}_${indicatorId}_middle`]),
                name: `${symbol} BB Middle`, yaxis: 'y',
                line: { color: INDICATOR_COLORS?.BBANDS_middle || '#9ca3af', width: 1.5 },
                connectgaps: true,
              });
              traces.push({
                type: 'scatter', mode: 'lines',
                x: dates, y: chartData.map(d => d[`${symbol}_${indicatorId}_lower`]),
                name: `${symbol} BB Lower`, yaxis: 'y',
                line: { color: INDICATOR_COLORS?.BBANDS_lower || '#6b7280', width: 1, dash: 'dash' },
                fill: 'tonexty', fillcolor: 'rgba(107,114,128,0.05)',
                connectgaps: true,
              });
            } else if (['SMA_20', 'SMA_50', 'SMA_200', 'EMA_12', 'EMA_26'].includes(indicatorId)) {
              traces.push({
                type: 'scatter', mode: 'lines',
                x: dates, y: chartData.map(d => d[`${symbol}_${indicatorId}`]),
                name: `${symbol} ${indicator.name}`, yaxis: 'y',
                line: { color: INDICATOR_COLORS?.[indicatorId] || '#f59e0b', width: 1.5 },
                connectgaps: true,
              });
            }
          });
        }
      }

      // Normalized baseline
      if (normalized) {
        shapes.push({
          type: 'line', xref: 'paper', yref: 'y',
          x0: 0, x1: 1, y0: 0, y1: 0,
          line: { color: '#9ca3af', dash: 'dot', width: 1 },
        });
      }

      // External reference lines (analyst targets)
      if (!normalized && externalReferenceLines?.length > 0) {
        externalReferenceLines.forEach((line, idx) => {
          if (line.y != null) {
            shapes.push({
              type: 'line', xref: 'paper', yref: 'y',
              x0: 0, x1: 1, y0: line.y, y1: line.y,
              line: {
                color: line.color,
                dash: line.dashed ? 'dash' : 'solid',
                width: line.dashed ? 1 : 1.5,
              },
            });
            if (line.label) {
              annotations.push({
                xref: 'paper', yref: 'y',
                x: 1, y: line.y,
                text: line.label,
                showarrow: false,
                font: { color: line.color, size: 10 },
                xanchor: 'right',
              });
            }
          }
        });
      }

      // Pair Analysis: spread line
      if (pairMode && pairConfig?.showSpread && spreadData?.length > 0) {
        traces.push({
          type: 'scatter', mode: 'lines',
          x: dates, y: chartData.map(d => d.spread),
          name: 'Spread', yaxis: 'y3',
          line: { color: '#f59e0b', width: 2.5 },
          connectgaps: true,
        });
        shapes.push({
          type: 'line', xref: 'paper', yref: 'y3',
          x0: 0, x1: 1, y0: 1, y1: 1,
          line: { color: '#f59e0b', dash: 'dot', width: 1 },
        });
        annotations.push({
          xref: 'paper', yref: 'y3',
          x: 0, y: 1,
          text: 'Base (1.0)',
          showarrow: false,
          font: { color: '#f59e0b', size: 10 },
          xanchor: 'left',
        });
      }

      // Pair Analysis: index line
      if (pairMode && pairConfig?.showIndex && indexData?.length > 0) {
        traces.push({
          type: 'scatter', mode: 'lines',
          x: dates, y: chartData.map(d => d.indexNormalized),
          name: pairConfig.regimeSymbol === '^KS11' ? 'KOSPI' : pairConfig.regimeSymbol,
          yaxis: 'y3',
          line: { color: '#3b82f6', width: 2, dash: 'dash' },
          connectgaps: true,
        });
      }

      // External reference points (analyst dots)
      if (!normalized && externalReferencePoints?.length > 0 && chartData.length > 0) {
        const primarySymbol = tickers?.find(t => t.type === 'stock')?.symbol;
        const dataByDate = {};
        chartData.forEach(d => { if (d.date) dataByDate[d.date] = d; });
        const chartDates = Object.keys(dataByDate);

        const findClosestDate = (targetDate) => {
          if (!targetDate) return chartDates[chartDates.length - 1];
          const target = new Date(targetDate).getTime();
          let closest = chartDates[0];
          let minDiff = Math.abs(new Date(closest).getTime() - target);
          for (const d of chartDates) {
            const diff = Math.abs(new Date(d).getTime() - target);
            if (diff < minDiff) { minDiff = diff; closest = d; }
          }
          return closest;
        };

        const ptX = [], ptY = [], ptText = [], ptColors = [];
        externalReferencePoints.forEach((pt) => {
          const snappedDate = findClosestDate(pt.x);
          let yVal = pt.y;
          if (yVal == null && primarySymbol && dataByDate[snappedDate]) {
            yVal = dataByDate[snappedDate][primarySymbol];
          }
          if (yVal == null) return;
          ptX.push(snappedDate);
          ptY.push(yVal);
          ptText.push(pt.tooltip || pt.label || '');
          ptColors.push(pt.color || '#a78bfa');
        });

        if (ptX.length > 0) {
          traces.push({
            type: 'scatter', mode: 'markers',
            x: ptX, y: ptY,
            name: 'Targets',
            yaxis: 'y',
            marker: { color: ptColors, size: 8, symbol: 'circle', line: { color: '#1a1a2e', width: 1.5 } },
            text: ptText,
            hovertemplate: '%{text}<extra></extra>',
          });
        }
      }

      // Y-axis tick formatters
      const yTickFormatter = normalized
        ? (v) => `${v.toFixed(0)}%`
        : (v) => `${parseFloat(v).toFixed(0)}`;

      darkLayout.yaxis.tickformat = normalized ? '.0f' : undefined;
      darkLayout.yaxis.ticksuffix = normalized ? '%' : '';
      darkLayout.yaxis2.tickformat = '.2s';

      await Plotly.react(divRef.current, traces, darkLayout, {
        displayModeBar: false,
        responsive: true,
        scrollZoom: true,
      });

      const ro = new ResizeObserver(() => {
        if (divRef.current) Plotly.Plots.resize(divRef.current);
      });
      ro.observe(divRef.current);
      divRef.current._ro = ro;
    };

    loadPlotly();

    return () => {
      if (divRef.current?._ro) {
        divRef.current._ro.disconnect();
      }
    };
  }, [chartData, tickers, chartType, normalized, showVolume, technicalIndicators, pairMode, pairConfig,
    spreadData, indexData, regimePeriods, outperformPeriods, externalReferenceLines, externalReferencePoints,
    isSeriesMode, visibleSeries, hasVolumeInSeries, theme, chartTheme]);

  return <div ref={divRef} className="w-full h-full" />;
};

export default PlotlyStockChart;
