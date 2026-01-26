/**
 * Macro 시장 심리 탭
 */
import { BarChart3 } from 'lucide-react';
import SentimentComposite from './SentimentComposite';
import { CARD_CLASSES } from '../../styles/designTokens';

export default function MacroSentimentTab() {
  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="space-y-6">
        {/* Header Card */}
        <div className={`${CARD_CLASSES.default} p-6`}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-600/20 rounded-xl">
              <BarChart3 className="text-green-500" size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">시장 심리 분석</h2>
              <p className="text-gray-400 text-sm mt-0.5">투자자 심리 지표와 시장 센티먼트를 분석합니다</p>
            </div>
          </div>
        </div>

        {/* Sentiment Component */}
        <SentimentComposite />
      </div>
    </div>
  );
}
