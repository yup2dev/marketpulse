/**
 * Fed Balance Sheet Widget - QE/QT Liquidity Monitor
 * Shows Federal Reserve total assets (WALCL) with expansion/contraction regimes
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Landmark } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import BaseWidget from '../common/BaseWidget';
import WidgetTable from '../common/WidgetTable';
import { API_BASE } from '../../../config/api';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-[#1a1a1f] border border-gray-700 rounded px-3 py-2 shadow-lg text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      <p className="text-cyan-400">${payload[0]?.value?.toFixed(2)}T</p>
    </div>
  );
};

const REGIME_COLOR = { expanding: '#22c55e', contracting: '#ef4444' };

const TABLE_COLUMNS = [
  {
    key: 'date',
    header: 'Date',
    sortable: true,
    sortValue: (row) => row.date,
    render: (row) => <span className="text-gray-300">{row.date}</span>,
  },
  {
    key: 'value',
    header: 'Total Assets ($T)',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.value ?? -Infinity,
    exportValue: (row) => row.value?.toFixed(3) ?? '',
    render: (row) => (
      <span className="text-cyan-400">${row.value?.toFixed(3)}T</span>
    ),
  },
  {
    key: 'chgWoW',
    header: 'Chg WoW',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.chgWoW ?? -Infinity,
    exportValue: (row) => row.chgWoW != null ? row.chgWoW.toFixed(3) : '',
    render: (row) => (
      <span className={row.chgWoW == null ? '' : row.chgWoW >= 0 ? 'text-green-400' : 'text-red-400'}>
        {row.chgWoW != null ? `${row.chgWoW >= 0 ? '+' : ''}${row.chgWoW.toFixed(3)}T` : '-'}
      </span>
    ),
  },
];

export default function FedBalanceSheetWidget({ onRemove }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('chart');
  const [period,  setPeriod]  = useState('10y');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/fed-balance-sheet?period=${period}`);
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error('Fed Balance Sheet fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { loadData(); }, [loadData]);

  const formatDate = (s) => {
    const d = new Date(s);
    return d.toLocaleDateString('en-US', { year: '2-digit', month: 'short' });
  };

  const latest = data?.latest;
  const peak   = data?.peak;
  const currentRegime = data?.regimes?.length ? data.regimes[data.regimes.length - 1] : null;

  const tableData = useMemo(() => {
    const rows = [...(data?.series || [])].reverse().slice(0, 52);
    return rows.map((r, i) => {
      const prev = rows[i + 1];
      return { ...r, _key: i, chgWoW: prev ? r.value - prev.value : null };
    });
  }, [data]);

  const renderChart = () => {
    const series = data?.series || [];
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="bsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={{ stroke: '#374151' }} />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={{ stroke: '#374151' }}
            tickFormatter={v => `$${v.toFixed(0)}T`}
            width={42}
          />
          <Tooltip content={<CustomTooltip />} />
          {peak && (
            <ReferenceLine
              x={peak.date}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              label={{ value: `Peak $${peak.value.toFixed(1)}T`, fill: '#f59e0b', fontSize: 9, position: 'insideTopRight' }}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            name="Fed Assets"
            stroke="#06b6d4"
            fill="url(#bsGradient)"
            strokeWidth={1.5}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  const regimeLabel = currentRegime?.type === 'expanding' ? 'QE (Expanding)'
    : currentRegime?.type === 'contracting' ? 'QT (Contracting)' : null;
  const regimeColor = currentRegime ? REGIME_COLOR[currentRegime.type] : '#9ca3af';

  return (
    <BaseWidget
      title="Fed Balance Sheet — QE / QT Monitor"
      subtitle={latest ? `$${latest.value.toFixed(2)}T · ${regimeLabel || ''}` : undefined}
      icon={Landmark}
      iconColor="text-cyan-400"
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      period={period}
      onPeriodChange={setPeriod}
      periodType="macro"
      source={data?.source}
    >
      {regimeLabel && (
        <div className="px-3 pb-1 flex gap-2 items-center">
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded border"
            style={{ color: regimeColor, borderColor: regimeColor + '60', backgroundColor: regimeColor + '15' }}
          >
            {regimeLabel}
          </span>
          {peak && (
            <span className="text-[10px] text-gray-500">
              Peak: ${peak.value.toFixed(2)}T ({peak.date})
            </span>
          )}
        </div>
      )}
      <div className="h-full p-3">
        {viewMode === 'chart' ? renderChart() : (
          <div className="h-full overflow-auto">
            <WidgetTable
              columns={TABLE_COLUMNS}
              data={tableData}
              resizable={true}
              size="compact"
              showExport={true}
              exportFilename="fed-balance-sheet"
              defaultSortKey="date"
              defaultSortDirection="desc"
            />
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
