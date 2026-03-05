/**
 * Fed Balance Sheet Widget - QE/QT Liquidity Monitor
 * Shows Federal Reserve total assets (WALCL) with expansion/contraction regimes
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Landmark } from 'lucide-react';
import CommonChart from '../../common/CommonChart';
import BaseWidget from '../common/BaseWidget';
import CommonTable from '../../common/CommonTable';
import { API_BASE } from '../../../config/api';

const REGIME_COLOR = { expanding: '#22c55e', contracting: '#ef4444' };

const TABLE_COLUMNS = [
  {
    key: 'date',
    header: 'Date',
    sortable: true,
    renderFn: (value, row) => <span className="text-gray-300">{row.date}</span>,
  },
  {
    key: 'value',
    header: 'Total Assets ($T)',
    align: 'right',
    sortable: true,
    renderFn: (value, row) => (
      <span className="text-cyan-400">${row.value?.toFixed(3)}T</span>
    ),
  },
  {
    key: 'chgWoW',
    header: 'Chg WoW',
    align: 'right',
    sortable: true,
    renderFn: (value, row) => (
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
    const refLines = peak
      ? [{ value: undefined, x: peak.date, color: '#f59e0b', label: `Peak $${peak.value.toFixed(1)}T` }]
      : [];
    return (
      <CommonChart
        data={series}
        series={[{ key: 'value', name: 'Fed Assets', color: '#06b6d4' }]}
        xKey="date"
        type="area"
        fillContainer={true}
        showTypeSelector={false}
        xFormatter={formatDate}
        yFormatter={(v) => `$${Number(v).toFixed(0)}T`}
        tooltipFormatter={(v) => `$${Number(v).toFixed(2)}T`}
        referenceLines={refLines}
      />
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
            <CommonTable
              columns={TABLE_COLUMNS}
              data={tableData}
              compact={true}
              searchable={false}
              exportable={true}
              pageSize={20}
            />
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
