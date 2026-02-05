/**
 * Regime Current Widget - Shows current economic regime status
 */
import { useState, useEffect, useCallback } from 'react';
import { Activity } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import { API_BASE } from '../../../config/api';

const REGIME_CONFIG = {
  goldilocks: { color: 'text-green-400', bg: 'bg-green-400', description: 'Strong Growth + Low Inflation' },
  reflation: { color: 'text-yellow-400', bg: 'bg-yellow-400', description: 'Rising Growth + Rising Inflation' },
  stagflation: { color: 'text-red-400', bg: 'bg-red-400', description: 'Weak Growth + High Inflation' },
  deflation: { color: 'text-blue-400', bg: 'bg-blue-400', description: 'Weak Growth + Falling Prices' }
};

export default function RegimeCurrentWidget({ onRemove }) {
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
      console.error('Error loading regime:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const config = REGIME_CONFIG[data?.regime] || { color: 'text-gray-400', bg: 'bg-gray-400', description: 'Unknown' };

  return (
    <BaseWidget
      title="Current Regime"
      icon={Activity}
      iconColor="text-cyan-400"
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
      source="FRED"
    >
      <div className="h-full flex flex-col items-center justify-center p-4">
        <div className={`text-4xl font-bold capitalize ${config.color}`}>
          {data?.regime || 'Unknown'}
        </div>
        <div className="text-gray-500 text-sm mt-2 text-center">
          {config.description}
        </div>
        {data?.confidence && (
          <div className="mt-4 pt-4 border-t border-gray-800 w-full text-center">
            <div className="text-gray-500 text-xs">Confidence</div>
            <div className="text-2xl font-bold text-white mt-1">
              {(data.confidence * 100).toFixed(0)}%
            </div>
            <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden mx-auto max-w-[200px]">
              <div
                className={`h-full ${config.bg}`}
                style={{ width: `${data.confidence * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
