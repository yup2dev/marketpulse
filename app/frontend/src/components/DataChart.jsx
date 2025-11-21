import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const DataChart = ({ data = [], chartType = 'line', xKey, yKeys = [], colors }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-tertiary">
        No data available
      </div>
    );
  }

  const defaultColors = ['#00d9ff', '#3fb950', '#f85149', '#d29922', '#7c3aed'];
  const chartColors = colors || defaultColors;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background-secondary border border-gray-700 rounded-lg p-3 shadow-xl">
          <p className="text-xs text-text-secondary mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 10, right: 30, left: 0, bottom: 0 },
    };

    const axisProps = {
      stroke: '#6e7681',
      style: { fontSize: '11px' },
    };

    switch (chartType) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '11px' }}
              iconType="circle"
            />
            {yKeys.map((key, idx) => (
              <Bar
                key={key}
                dataKey={key}
                fill={chartColors[idx % chartColors.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <defs>
              {yKeys.map((key, idx) => (
                <linearGradient key={key} id={`gradient-${idx}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors[idx % chartColors.length]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chartColors[idx % chartColors.length]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '11px' }}
              iconType="circle"
            />
            {yKeys.map((key, idx) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={chartColors[idx % chartColors.length]}
                fill={`url(#gradient-${idx})`}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        );

      case 'line':
      default:
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '11px' }}
              iconType="circle"
            />
            {yKeys.map((key, idx) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={chartColors[idx % chartColors.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        );
    }
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      {renderChart()}
    </ResponsiveContainer>
  );
};

export default DataChart;
