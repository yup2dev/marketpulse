/**
 * Macro Fed 정책 탭
 */
import { Building2 } from 'lucide-react';
import FedPolicyGauge from './FedPolicyGauge';

export default function MacroFedPolicyTab() {
  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Building2 className="text-green-500" size={28} />
          <div>
            <h2 className="text-xl font-bold text-white">Fed 정책</h2>
            <p className="text-gray-400 text-sm mt-0.5">연방준비제도 정책 방향 분석</p>
          </div>
        </div>

        {/* Fed Policy Component */}
        <FedPolicyGauge />
      </div>
    </div>
  );
}
