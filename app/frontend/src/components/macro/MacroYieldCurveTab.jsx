/**
 * Macro 수익률 곡선 탭
 */
import { TrendingUp } from 'lucide-react';
import YieldCurveChart from './YieldCurveChart';

export default function MacroYieldCurveTab() {
  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <TrendingUp className="text-green-500" size={28} />
          <div>
            <h2 className="text-xl font-bold text-white">수익률 곡선</h2>
            <p className="text-gray-400 text-sm mt-0.5">미국 국채 수익률 곡선과 스프레드 분석</p>
          </div>
        </div>

        {/* Yield Curve Component */}
        <div className="bg-[#1a1f2e] rounded-xl border border-gray-700 p-6">
          <YieldCurveChart />
        </div>
      </div>
    </div>
  );
}
