/**
 * InvestmentScorecardWidget - 5-category investment scorecard with overall grade
 */
import { useState, useEffect, useCallback } from 'react';
import { Award, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import { API_BASE } from './constants';

const GRADE_CONFIG = {
  'Strong Buy': { color: 'text-green-400', bg: 'bg-green-900/40 border-green-700' },
  'Buy':        { color: 'text-green-300', bg: 'bg-green-900/30 border-green-800' },
  'Hold':       { color: 'text-yellow-400', bg: 'bg-yellow-900/30 border-yellow-800' },
  'Sell':       { color: 'text-red-300',  bg: 'bg-red-900/30 border-red-800' },
  'Strong Sell':{ color: 'text-red-400',  bg: 'bg-red-900/40 border-red-700' },
  'N/A':        { color: 'text-gray-400', bg: 'bg-gray-800 border-gray-700' },
};

const CATEGORY_ORDER = [
  { key: 'fundamentals', label: 'Fundamentals', weight: '30%', color: '#22d3ee' },
  { key: 'growth',       label: 'Growth',       weight: '25%', color: '#a78bfa' },
  { key: 'valuation',    label: 'Valuation',    weight: '20%', color: '#4ade80' },
  { key: 'sentiment',    label: 'Sentiment',    weight: '15%', color: '#f59e0b' },
  { key: 'technical',    label: 'Technical',    weight: '10%', color: '#f87171' },
];

function OutlookIcon({ outlook }) {
  if (outlook === 'Positive') return <TrendingUp size={13} className="text-green-400" />;
  if (outlook === 'Negative') return <TrendingDown size={13} className="text-red-400" />;
  return <Minus size={13} className="text-gray-400" />;
}

export default function InvestmentScorecardWidget({ symbol, onRemove }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/scorecard/${symbol}`);
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error('InvestmentScorecardWidget error:', e);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { load(); }, [load]);

  const grade     = data?.investment_grade || 'N/A';
  const overall   = data?.overall_score ?? 0;
  const cats      = data?.categories || {};
  const outlook   = data?.outlook || {};
  const gradeCfg  = GRADE_CONFIG[grade] || GRADE_CONFIG['N/A'];

  const catBars = CATEGORY_ORDER.filter(cat => cats[cat.key]).map(cat => ({
    ...cat,
    score: cats[cat.key]?.score ?? 0,
    detail: cats[cat.key]?.detail || {},
  }));
  const maxScore = Math.max(...catBars.map(b => b.score), 1);

  return (
    <BaseWidget
      title="Investment Scorecard"
      icon={Award}
      iconColor="text-amber-400"
      loading={loading}
      onRefresh={load}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
      source="Yahoo Finance"
    >
      <div className="flex-1 overflow-auto p-3 space-y-4">
        {/* Overall Grade */}
        <div className="flex items-center justify-between text-xs border-b border-gray-800 pb-2">
          <span className="text-gray-500">Overall Score</span>
          <div className="flex items-center gap-3">
            <span className={`font-bold text-xl tabular-nums ${gradeCfg.color}`}>{overall}<span className="text-xs text-gray-600 font-normal">/100</span></span>
            <span className={`text-xs font-bold ${gradeCfg.color}`}>{grade}</span>
          </div>
        </div>

        {/* Category vertical bar chart */}
        {catBars.length > 0 && (
          <div className="flex flex-col" style={{ height: '140px' }}>
            <div className="flex justify-around mb-1">
              {catBars.map(b => (
                <span key={b.key} className="text-[9px] font-medium tabular-nums flex-1 text-center" style={{ color: b.color }}>{b.score}</span>
              ))}
            </div>
            <div className="flex-1 flex items-end justify-around gap-1.5 min-h-0">
              {catBars.map(b => (
                <div key={b.key} className="flex-1 flex justify-center items-end h-full">
                  <div
                    className="w-full max-w-[32px] rounded-t transition-all duration-700"
                    style={{ height: `${(b.score / maxScore) * 100}%`, backgroundColor: b.color, minHeight: '3px' }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-around border-t border-gray-800 pt-1.5 mt-1">
              {catBars.map(b => (
                <span key={b.key} className="text-[8px] text-gray-500 text-center flex-1 leading-tight">{b.label}</span>
              ))}
            </div>
          </div>
        )}

        {/* Category details */}
        {catBars.map(b => (
          <div key={b.key}>
            <div className="flex items-center justify-between mb-0.5 text-xs">
              <span className="font-medium" style={{ color: b.color }}>{b.label}</span>
              <span className="font-bold tabular-nums" style={{ color: b.color }}>{b.score}/100</span>
            </div>
            <div className="space-y-0.5 pl-2">
              {Object.entries(b.detail).slice(0, 3).map(([k, v]) => (
                <div key={k} className="flex justify-between text-[10px]">
                  <span className="text-gray-600">{k}</span>
                  <span className="text-gray-400 font-medium tabular-nums">{v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Outlook */}
        {Object.keys(outlook).length > 0 && (
          <div className="border-t border-gray-800 pt-3">
            <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-2">Outlook</p>
            <div className="flex gap-4">
              {[{ key: 'short_term', label: 'Short' }, { key: 'medium_term', label: 'Medium' }, { key: 'long_term', label: 'Long' }].map(o => (
                <div key={o.key} className="flex items-center gap-1.5">
                  <OutlookIcon outlook={outlook[o.key]} />
                  <span className="text-[10px] text-gray-400">{o.label}:</span>
                  <span className="text-[10px] font-medium text-gray-300">{outlook[o.key] || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Placeholder */}
        <div className="border-t border-gray-800 pt-2">
          <span className="text-[10px] text-gray-600">AI Investment Report</span>
          <span className="ml-2 text-[9px] text-gray-700">Coming Soon</span>
        </div>
      </div>
    </BaseWidget>
  );
}
