/**
 * Macro 금융 환경 탭
 */
import { Activity } from 'lucide-react';
import FinancialConditionsWidget from './FinancialConditionsWidget';

export default function MacroFinConditionsTab() {
  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Activity className="text-green-500" size={28} />
          <div>
            <h2 className="text-xl font-bold text-white">금융 환경</h2>
            <p className="text-gray-400 text-sm mt-0.5">금융 여건 지수와 신용 환경</p>
          </div>
        </div>

        {/* Financial Conditions Component */}
        <FinancialConditionsWidget />
      </div>
    </div>
  );
}
