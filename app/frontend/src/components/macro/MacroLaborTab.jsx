/**
 * Macro 노동 시장 탭
 */
import { Users } from 'lucide-react';
import LaborMarketHeatmap from './LaborMarketHeatmap';

export default function MacroLaborTab() {
  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Users className="text-green-500" size={28} />
          <div>
            <h2 className="text-xl font-bold text-white">노동 시장</h2>
            <p className="text-gray-400 text-sm mt-0.5">고용 지표와 노동 시장 동향</p>
          </div>
        </div>

        {/* Labor Market Component */}
        <LaborMarketHeatmap />
      </div>
    </div>
  );
}
