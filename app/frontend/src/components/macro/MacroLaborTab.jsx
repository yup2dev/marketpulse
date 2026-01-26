/**
 * Macro 노동 시장 탭
 */
import { Users } from 'lucide-react';
import LaborMarketHeatmap from './LaborMarketHeatmap';
import { CARD_CLASSES } from '../../styles/designTokens';

export default function MacroLaborTab() {
  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="space-y-6">
        {/* Header Card */}
        <div className={`${CARD_CLASSES.default} p-6`}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-600/20 rounded-xl">
              <Users className="text-green-500" size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">노동 시장 분석</h2>
              <p className="text-gray-400 text-sm mt-0.5">고용 지표와 노동 시장 동향을 분석합니다</p>
            </div>
          </div>
        </div>

        {/* Labor Market Component */}
        <LaborMarketHeatmap />
      </div>
    </div>
  );
}
