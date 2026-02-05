/**
 * Regime Quadrant Widget - 4-quadrant economic regime diagram
 */
import { useState, useEffect, useCallback } from 'react';
import { Grid3x3 } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';
import { API_BASE } from '../../../config/api';

const QUADRANTS = [
  { id: 'reflation', label: 'Reflation', color: 'yellow', desc: '↑ Growth, ↑ Inflation', position: 'tl' },
  { id: 'goldilocks', label: 'Goldilocks', color: 'green', desc: '↑ Growth, ↓ Inflation', position: 'tr' },
  { id: 'stagflation', label: 'Stagflation', color: 'red', desc: '↓ Growth, ↑ Inflation', position: 'bl' },
  { id: 'deflation', label: 'Deflation', color: 'blue', desc: '↓ Growth, ↓ Inflation', position: 'br' }
];

const POSITION_CLASSES = {
  tl: 'rounded-tl-lg',
  tr: 'rounded-tr-lg',
  bl: 'rounded-bl-lg',
  br: 'rounded-br-lg'
};

const COLOR_CLASSES = {
  yellow: { active: 'bg-yellow-900/50 border-2 border-yellow-400', text: 'text-yellow-400' },
  green: { active: 'bg-green-900/50 border-2 border-green-400', text: 'text-green-400' },
  red: { active: 'bg-red-900/50 border-2 border-red-400', text: 'text-red-400' },
  blue: { active: 'bg-blue-900/50 border-2 border-blue-400', text: 'text-blue-400' }
};

export default function RegimeQuadrantWidget({ onRemove }) {
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

  const currentRegime = data?.regime;

  return (
    <BaseWidget
      title="Regime Quadrant"
      icon={Grid3x3}
      iconColor="text-orange-400"
      loading={loading}
      onRefresh={loadData}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
      source="FRED"
    >
      <div className="h-full p-4 flex flex-col">
        {/* Axis Labels */}
        <div className="flex justify-between text-[10px] text-gray-500 mb-1 px-1">
          <span>High Inflation</span>
          <span>Low Inflation</span>
        </div>

        {/* Quadrant Grid */}
        <div className="flex-1 grid grid-cols-2 gap-1 min-h-0">
          {QUADRANTS.map((q) => {
            const isActive = currentRegime === q.id;
            const colorClass = COLOR_CLASSES[q.color];

            return (
              <div
                key={q.id}
                className={`p-3 transition-all ${POSITION_CLASSES[q.position]} ${
                  isActive ? colorClass.active : 'bg-gray-800/50'
                }`}
              >
                <div className={`text-xs font-medium ${colorClass.text}`}>
                  {q.label}
                </div>
                <div className="text-gray-500 text-[10px] mt-1">
                  {q.desc}
                </div>
                {isActive && (
                  <div className="mt-2">
                    <span className={`text-[10px] ${colorClass.text} font-medium`}>
                      Current
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Axis Labels */}
        <div className="flex justify-between text-[10px] text-gray-500 mt-1 px-1">
          <span>Weak Growth</span>
          <span>Strong Growth</span>
        </div>
      </div>
    </BaseWidget>
  );
}
