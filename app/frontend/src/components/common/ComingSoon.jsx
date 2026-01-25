/**
 * Coming Soon Component - 개발 중인 기능 표시
 */
import { Construction, Clock, Sparkles } from 'lucide-react';

export default function ComingSoon({
  title = 'Coming Soon',
  description = '이 기능은 현재 개발 중입니다.',
  icon: Icon = Construction,
  features = []
}) {
  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        {/* Animated Icon */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-xl animate-pulse"></div>
          <div className="relative p-6 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-full border border-purple-500/30">
            <Icon className="text-purple-400" size={48} />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-3xl font-bold text-white mb-3">{title}</h2>

        {/* Description */}
        <p className="text-gray-400 text-lg max-w-md mb-8">{description}</p>

        {/* Features Preview */}
        {features.length > 0 && (
          <div className="w-full max-w-lg">
            <div className="bg-[#1a1f2e] rounded-xl border border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="text-yellow-400" size={18} />
                <span className="text-sm font-medium text-gray-300">예정된 기능</span>
              </div>
              <ul className="space-y-3">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="mt-1.5 w-1.5 h-1.5 bg-purple-500 rounded-full flex-shrink-0"></div>
                    <span className="text-gray-300 text-left">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Status Badge */}
        <div className="mt-8 flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full">
          <Clock className="text-yellow-400" size={16} />
          <span className="text-yellow-400 text-sm font-medium">개발 진행 중</span>
        </div>
      </div>
    </div>
  );
}
