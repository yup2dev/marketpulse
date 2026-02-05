/**
 * Regime Scores Widget - Growth and Inflation Score gauges
 */
import { useState, useEffect, useCallback } from 'react';
import { Gauge } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import { API_BASE } from '../../../config/api';

export default function RegimeScoresWidget({ onRemove }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/macro/regime/current`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (error) {
      console.error('Error loading regime scores:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const growthScore = data?.growth_score || 0;
  const inflationScore = data?.inflation_score || 0;

  return (
    <BaseWidget
      title="Regime Indicators"
      icon={Gauge}
      iconColor="text-purple-400"
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
      source="FRED"
    >
      <div className="h-full flex flex-col justify-center p-4 gap-6">
        {/* Growth Score */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-xs">Growth Score</span>
            <span className={`text-xl font-bold ${growthScore >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {growthScore.toFixed(0)}
            </span>
          </div>
          <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${growthScore >= 0 ? 'bg-green-400' : 'bg-red-400'}`}
              style={{ width: `${Math.min(100, Math.abs(growthScore))}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-600 mt-1">
            <span>Weak</span>
            <span>Strong</span>
          </div>
        </div>

        {/* Inflation Score */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-xs">Inflation Score</span>
            <span className={`text-xl font-bold ${inflationScore >= 50 ? 'text-red-400' : 'text-green-400'}`}>
              {inflationScore.toFixed(0)}
            </span>
          </div>
          <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${inflationScore >= 50 ? 'bg-red-400' : 'bg-green-400'}`}
              style={{ width: `${Math.min(100, inflationScore)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-600 mt-1">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
