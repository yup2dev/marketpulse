/**
 * Macro Fed 정책 탭
 */
import { Building2 } from 'lucide-react';
import FedPolicyGauge from './FedPolicyGauge';
import { CARD_CLASSES } from '../../styles/designTokens';

export default function MacroFedPolicyTab() {
  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="space-y-6">
        {/* Header Card */}
        <div className={`${CARD_CLASSES.default} p-6`}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-600/20 rounded-xl">
              <Building2 className="text-green-500" size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Fed 통화정책 분석</h2>
              <p className="text-gray-400 text-sm mt-0.5">연방준비제도의 정책 기조와 금리 전망을 분석합니다</p>
            </div>
          </div>
        </div>

        {/* Fed Policy Component */}
        <FedPolicyGauge />
      </div>
    </div>
  );
}
