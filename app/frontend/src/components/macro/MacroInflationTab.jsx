/**
 * Macro 인플레이션 탭
 */
import { DollarSign } from 'lucide-react';
import InflationDecomposition from './InflationDecomposition';
import { CARD_CLASSES } from '../../styles/designTokens';

export default function MacroInflationTab() {
  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="space-y-6">
        {/* Header Card */}
        <div className={`${CARD_CLASSES.default} p-6`}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-600/20 rounded-xl">
              <DollarSign className="text-green-500" size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">인플레이션 분석</h2>
              <p className="text-gray-400 text-sm mt-0.5">물가 상승률과 구성요소별 변화를 분석합니다</p>
            </div>
          </div>
        </div>

        {/* Inflation Component */}
        <InflationDecomposition />
      </div>
    </div>
  );
}
