import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, Percent, TrendingDown, X, Plus, Activity } from 'lucide-react';
import {
  WidgetHeader,
  LoadingSpinner,
  formatNumber,
  formatPrice,
  formatDate,
  WIDGET_STYLES,
  WIDGET_ICON_COLORS,
  LOADING_COLORS,
  CHART_COLORS,
  CHART_THEME,
  TIME_RANGES,
  TECHNICAL_INDICATORS,
  INDICATOR_COLORS,
} from '../widgets/common';
import { calculateIndicator } from '../../utils/technicalIndicators';

/**
 * UniversalChartWidget - Reusable chart component for all data types
 *
 * @param {Object} props
 * @param {Array} props.series - Array of series to plot: [{ id, name, data: [{date, value, ...}], color, visible, type }]
 * @param {string} props.title - Chart title
 * @param {string} props.subtitle - Chart subtitle
 * @param {boolean} props.showTimeRanges - Show time range selector
 * @param {boolean} props.showNormalize - Show normalize button
 * @param {boolean} props.showVolume - Show volume toggle
 * @param {boolean} props.showTechnicalIndicators - Show technical indicators
 * @param {Function} props.onRemove - Remove callback
 * @param {Function} props.onAddSeries - Add series callback
 */
const UniversalChartWidget = ({
  series = [],
  title = 'Chart',
  subtitle,
  showTimeRanges = false,
  showNormalize = true,
  showVolume = false,
  showTechnicalIndicators = true,
  onRemove,
  onAddSeries,
  loading = false,
}) => {
  const [normalized, setNormalized] = useState(false);
  const [showVol, setShowVol] = useState(true);
  const [timeRange, setTimeRange] = useState('1yr');
  const [technicalIndicators, setTechnicalIndicators] = useState([]);
  const [showTechnicalIndicatorSelector, setShowTechnicalIndicatorSelector] = useState(false);
  const [chartData, setChartData] = useState([]);

  // Transform series data to chart format
  useEffect(() => {
    if (!series || series.length === 0) {
      setChartData([]);
      return;
    }

    // Collect all unique dates
    const dateMap = new Map();

    series.forEach(s => {
      if (!s.data || !Array.isArray(s.data)) return;

      s.data.forEach(point => {
        const date = point.date;
        if (!dateMap.has(date)) {
          dateMap.set(date, { date, timestamp: new Date(date).getTime() });
        }

        const entry = dateMap.get(date);

        // Add main value
        entry[s.id] = point.value !== undefined ? point.value : point.close;

        // Add volume if exists
        if (point.volume !== undefined) {
          entry[`${s.id}_volume`] = point.volume;
        }

        // Add OHLC if exists
        if (point.high !== undefined) entry[`${s.id}_high`] = point.high;
        if (point.low !== undefined) entry[`${s.id}_low`] = point.low;
        if (point.open !== undefined) entry[`${s.id}_open`] = point.open;
      });
    });

    let data = Array.from(dateMap.values()).sort((a, b) => a.timestamp - b.timestamp);

    // Apply normalization
    if (normalized && data.length > 0) {
      const normalizedData = data.map((d, idx) => {
        const newPoint = { ...d };

        series.forEach(s => {
          if (s.visible !== false && d[s.id] !== undefined) {
            // Find first non-null value as base
            let baseValue = null;
            for (let i = 0; i < data.length; i++) {
              if (data[i][s.id] !== null && data[i][s.id] !== undefined) {
                baseValue = data[i][s.id];
                break;
              }
            }

            if (baseValue && baseValue !== 0) {
              newPoint[s.id] = ((d[s.id] / baseValue - 1) * 100);
            }
          }
        });

        return newPoint;
      });

      data = normalizedData;
    }

    // Calculate technical indicators
    if (technicalIndicators.length > 0 && !normalized) {
      technicalIndicators.forEach(({ indicatorId, seriesId }) => {
        const targetSeries = series.find(s => s.id === seriesId);
        if (!targetSeries || !targetSeries.data) return;

        // Convert to stock-like format
        const stockData = targetSeries.data.map(d => ({
          date: d.date,
          close: d.value !== undefined ? d.value : d.close || 0,
          high: d.high || d.value || d.close || 0,
          low: d.low || d.value || d.close || 0,
          volume: d.volume || 0,
        }));

        const indicatorData = calculateIndicator(indicatorId, stockData);
        if (indicatorData) {
          data = mergeIndicatorData(data, indicatorData, indicatorId, seriesId);
        }
      });
    }

    setChartData(data);
  }, [series, normalized, technicalIndicators]);

  const mergeIndicatorData = (chartData, indicatorData, indicatorId, seriesId) => {
    const dataMap = new Map(chartData.map(d => [d.date, { ...d }]));

    if (indicatorData.macd) {
      indicatorData.macd.forEach((item, idx) => {
        if (dataMap.has(item.date)) {
          const entry = dataMap.get(item.date);
          entry[`${seriesId}_${indicatorId}_macd`] = item.value;
          entry[`${seriesId}_${indicatorId}_signal`] = indicatorData.signal[idx]?.value || null;
          entry[`${seriesId}_${indicatorId}_histogram`] = indicatorData.histogram[idx]?.value || null;
        }
      });
    } else if (indicatorData.upper) {
      indicatorData.upper.forEach((item, idx) => {
        if (dataMap.has(item.date)) {
          const entry = dataMap.get(item.date);
          entry[`${seriesId}_${indicatorId}_upper`] = item.value;
          entry[`${seriesId}_${indicatorId}_middle`] = indicatorData.middle[idx]?.value || null;
          entry[`${seriesId}_${indicatorId}_lower`] = indicatorData.lower[idx]?.value || null;
        }
      });
    } else if (indicatorData.k) {
      indicatorData.k.forEach((item, idx) => {
        if (dataMap.has(item.date)) {
          const entry = dataMap.get(item.date);
          entry[`${seriesId}_${indicatorId}_k`] = item.value;
          entry[`${seriesId}_${indicatorId}_d`] = indicatorData.d[idx]?.value || null;
        }
      });
    } else {
      indicatorData.forEach(item => {
        if (dataMap.has(item.date)) {
          dataMap.get(item.date)[`${seriesId}_${indicatorId}`] = item.value;
        }
      });
    }

    return Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  };

  const handleAddTechnicalIndicator = (indicator, seriesId) => {
    const exists = technicalIndicators.find(
      ti => ti.indicatorId === indicator.id && ti.seriesId === seriesId
    );
    if (exists) {
      alert('Indicator already added');
      return;
    }

    setTechnicalIndicators([...technicalIndicators, {
      indicatorId: indicator.id,
      seriesId: seriesId,
      name: indicator.name,
      visible: true
    }]);
    setShowTechnicalIndicatorSelector(false);
  };

  const handleRemoveTechnicalIndicator = (indicatorId, seriesId) => {
    setTechnicalIndicators(technicalIndicators.filter(
      ti => !(ti.indicatorId === indicatorId && ti.seriesId === seriesId)
    ));
  };

  const toggleTechnicalIndicatorVisibility = (indicatorId, seriesId) => {
    setTechnicalIndicators(technicalIndicators.map(ti =>
      ti.indicatorId === indicatorId && ti.seriesId === seriesId
        ? { ...ti, visible: !ti.visible }
        : ti
    ));
  };

  const visibleSeries = useMemo(() =>
    series.filter(s => s.visible !== false),
    [series]
  );

  const hasVolume = useMemo(() =>
    visibleSeries.some(s => s.data?.some(d => d.volume !== undefined)),
    [visibleSeries]
  );

  return (
    <div className={WIDGET_STYLES.container}>
      <WidgetHeader
        icon={TrendingUp}
        iconColor={WIDGET_ICON_COLORS.chart}
        title={title}
        subtitle={subtitle}
        loading={loading}
        onRemove={onRemove}
      >
        {onAddSeries && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onAddSeries();
            }}
            className="hover:text-white p-1.5 text-gray-400"
            title="Add Series"
          >
            <Plus size={16} />
          </button>
        )}

        {showTechnicalIndicators && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setShowTechnicalIndicatorSelector(!showTechnicalIndicatorSelector);
            }}
            className="hover:text-white p-1.5 text-gray-400"
            title="Add Technical Indicator"
          >
            <TrendingDown size={16} />
          </button>
        )}
      </WidgetHeader>

      {/* Technical Indicator Selector */}
      {showTechnicalIndicatorSelector && (
        <div className="absolute top-14 right-4 z-50 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-2xl py-2 min-w-[350px] max-h-[500px] overflow-y-auto">
          <div className="px-3 py-2 border-b border-gray-800 sticky top-0 bg-[#1a1a1a]">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white">Technical Indicators</div>
              <button
                onClick={() => setShowTechnicalIndicatorSelector(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {['overlay', 'oscillator', 'separate'].map(type => {
            const indicators = TECHNICAL_INDICATORS.filter(ind => ind.type === type);
            if (indicators.length === 0) return null;

            return (
              <div key={type} className="border-b border-gray-800 last:border-0">
                <div className="px-3 py-2 bg-gray-900/50">
                  <div className="text-xs font-semibold text-gray-400 uppercase">
                    {type === 'overlay' ? 'Price Overlays' : type === 'oscillator' ? 'Oscillators' : 'Separate Pane'}
                  </div>
                </div>
                {visibleSeries.map(s => (
                  <div key={s.id}>
                    <div className="px-3 py-1 bg-gray-800/30">
                      <div className="text-xs text-blue-400">{s.name}</div>
                    </div>
                    {indicators.map(indicator => {
                      const exists = technicalIndicators.some(
                        ti => ti.indicatorId === indicator.id && ti.seriesId === s.id
                      );
                      return (
                        <button
                          key={`${s.id}-${indicator.id}`}
                          onClick={() => handleAddTechnicalIndicator(indicator, s.id)}
                          className={`w-full px-4 py-2 hover:bg-gray-800 transition-colors text-left ${
                            exists ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          disabled={exists}
                        >
                          <div className="text-sm font-medium text-white">{indicator.name}</div>
                          <div className="text-xs text-gray-400">{indicator.description}</div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div className={`${WIDGET_STYLES.content} ${WIDGET_STYLES.contentPadding}`}>
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Left side - empty for now */}
            <div className="flex-1"></div>

            {/* Right side - Controls */}
            <div className="flex items-center gap-2">
              {showTimeRanges && TIME_RANGES.map((range) => (
                <button
                  key={range.id}
                  onClick={() => setTimeRange(range.id)}
                  className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                    timeRange === range.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {range.label}
                </button>
              ))}

              {showTimeRanges && (showNormalize || showVolume) && (
                <div className="w-px h-6 bg-gray-700 mx-1"></div>
              )}

              {showNormalize && (
                <button
                  onClick={() => setNormalized(!normalized)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    normalized ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                  title="Normalize to percentage change"
                >
                  <Percent size={14} />
                  Normalize
                </button>
              )}

              {showVolume && hasVolume && (
                <button
                  onClick={() => setShowVol(!showVol)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    showVol ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                  title="Show volume"
                >
                  Volume
                </button>
              )}
            </div>
          </div>

          {/* Main Chart */}
          <div className="rounded-lg p-4 border border-gray-800" style={{ backgroundColor: CHART_THEME.background }}>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: CHART_THEME.text, fontSize: 11 }}
                    tickFormatter={(date) => formatDate(date)}
                    type="category"
                    allowDuplicatedCategory={false}
                  />
                  <YAxis
                    yAxisId="value"
                    orientation="right"
                    tick={{ fill: CHART_THEME.text, fontSize: 11 }}
                    tickFormatter={(value) => normalized ? `${value.toFixed(0)}%` : formatPrice(value)}
                    domain={['auto', 'auto']}
                  />
                  {showVolume && hasVolume && showVol && (
                    <YAxis
                      yAxisId="volume"
                      orientation="left"
                      tick={{ fill: CHART_THEME.text, fontSize: 11 }}
                      tickFormatter={(value) => formatNumber(value)}
                      domain={[0, 'auto']}
                    />
                  )}
                  <Tooltip
                    contentStyle={{ backgroundColor: CHART_THEME.tooltip.background, border: `1px solid ${CHART_THEME.tooltip.border}` }}
                    labelStyle={{ color: CHART_THEME.tooltip.text }}
                    formatter={(value, name) => {
                      if (name.includes('_volume')) return [formatNumber(value), 'Volume'];
                      return [normalized ? `${value?.toFixed(2) || 'N/A'}%` : formatPrice(value), name];
                    }}
                    labelFormatter={(date) => formatDate(date)}
                  />
                  <Legend />

                  {/* Volume bars */}
                  {showVolume && hasVolume && showVol && visibleSeries.map((s) => (
                    <Bar
                      key={`${s.id}_volume`}
                      yAxisId="volume"
                      dataKey={`${s.id}_volume`}
                      fill={s.color || CHART_COLORS[0]}
                      opacity={0.3}
                      name={`${s.name} Vol`}
                    />
                  ))}

                  {/* Lines for all visible series */}
                  {visibleSeries.map((s) => (
                    <Line
                      key={s.id}
                      yAxisId="value"
                      type="monotone"
                      dataKey={s.id}
                      stroke={s.color || CHART_COLORS[0]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls={true}
                      name={s.name}
                    />
                  ))}

                  {/* Technical Indicators - Overlays */}
                  {!normalized && technicalIndicators.filter(ti => ti.visible).map((indicator) => {
                    const { indicatorId, seriesId } = indicator;

                    if (indicatorId === 'BBANDS') {
                      return (
                        <React.Fragment key={`${seriesId}_${indicatorId}`}>
                          <Line
                            yAxisId="value"
                            type="monotone"
                            dataKey={`${seriesId}_${indicatorId}_upper`}
                            stroke={INDICATOR_COLORS.BBANDS_upper}
                            strokeWidth={1}
                            strokeDasharray="2 2"
                            dot={false}
                            connectNulls={true}
                            name={`${seriesId} BB Upper`}
                          />
                          <Line
                            yAxisId="value"
                            type="monotone"
                            dataKey={`${seriesId}_${indicatorId}_middle`}
                            stroke={INDICATOR_COLORS.BBANDS_middle}
                            strokeWidth={1.5}
                            dot={false}
                            connectNulls={true}
                            name={`${seriesId} BB Middle`}
                          />
                          <Line
                            yAxisId="value"
                            type="monotone"
                            dataKey={`${seriesId}_${indicatorId}_lower`}
                            stroke={INDICATOR_COLORS.BBANDS_lower}
                            strokeWidth={1}
                            strokeDasharray="2 2"
                            dot={false}
                            connectNulls={true}
                            name={`${seriesId} BB Lower`}
                          />
                        </React.Fragment>
                      );
                    }

                    if (['SMA_20', 'SMA_50', 'SMA_200', 'EMA_12', 'EMA_26'].includes(indicatorId)) {
                      return (
                        <Line
                          key={`${seriesId}_${indicatorId}`}
                          yAxisId="value"
                          type="monotone"
                          dataKey={`${seriesId}_${indicatorId}`}
                          stroke={INDICATOR_COLORS[indicatorId]}
                          strokeWidth={1.5}
                          dot={false}
                          connectNulls={true}
                          name={`${seriesId} ${indicator.name}`}
                        />
                      );
                    }

                    return null;
                  })}

                  {normalized && <ReferenceLine yAxisId="value" y={0} stroke={CHART_THEME.text} strokeDasharray="3 3" />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* RSI Oscillator */}
          {!normalized && technicalIndicators.some(ti => ti.indicatorId === 'RSI' && ti.visible) && (
            <div className="rounded-lg p-4 border border-gray-800" style={{ backgroundColor: CHART_THEME.background }}>
              <div className="mb-2">
                <h4 className="text-sm font-semibold text-gray-400">RSI (Relative Strength Index)</h4>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: CHART_THEME.text, fontSize: 11 }}
                      tickFormatter={(date) => formatDate(date)}
                      type="category"
                    />
                    <YAxis
                      tick={{ fill: CHART_THEME.text, fontSize: 11 }}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: CHART_THEME.tooltip.background, border: `1px solid ${CHART_THEME.tooltip.border}` }}
                      labelStyle={{ color: CHART_THEME.tooltip.text }}
                      labelFormatter={(date) => formatDate(date)}
                    />
                    <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Overbought', fill: '#ef4444', fontSize: 10 }} />
                    <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="3 3" label={{ value: 'Oversold', fill: '#22c55e', fontSize: 10 }} />
                    {technicalIndicators.filter(ti => ti.indicatorId === 'RSI' && ti.visible).map(indicator => (
                      <Line
                        key={`${indicator.seriesId}_RSI`}
                        type="monotone"
                        dataKey={`${indicator.seriesId}_RSI`}
                        stroke={INDICATOR_COLORS.RSI}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={true}
                        name={`${indicator.seriesId} RSI`}
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* MACD Oscillator */}
          {!normalized && technicalIndicators.some(ti => ti.indicatorId === 'MACD' && ti.visible) && (
            <div className="rounded-lg p-4 border border-gray-800" style={{ backgroundColor: CHART_THEME.background }}>
              <div className="mb-2">
                <h4 className="text-sm font-semibold text-gray-400">MACD (Moving Average Convergence Divergence)</h4>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: CHART_THEME.text, fontSize: 11 }}
                      tickFormatter={(date) => formatDate(date)}
                      type="category"
                    />
                    <YAxis
                      tick={{ fill: CHART_THEME.text, fontSize: 11 }}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: CHART_THEME.tooltip.background, border: `1px solid ${CHART_THEME.tooltip.border}` }}
                      labelStyle={{ color: CHART_THEME.tooltip.text }}
                      labelFormatter={(date) => formatDate(date)}
                    />
                    <ReferenceLine y={0} stroke={CHART_THEME.text} strokeDasharray="3 3" />
                    {technicalIndicators.filter(ti => ti.indicatorId === 'MACD' && ti.visible).map(indicator => (
                      <React.Fragment key={`${indicator.seriesId}_MACD`}>
                        <Bar
                          dataKey={`${indicator.seriesId}_MACD_histogram`}
                          fill={INDICATOR_COLORS.MACD}
                          opacity={0.3}
                          name={`${indicator.seriesId} Histogram`}
                        />
                        <Line
                          type="monotone"
                          dataKey={`${indicator.seriesId}_MACD_macd`}
                          stroke={INDICATOR_COLORS.MACD}
                          strokeWidth={2}
                          dot={false}
                          connectNulls={true}
                          name={`${indicator.seriesId} MACD`}
                        />
                        <Line
                          type="monotone"
                          dataKey={`${indicator.seriesId}_MACD_signal`}
                          stroke={INDICATOR_COLORS.MACD_signal}
                          strokeWidth={2}
                          dot={false}
                          connectNulls={true}
                          name={`${indicator.seriesId} Signal`}
                        />
                      </React.Fragment>
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Stochastic Oscillator */}
          {!normalized && technicalIndicators.some(ti => ti.indicatorId === 'STOCH' && ti.visible) && (
            <div className="rounded-lg p-4 border border-gray-800" style={{ backgroundColor: CHART_THEME.background }}>
              <div className="mb-2">
                <h4 className="text-sm font-semibold text-gray-400">Stochastic Oscillator</h4>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: CHART_THEME.text, fontSize: 11 }}
                      tickFormatter={(date) => formatDate(date)}
                      type="category"
                    />
                    <YAxis
                      tick={{ fill: CHART_THEME.text, fontSize: 11 }}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: CHART_THEME.tooltip.background, border: `1px solid ${CHART_THEME.tooltip.border}` }}
                      labelStyle={{ color: CHART_THEME.tooltip.text }}
                      labelFormatter={(date) => formatDate(date)}
                    />
                    <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Overbought', fill: '#ef4444', fontSize: 10 }} />
                    <ReferenceLine y={20} stroke="#22c55e" strokeDasharray="3 3" label={{ value: 'Oversold', fill: '#22c55e', fontSize: 10 }} />
                    {technicalIndicators.filter(ti => ti.indicatorId === 'STOCH' && ti.visible).map(indicator => (
                      <React.Fragment key={`${indicator.seriesId}_STOCH`}>
                        <Line
                          type="monotone"
                          dataKey={`${indicator.seriesId}_STOCH_k`}
                          stroke={INDICATOR_COLORS.STOCH}
                          strokeWidth={2}
                          dot={false}
                          connectNulls={true}
                          name={`${indicator.seriesId} %K`}
                        />
                        <Line
                          type="monotone"
                          dataKey={`${indicator.seriesId}_STOCH_d`}
                          stroke={INDICATOR_COLORS.STOCH_signal}
                          strokeWidth={2}
                          dot={false}
                          connectNulls={true}
                          name={`${indicator.seriesId} %D`}
                        />
                      </React.Fragment>
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ATR (Average True Range) */}
          {!normalized && technicalIndicators.some(ti => ti.indicatorId === 'ATR' && ti.visible) && (
            <div className="rounded-lg p-4 border border-gray-800" style={{ backgroundColor: CHART_THEME.background }}>
              <div className="mb-2">
                <h4 className="text-sm font-semibold text-gray-400">ATR (Average True Range)</h4>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: CHART_THEME.text, fontSize: 11 }}
                      tickFormatter={(date) => formatDate(date)}
                      type="category"
                    />
                    <YAxis
                      tick={{ fill: CHART_THEME.text, fontSize: 11 }}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: CHART_THEME.tooltip.background, border: `1px solid ${CHART_THEME.tooltip.border}` }}
                      labelStyle={{ color: CHART_THEME.tooltip.text }}
                      labelFormatter={(date) => formatDate(date)}
                    />
                    {technicalIndicators.filter(ti => ti.indicatorId === 'ATR' && ti.visible).map(indicator => (
                      <Line
                        key={`${indicator.seriesId}_ATR`}
                        type="monotone"
                        dataKey={`${indicator.seriesId}_ATR`}
                        stroke={INDICATOR_COLORS.ATR}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={true}
                        name={`${indicator.seriesId} ATR`}
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* OBV (On Balance Volume) */}
          {!normalized && technicalIndicators.some(ti => ti.indicatorId === 'OBV' && ti.visible) && (
            <div className="rounded-lg p-4 border border-gray-800" style={{ backgroundColor: CHART_THEME.background }}>
              <div className="mb-2">
                <h4 className="text-sm font-semibold text-gray-400">OBV (On Balance Volume)</h4>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: CHART_THEME.text, fontSize: 11 }}
                      tickFormatter={(date) => formatDate(date)}
                      type="category"
                    />
                    <YAxis
                      tick={{ fill: CHART_THEME.text, fontSize: 11 }}
                      domain={['auto', 'auto']}
                      tickFormatter={(value) => formatNumber(value)}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: CHART_THEME.tooltip.background, border: `1px solid ${CHART_THEME.tooltip.border}` }}
                      labelStyle={{ color: CHART_THEME.tooltip.text }}
                      labelFormatter={(date) => formatDate(date)}
                      formatter={(value) => formatNumber(value)}
                    />
                    {technicalIndicators.filter(ti => ti.indicatorId === 'OBV' && ti.visible).map(indicator => (
                      <Line
                        key={`${indicator.seriesId}_OBV`}
                        type="monotone"
                        dataKey={`${indicator.seriesId}_OBV`}
                        stroke={INDICATOR_COLORS.OBV}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={true}
                        name={`${indicator.seriesId} OBV`}
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Series Legend - Moved to bottom */}
          <div className="flex items-center gap-2 flex-wrap pt-4 border-t border-gray-800">
            {visibleSeries.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-gray-800/50 border-gray-700"
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color || CHART_COLORS[0] }} />
                <span className="text-sm font-medium">{s.name}</span>
              </div>
            ))}

            {/* Technical Indicator Chips */}
            {technicalIndicators.map((indicator) => (
              <div
                key={`${indicator.seriesId}_${indicator.indicatorId}`}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                  !indicator.visible ? 'opacity-40 bg-gray-800/30 border-gray-700' : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full cursor-pointer"
                  style={{ backgroundColor: INDICATOR_COLORS[indicator.indicatorId] || '#888' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTechnicalIndicatorVisibility(indicator.indicatorId, indicator.seriesId);
                  }}
                />
                <span className="text-sm font-medium flex items-center gap-1">
                  <TrendingDown size={12} />
                  {indicator.seriesId} - {indicator.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTechnicalIndicator(indicator.indicatorId, indicator.seriesId);
                  }}
                  className="hover:text-red-400 ml-1"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UniversalChartWidget;
