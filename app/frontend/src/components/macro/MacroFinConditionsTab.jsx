/**
 * Macro 금융 환경 탭
 */
import { Activity } from 'lucide-react';
import FinancialConditionsWidget from './FinancialConditionsWidget';
import { CARD_CLASSES } from '../../styles/designTokens';

export default function MacroFinConditionsTab() {
  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="space-y-6">
        {/* Header Card */}
        <div className={`${CARD_CLASSES.default} p-6`}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-600/20 rounded-xl">
              <Activity className="text-green-500" size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">금융 환경 분석</h2>
              <p className="text-gray-400 text-sm mt-0.5">금융 여건 지수와 신용 환경을 분석합니다</p>
            </div>
          </div>
        </div>

        {/* Financial Conditions Component */}
        <FinancialConditionsWidget />
      </div>
    </div>
  );
}
