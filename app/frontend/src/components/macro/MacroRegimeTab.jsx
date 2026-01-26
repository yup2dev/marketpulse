/**
 * Macro 경제 국면 탭
 */
import { Target } from 'lucide-react';
import RegimeDashboard from './RegimeDashboard';
import { CARD_CLASSES } from '../../styles/designTokens';

export default function MacroRegimeTab() {
  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="space-y-6">
        {/* Header Card */}
        <div className={`${CARD_CLASSES.default} p-6`}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-600/20 rounded-xl">
              <Target className="text-green-500" size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">경제 국면 분석</h2>
              <p className="text-gray-400 text-sm mt-0.5">성장률과 인플레이션 기반 4분면 분석으로 현재 경제 상황을 파악하세요</p>
            </div>
          </div>
        </div>

        {/* Regime Dashboard Component */}
        <RegimeDashboard />
      </div>
    </div>
  );
}
