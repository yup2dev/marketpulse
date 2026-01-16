/**
 * Macro 시장 심리 탭
 */
import { BarChart3 } from 'lucide-react';
import SentimentComposite from './SentimentComposite';

export default function MacroSentimentTab() {
  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <BarChart3 className="text-green-500" size={28} />
          <div>
            <h2 className="text-xl font-bold text-white">시장 심리</h2>
            <p className="text-gray-400 text-sm mt-0.5">투자자 심리와 시장 지표</p>
          </div>
        </div>

        {/* Sentiment Component */}
        <SentimentComposite />
      </div>
    </div>
  );
}
