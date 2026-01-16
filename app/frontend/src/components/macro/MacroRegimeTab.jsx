/**
 * Macro 경제 국면 탭
 */
import { Target } from 'lucide-react';
import RegimeDashboard from './RegimeDashboard';

export default function MacroRegimeTab() {
  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="space-y-6">
        {/* Regime Dashboard Component */}
        <RegimeDashboard />
      </div>
    </div>
  );
}
