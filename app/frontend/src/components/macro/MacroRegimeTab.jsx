/**
 * Macro 경제 국면 탭
 */
import { Target } from 'lucide-react';
import RegimeDashboard from './RegimeDashboard';

export default function MacroRegimeTab() {
  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Target className="text-green-500" size={28} />
          <div>
            <h2 className="text-xl font-bold text-white">경제 국면 분석</h2>
            <p className="text-gray-400 text-sm mt-0.5">현재 경제 사이클과 시장 국면 파악</p>
          </div>
        </div>

        {/* Regime Dashboard Component */}
        <RegimeDashboard />
      </div>
    </div>
  );
}
