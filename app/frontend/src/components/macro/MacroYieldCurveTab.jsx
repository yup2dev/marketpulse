/**
 * Macro 수익률 곡선 탭
 */
import { TrendingUp } from 'lucide-react';
import YieldCurveChart from './YieldCurveChart';
import { CARD_CLASSES } from '../../styles/designTokens';

export default function MacroYieldCurveTab() {
  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="space-y-6">
        {/* Header Card */}
        <div className={`${CARD_CLASSES.default} p-6`}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-600/20 rounded-xl">
              <TrendingUp className="text-green-500" size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">수익률 곡선 분석</h2>
              <p className="text-gray-400 text-sm mt-0.5">미국 국채 수익률 곡선과 주요 스프레드를 분석합니다</p>
            </div>
          </div>
        </div>

        {/* Yield Curve Component */}
        <div className={`${CARD_CLASSES.default} p-6`}>
          <YieldCurveChart />
        </div>
      </div>
    </div>
  );
}
