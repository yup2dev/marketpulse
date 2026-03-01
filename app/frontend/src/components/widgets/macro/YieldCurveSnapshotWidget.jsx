/**
 * Yield Curve Snapshot Widget - Current yield curve shape with spreads
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import BaseWidget from '../common/BaseWidget';
import WidgetTable from '../common/WidgetTable';
import { API_BASE } from '../../../config/api';

const SHAPE_COLORS = {
  normal:   { text: 'text-green-400',  bg: 'bg-green-500/20 border-green-500/30'   },
  flat:     { text: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/30' },
  inverted: { text: 'text-red-400',    bg: 'bg-red-500/20 border-red-500/30'       },
  humped:   { text: 'text-blue-400',   bg: 'bg-blue-500/20 border-blue-500/30'     },
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a1f] border border-gray-700 rounded px-3 py-2 shadow-lg">
        <p className="text-gray-400 text-xs mb-1">{label}</p>
        <p className="text-sm text-blue-400">
          Yield: {typeof payload[0].value === 'number' ? payload[0].value.toFixed(2) : payload[0].value}%
        </p>
      </div>
    );
  }
  return null;
};

const CURVE_COLUMNS = [
  {
    key: 'maturity',
    header: 'Maturity',
    sortable: true,
    sortValue: (row) => row.years ?? 0,
    render: (row) => <span className="font-medium text-white">{row.maturity}</span>,
  },
  {
    key: 'yield',
    header: 'Yield',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.yield ?? -Infinity,
    exportValue: (row) => row.yield?.toFixed(2) ?? '',
    render: (row) => <span className="text-white">{row.yield?.toFixed(2)}%</span>,
  },
  {
    key: 'years',
    header: 'Years',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.years ?? -Infinity,
    render: (row) => <span className="text-gray-400">{row.years}</span>,
  },
];

export default function YieldCurveSnapshotWidget({ onRemove }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('chart');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/yield-curve`);
      if (res.ok) setData(await res.json());
    } catch (error) {
      console.error('Error loading yield curve:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const curveData = useMemo(() =>
    (data?.curve || []).map((item, i) => ({ ...item, _key: i })),
    [data]
  );

  const renderChart = () => {
    if (!data?.curve) return null;
    const shapeStyle = SHAPE_COLORS[data.curve_shape] || SHAPE_COLORS.normal;
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-3 px-1 pb-2 flex-shrink-0 flex-wrap">
          <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${shapeStyle.bg} ${shapeStyle.text}`}>
            {(data.curve_shape || 'normal').toUpperCase()}
          </span>
          {data.spreads && Object.entries(data.spreads).map(([key, value]) => (
            <span key={key} className="text-xs text-gray-400 flex items-center gap-1">
              {key.toUpperCase()}:
              <span className={`font-medium ${value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {value >= 0 ? '+' : ''}{value?.toFixed(2)}%
              </span>
            </span>
          ))}
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.curve} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="yieldSnapGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="maturity" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="yield" stroke="#3b82f6" fill="url(#yieldSnapGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderTable = () => {
    if (!data?.curve) return null;
    return (
      <div className="h-full flex flex-col overflow-auto">
        <WidgetTable
          columns={CURVE_COLUMNS}
          data={curveData}
          resizable={true}
          size="compact"
          showExport={true}
          exportFilename="yield-curve"
          defaultSortKey="years"
          defaultSortDirection="asc"
        />
        {/* Spreads section */}
        {data.spreads && (
          <div className="border-t border-gray-800 mt-1">
            <div className="px-3 py-2 text-xs text-gray-400">Key Spreads</div>
            <div className="px-3 pb-2 flex flex-col gap-1">
              {Object.entries(data.spreads).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="text-white">{key.toUpperCase()}</span>
                  <span className={`flex items-center gap-1 ${value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {value >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {value >= 0 ? '+' : ''}{value?.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <BaseWidget
      title="Yield Curve"
      icon={TrendingUp}
      iconColor="text-blue-400"
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      showPeriodSelector={false}
      source="U.S. Treasury"
    >
      <div className="h-full p-3">
        {viewMode === 'chart' ? renderChart() : renderTable()}
      </div>
    </BaseWidget>
  );
}
