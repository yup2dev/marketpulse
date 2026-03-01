/**
 * Inflation Decomposition Widget - CPI components breakdown
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp, TrendingDown, Flame } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import BaseWidget from '../common/BaseWidget';
import WidgetTable from '../common/WidgetTable';
import { API_BASE } from '../../../config/api';

const getInflationColor = (value) => {
  if (value >= 3) return '#ef4444';
  if (value >= 1.5) return '#f59e0b';
  return '#10b981';
};

const getInflationTextColor = (value) => {
  if (value >= 3) return 'text-red-400';
  if (value >= 2) return 'text-yellow-400';
  return 'text-green-400';
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a1f] border border-gray-700 rounded px-3 py-2 shadow-lg">
        <p className="text-gray-400 text-xs mb-1">{label}</p>
        <p className="text-sm text-white">
          YoY: {typeof payload[0].value === 'number' ? payload[0].value.toFixed(2) : payload[0].value}%
        </p>
      </div>
    );
  }
  return null;
};

const COLUMNS = [
  {
    key: 'category',
    header: 'Category',
    sortable: true,
    sortValue: (row) => row.category || '',
    render: (row) => <span className="font-medium text-white">{row.category}</span>,
  },
  {
    key: 'weight',
    header: 'Weight',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.weight ?? -Infinity,
    exportValue: (row) => row.weight?.toFixed(1) ?? '',
    render: (row) => <span className="text-gray-400">{row.weight?.toFixed(1)}%</span>,
  },
  {
    key: 'yoy_change',
    header: 'YoY Change',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.yoy_change ?? -Infinity,
    exportValue: (row) => row.yoy_change?.toFixed(2) ?? '',
    render: (row) => (
      <span className={`flex items-center justify-end gap-1 ${(row.yoy_change ?? 0) >= 0 ? 'text-red-400' : 'text-green-400'}`}>
        {(row.yoy_change ?? 0) >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        {row.yoy_change?.toFixed(2)}%
      </span>
    ),
  },
  {
    key: 'contribution',
    header: 'Contribution',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.contribution ?? -Infinity,
    exportValue: (row) => row.contribution?.toFixed(2) ?? '',
    render: (row) => <span className="text-blue-400">{row.contribution?.toFixed(2)}%</span>,
  },
];

export default function InflationDecompWidget({ onRemove }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('chart');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/inflation/decomposition`);
      if (res.ok) setData(await res.json());
    } catch (error) {
      console.error('Error loading inflation data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const tableData = useMemo(() =>
    (data?.components || []).map((item, i) => ({ ...item, _key: i })),
    [data]
  );

  const renderChart = () => {
    if (!data) return null;
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-4 px-1 pb-2 flex-shrink-0">
          {data.headline_cpi && (
            <span className="text-xs text-gray-400">
              Headline CPI:{' '}
              <span className={`font-medium ${getInflationTextColor(data.headline_cpi.yoy)}`}>
                {data.headline_cpi.yoy?.toFixed(2)}%
              </span>
            </span>
          )}
          {data.core_cpi && (
            <span className="text-xs text-gray-400">
              Core CPI:{' '}
              <span className={`font-medium ${getInflationTextColor(data.core_cpi.yoy)}`}>
                {data.core_cpi.yoy?.toFixed(2)}%
              </span>
            </span>
          )}
        </div>
        <div className="flex-1 min-h-0">
          {data.components ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.components} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="category" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} tickFormatter={(v) => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={2} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: '2% Target', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
                <Bar dataKey="yoy_change" radius={[4, 4, 0, 0]}>
                  {data.components.map((entry, idx) => (
                    <Cell key={idx} fill={getInflationColor(entry.yoy_change)} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">No component data</div>
          )}
        </div>
      </div>
    );
  };

  const renderTable = () => {
    if (!data) return null;
    return (
      <div className="h-full flex flex-col overflow-auto">
        <WidgetTable
          columns={COLUMNS}
          data={tableData}
          resizable={true}
          size="compact"
          showExport={true}
          exportFilename="inflation-decomp"
          defaultSortKey="contribution"
          defaultSortDirection="desc"
          emptyMessage="No component data"
        />
        {data.expectations && (
          <div className="border-t border-gray-800 shrink-0">
            <div className="px-3 py-2 text-xs text-gray-400">Inflation Expectations (Breakeven)</div>
            <div className="px-3 pb-3 flex flex-col gap-1">
              {[
                { label: '5-Year Forward',  val: data.expectations['5y_breakeven']  },
                { label: '10-Year Forward', val: data.expectations['10y_breakeven'] },
              ].map(({ label, val }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span className="text-white">{label}</span>
                  <span className="text-white tabular-nums">{val?.toFixed(2) ?? '-'}%</span>
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
      title="Inflation Decomposition"
      icon={Flame}
      iconColor="text-orange-400"
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      showPeriodSelector={false}
      source="BLS / FRED"
    >
      <div className="h-full p-3">
        {viewMode === 'chart' ? renderChart() : renderTable()}
      </div>
    </BaseWidget>
  );
}
