/**
 * CommonChart — unified recharts wrapper for all standard chart types.
 *
 * Supported types: 'line' | 'area' | 'bar' | 'stackedBar' | 'pie' | 'donut'
 *
 * Data format (multi-series):
 *   data    = [{ [xKey]: 'Jan', seriesA: 10, seriesB: 20 }, ...]
 *   series  = [{ key: 'seriesA', name: 'Series A', color: '#3b82f6' }, ...]
 *
 * For pie/donut the first series is used as the value; xKey rows become slices.
 */
import {
  LineChart, Line,
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { CHART_COLORS } from '../widgets/constants';
import ChartTypeSelector from './ChartTypeSelector';

// ── Shared recharts style tokens ──────────────────────────────────────────────
const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: '#1a1a1f',
    border: '1px solid #374151',
    borderRadius: '6px',
    fontSize: 11,
  },
  labelStyle: { color: '#9ca3af', fontSize: 11 },
  itemStyle:  { fontSize: 11 },
};

const AXIS_TICK = { fill: '#6b7280', fontSize: 10 };
const AXIS_LINE = { stroke: '#374151' };
const GRID_PROPS = { strokeDasharray: '3 3', stroke: '#1f2937' };
const LEGEND_STYLE = { fontSize: 10, color: '#9ca3af' };
const CHART_MARGIN = { top: 8, right: 12, left: 0, bottom: 0 };

// ── Main Component ────────────────────────────────────────────────────────────
export default function CommonChart({
  data = [],
  series = [],
  xKey = 'x',
  type = 'line',
  onTypeChange,
  height = 280,
  fillContainer = false,   // when true, ignores height and uses h-full
  showTypeSelector = true,
  allowedTypes,            // string[] restricts which types appear in selector
  compact = false,         // hides legend when true
  xFormatter,
  yFormatter,
  tooltipFormatter,
  referenceLines = [],     // [{ y, label?, color? }] — drawn on cartesian charts
}) {
  const resolvedColors = series.map((s, i) => s.color || CHART_COLORS[i % CHART_COLORS.length]);

  // ── Shared axis / grid elements ──────────────────────────────────────────
  const commonElements = (
    <>
      <CartesianGrid {...GRID_PROPS} />
      <XAxis
        dataKey={xKey}
        tick={AXIS_TICK}
        axisLine={AXIS_LINE}
        tickLine={false}
        tickFormatter={xFormatter}
      />
      <YAxis
        tick={AXIS_TICK}
        axisLine={AXIS_LINE}
        tickLine={false}
        tickFormatter={yFormatter}
        width={yFormatter ? 48 : 36}
      />
      <Tooltip
        {...TOOLTIP_STYLE}
        formatter={tooltipFormatter}
        isAnimationActive={false}
      />
      {!compact && (
        <Legend wrapperStyle={LEGEND_STYLE} iconSize={8} />
      )}
      {referenceLines.map((rl, i) => (
        <ReferenceLine
          key={i}
          y={rl.y}
          stroke={rl.color || '#6b7280'}
          strokeDasharray="4 4"
          label={rl.label ? { value: rl.label, fill: rl.color || '#6b7280', fontSize: 9, position: 'insideTopLeft' } : undefined}
        />
      ))}
    </>
  );

  // ── Per-type series elements ─────────────────────────────────────────────
  const lineElements = series.map((s, i) => (
    <Line
      key={s.key}
      type="monotone"
      dataKey={s.key}
      name={s.name || s.key}
      stroke={resolvedColors[i]}
      strokeWidth={2}
      dot={false}
      isAnimationActive={false}
    />
  ));

  const areaElements = series.map((s, i) => (
    <Area
      key={s.key}
      type="monotone"
      dataKey={s.key}
      name={s.name || s.key}
      stroke={resolvedColors[i]}
      fill={resolvedColors[i] + '28'}
      strokeWidth={2}
      dot={false}
      isAnimationActive={false}
    />
  ));

  const barElements = (stacked) =>
    series.map((s, i) => (
      <Bar
        key={s.key}
        dataKey={s.key}
        name={s.name || s.key}
        fill={resolvedColors[i]}
        stackId={stacked ? 'stack' : undefined}
        maxBarSize={48}
        isAnimationActive={false}
      />
    ));

  // ── Build chart node ─────────────────────────────────────────────────────
  let chartNode;

  if (type === 'pie' || type === 'donut') {
    // For pie/donut: each row in `data` becomes a slice; first series = value
    const firstKey = series[0]?.key ?? Object.keys(data[0] || {}).find(k => k !== xKey) ?? 'value';
    const pieData = data.map((row, i) => ({
      name:  xFormatter ? xFormatter(row[xKey]) : String(row[xKey]),
      value: Number(row[firstKey]) || 0,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
    const total = pieData.reduce((s, d) => s + d.value, 0);
    const innerRadius = type === 'donut' ? '52%' : 0;

    // Outer label showing name + pct for slices ≥ 5%
    const renderLabel = ({ cx, cy, midAngle, outerRadius, name, percent }) => {
      if (percent < 0.05) return null;
      const RADIAN = Math.PI / 180;
      const r = outerRadius + 14;
      const x = cx + r * Math.cos(-midAngle * RADIAN);
      const y = cy + r * Math.sin(-midAngle * RADIAN);
      return (
        <text
          x={x} y={y}
          fill="#9ca3af"
          textAnchor={x > cx ? 'start' : 'end'}
          dominantBaseline="central"
          fontSize={9}
        >
          {name}
        </text>
      );
    };

    chartNode = (
      <PieChart margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <Pie
          data={pieData}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius="65%"
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
          label={renderLabel}
          labelLine={{ stroke: '#374151', strokeWidth: 1 }}
          isAnimationActive={false}
        >
          {pieData.map((d, i) => (
            <Cell key={i} fill={d.color} stroke="none" />
          ))}
        </Pie>
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(v, name) => {
            const pct = total > 0 ? ((v / total) * 100).toFixed(1) : '0';
            const formatted = tooltipFormatter ? tooltipFormatter(v, name)[0] : v;
            return [`${formatted} (${pct}%)`, name];
          }}
        />
      </PieChart>
    );
  } else if (type === 'area') {
    chartNode = (
      <AreaChart data={data} margin={CHART_MARGIN}>
        {commonElements}
        {areaElements}
      </AreaChart>
    );
  } else if (type === 'bar') {
    chartNode = (
      <BarChart data={data} margin={CHART_MARGIN}>
        {commonElements}
        {barElements(false)}
      </BarChart>
    );
  } else if (type === 'stackedBar') {
    chartNode = (
      <BarChart data={data} margin={CHART_MARGIN}>
        {commonElements}
        {barElements(true)}
      </BarChart>
    );
  } else {
    // default: line
    chartNode = (
      <LineChart data={data} margin={CHART_MARGIN}>
        {commonElements}
        {lineElements}
      </LineChart>
    );
  }

  const wrapperCls = `relative w-full ${fillContainer ? 'h-full' : ''}`;
  const wrapperStyle = fillContainer ? undefined : { height };

  return (
    <div className={wrapperCls} style={wrapperStyle}>
      {/* Type selector — top-right overlay */}
      {showTypeSelector && onTypeChange && (
        <div className="absolute top-0 right-0 z-10">
          <ChartTypeSelector
            value={type}
            onChange={onTypeChange}
            types={allowedTypes}
          />
        </div>
      )}

      <ResponsiveContainer width="100%" height="100%">
        {chartNode}
      </ResponsiveContainer>
    </div>
  );
}
