/**
 * SWOTWidget - Data-driven SWOT analysis
 */
import { useState, useEffect, useCallback } from 'react';
import { Grid3X3 } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import WidgetTable from './common/WidgetTable';
import { API_BASE } from './constants';

const QUADRANT_CONFIG = [
  { key: 'strengths',     label: 'Strengths',    color: '#22c55e', textClass: 'text-green-400'  },
  { key: 'weaknesses',    label: 'Weaknesses',   color: '#ef4444', textClass: 'text-red-400'    },
  { key: 'opportunities', label: 'Opportunities',color: '#3b82f6', textClass: 'text-blue-400'   },
  { key: 'threats',       label: 'Threats',      color: '#f97316', textClass: 'text-orange-400' },
];

const COLUMNS = [
  {
    key: 'category',
    header: 'Category',
    sortable: true,
    sortValue: (row) => row._order,
    render: (row) => <span className={`font-medium text-xs ${row._textClass}`}>{row.category}</span>,
    exportValue: (row) => row.category,
  },
  {
    key: 'label',
    header: 'Item',
    render: (row) => <span className="text-gray-300 text-xs">{row.label}</span>,
    exportValue: (row) => row.label,
  },
  {
    key: 'value',
    header: 'Value',
    align: 'right',
    render: (row) => <span className={`text-xs font-medium tabular-nums ${row._textClass}`}>{row.value}</span>,
    exportValue: (row) => row.value,
  },
];

export default function SWOTWidget({ symbol, onRemove }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('chart');

  const load = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/swot/${symbol}`);
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error('SWOTWidget error:', e);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { load(); }, [load]);

  const allRows = QUADRANT_CONFIG.flatMap((cfg, ci) =>
    (data?.[cfg.key] || []).map((item, i) => ({
      ...item,
      _key: `${cfg.key}-${i}`,
      category: cfg.label,
      _textClass: cfg.textClass,
      _order: ci,
    }))
  );

  const maxCount = Math.max(...QUADRANT_CONFIG.map(cfg => (data?.[cfg.key] || []).length), 1);

  const renderChart = () => (
    <div className="h-full flex flex-col">
      {/* Vertical bar chart */}
      <div className="flex flex-col p-3" style={{ height: '140px' }}>
        <div className="flex justify-around mb-1">
          {QUADRANT_CONFIG.map(cfg => {
            const count = (data?.[cfg.key] || []).length;
            return (
              <span key={cfg.key} className={`text-[9px] font-medium tabular-nums flex-1 text-center ${cfg.textClass}`}>
                {count} items
              </span>
            );
          })}
        </div>
        <div className="flex-1 flex items-end justify-around gap-2 min-h-0">
          {QUADRANT_CONFIG.map(cfg => {
            const count = (data?.[cfg.key] || []).length;
            const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
            return (
              <div key={cfg.key} className="flex-1 flex justify-center items-end h-full">
                <div
                  className="w-full max-w-[40px] rounded-t transition-all duration-700"
                  style={{ height: `${pct}%`, backgroundColor: cfg.color, minHeight: count > 0 ? '3px' : 0 }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-around border-t border-gray-800 pt-1.5 mt-1">
          {QUADRANT_CONFIG.map(cfg => (
            <span key={cfg.key} className={`text-[9px] text-center flex-1 leading-tight ${cfg.textClass}`}>{cfg.label}</span>
          ))}
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-auto border-t border-gray-800 divide-y divide-gray-800/60">
        {QUADRANT_CONFIG.flatMap(cfg =>
          (data?.[cfg.key] || []).map((item, i) => (
            <div key={`${cfg.key}-${i}`} className="flex items-center justify-between px-3 py-1 text-[11px]">
              <span className={`font-medium flex-shrink-0 mr-2 ${cfg.textClass}`}>{cfg.label[0]}</span>
              <span className="text-gray-400 truncate flex-1">{item.label}</span>
              <span className={`font-medium tabular-nums ml-2 flex-shrink-0 ${cfg.textClass}`}>{item.value}</span>
            </div>
          ))
        )}
      </div>

      {/* AI placeholder */}
      <div className="flex-shrink-0 border-t border-gray-800 px-4 py-2 text-xs">
        <span className="text-gray-600">AI Analysis</span>
        <span className="ml-2 text-gray-700 text-[10px]">Coming Soon</span>
      </div>
    </div>
  );

  const renderTable = () => (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 px-3 pb-2 pt-1">
        <WidgetTable
          columns={COLUMNS}
          data={allRows}
          size="compact"
          emptyMessage="No SWOT data available"
          exportFilename={`swot_${symbol}`}
        />
      </div>
      <div className="flex-shrink-0 border-t border-gray-800 px-4 py-2 text-xs">
        <span className="text-gray-600">AI Analysis</span>
        <span className="ml-2 text-gray-700 text-[10px]">Coming Soon</span>
        <p className="text-gray-700 italic mt-0.5 text-[10px]">
          {data?.ai_analysis ?? 'AI-powered SWOT narrative will appear here once configured.'}
        </p>
      </div>
    </div>
  );

  return (
    <BaseWidget
      title="SWOT Analysis"
      icon={Grid3X3}
      iconColor="text-emerald-400"
      loading={loading}
      onRefresh={load}
      onRemove={onRemove}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      showPeriodSelector={false}
      source="Yahoo Finance"
    >
      {viewMode === 'chart' ? renderChart() : renderTable()}
    </BaseWidget>
  );
}
