/**
 * Macro 인플레이션 탭
 */
import { DollarSign } from 'lucide-react';
import InflationDecomposition from './InflationDecomposition';

export default function MacroInflationTab() {
  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <DollarSign className="text-green-500" size={28} />
          <div>
            <h2 className="text-xl font-bold text-white">인플레이션</h2>
            <p className="text-gray-400 text-sm mt-0.5">물가 상승률과 구성요소 분석</p>
          </div>
        </div>

        {/* Inflation Component */}
        <InflationDecomposition />
      </div>
    </div>
  );
}
