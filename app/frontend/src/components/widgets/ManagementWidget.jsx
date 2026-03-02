/**
 * ManagementWidget - Executive Team & Governance Risk
 */
import { useState, useEffect, useCallback } from 'react';
import { Users } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import WidgetTable from './common/WidgetTable';
import { API_BASE } from './constants';

const GOVERNANCE_KEYS = [
  { key: 'audit_risk',             label: 'Audit Risk' },
  { key: 'board_risk',             label: 'Board Risk' },
  { key: 'compensation_risk',      label: 'Compensation Risk' },
  { key: 'shareholder_rights_risk',label: 'Shareholder Rights' },
  { key: 'overall_risk',           label: 'Overall Risk' },
];

// 1-10 스케일 → 점수용 색상 (낮을수록 양호)
function riskColor(v) {
  if (!v) return '#6b7280';
  if (v <= 3) return '#22c55e';
  if (v <= 7) return '#eab308';
  return '#ef4444';
}

const OFFICER_COLUMNS = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'title', header: 'Title', sortable: true },
  { key: 'age', header: 'Age', sortable: true, align: 'center' },
  {
    key: 'total_pay',
    header: 'Total Pay',
    sortable: true,
    sortValue: (row) => row.total_pay ?? -Infinity,
    render: (row) => row.total_pay ? `$${(row.total_pay / 1e6).toFixed(1)}M` : 'N/A',
    align: 'right',
  },
  { key: 'year_born', header: 'Born', sortable: true, align: 'center' },
];

export default function ManagementWidget({ symbol, onRemove }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('team');

  const load = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/management/${symbol}`);
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error('ManagementWidget error:', e);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { load(); }, [load]);

  const officers = data?.officers || [];
  const gov = data?.governance || {};

  return (
    <BaseWidget
      title="Management"
      icon={Users}
      iconColor="text-purple-400"
      loading={loading}
      onRefresh={load}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
      source="Yahoo Finance"
    >
      {/* Sub-tabs */}
      <div className="flex border-b border-gray-800 px-3 pt-1">
        {[{ id: 'team', label: 'Executive Team' }, { id: 'governance', label: 'Governance Risk' }].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-[11px] font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-purple-400 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-3">
        {tab === 'team' && (
          officers.length > 0
            ? <WidgetTable columns={OFFICER_COLUMNS} rows={officers} resizable />
            : <div className="text-center text-gray-500 text-xs py-8">No officer data available</div>
        )}

        {tab === 'governance' && (
          Object.values(gov).every(v => v == null)
            ? <div className="text-center text-gray-500 text-xs py-8">No governance data available</div>
            : (() => {
                const bars = GOVERNANCE_KEYS.map(({ key, label }) => ({ label, value: gov[key] })).filter(b => b.value != null);
                return (
                  <div className="h-full flex flex-col" style={{ minHeight: '160px' }}>
                    <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-2">1 = Low · 10 = High Risk</p>
                    <div className="flex justify-around mb-1">
                      {bars.map(b => (
                        <span key={b.label} className="text-[9px] font-medium tabular-nums flex-1 text-center" style={{ color: riskColor(b.value) }}>
                          {b.value}/10
                        </span>
                      ))}
                    </div>
                    <div className="flex-1 flex items-end justify-around gap-2 min-h-0">
                      {bars.map(b => (
                        <div key={b.label} className="flex-1 flex justify-center items-end h-full">
                          <div
                            className="w-full max-w-[36px] rounded-t transition-all duration-700"
                            style={{ height: `${b.value / 10 * 100}%`, backgroundColor: riskColor(b.value), minHeight: '3px' }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-around border-t border-gray-800 pt-1.5 mt-1">
                      {bars.map(b => (
                        <span key={b.label} className="text-[8px] text-gray-500 text-center flex-1 leading-tight">{b.label.replace(' Risk', '')}</span>
                      ))}
                    </div>
                  </div>
                );
              })()
        )}
      </div>
    </BaseWidget>
  );
}
