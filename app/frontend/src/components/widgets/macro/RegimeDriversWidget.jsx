/**
 * Regime Drivers Widget - Key economic drivers table
 */
import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, ListOrdered } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import { API_BASE } from '../../../config/api';

export default function RegimeDriversWidget({ onRemove }) {
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
      console.error('Error loading regime drivers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const drivers = data?.drivers || [];

  return (
    <BaseWidget
      title="Key Drivers"
      icon={ListOrdered}
      iconColor="text-amber-400"
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
      source="FRED"
    >
      <div className="h-full overflow-auto">
        {drivers.length > 0 ? (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#0d0d12]">
              <tr className="border-b border-gray-800">
                <th className="text-left py-2 px-3 text-gray-400 font-medium">Driver</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Value</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Impact</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver, idx) => (
                <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 px-3 text-gray-300">{driver.name}</td>
                  <td className="py-2 px-3 text-right text-white font-medium">
                    {typeof driver.value === 'number' ? driver.value.toFixed(2) : driver.value}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className={`flex items-center justify-end gap-1 ${
                      driver.impact >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {driver.impact >= 0 ? (
                        <TrendingUp size={12} />
                      ) : (
                        <TrendingDown size={12} />
                      )}
                      {driver.impact > 0 ? '+' : ''}{driver.impact?.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 text-sm">
            No driver data available
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
