/**
 * 스크리너 프리셋 컴포넌트
 * 사전 정의된 스크리닝 전략 표시 및 실행
 */
import { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, DollarSign, Filter, Play } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const PRESET_ICONS = {
  value_stocks: DollarSign,
  growth_stocks: TrendingUp,
  dividend_aristocrats: Sparkles,
  small_cap_growth: TrendingUp,
  undervalued_large_cap: DollarSign
};

export default function ScreenerPresets({ onRunPreset }) {
  const [presets, setPresets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [runningPreset, setRunningPreset] = useState(null);

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/screener/presets`
      );
      setPresets(response.data.presets || []);
    } catch (error) {
      toast.error('프리셋을 불러오지 못했습니다');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunPreset = async (presetId) => {
    try {
      setRunningPreset(presetId);
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/screener/presets/${presetId}/run`,
        null,
        { params: { limit: 100 } }
      );

      const results = response.data.results || [];
      const preset = response.data.preset || {};

      toast.success(`${results.length}개 종목을 찾았습니다`);

      if (onRunPreset) {
        onRunPreset({ preset, results });
      }
    } catch (error) {
      toast.error('스크리닝 실행 실패');
      console.error(error);
    } finally {
      setRunningPreset(null);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-3"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">스크리너 프리셋</h2>
          <p className="text-gray-600 mt-1">
            전문가가 만든 스크리닝 전략을 바로 사용해보세요
          </p>
        </div>
        <Filter className="text-blue-600" size={32} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {presets.map((preset) => {
          const IconComponent = PRESET_ICONS[preset.preset_id] || Filter;
          const isRunning = runningPreset === preset.preset_id;

          return (
            <div
              key={preset.preset_id}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-all group"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <IconComponent className="text-blue-600" size={24} />
                </div>
                <button
                  onClick={() => handleRunPreset(preset.preset_id)}
                  disabled={isRunning}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    isRunning
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isRunning ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>실행 중...</span>
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      <span>실행</span>
                    </>
                  )}
                </button>
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {preset.name}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {preset.description}
              </p>

              {/* Filter Summary */}
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 mb-2">필터 조건</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(preset.filters).slice(0, 3).map(([key, value]) => (
                    <span
                      key={key}
                      className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                    >
                      {key.replace(/_/g, ' ')}: {value}
                    </span>
                  ))}
                  {Object.keys(preset.filters).length > 3 && (
                    <span className="text-xs text-gray-500">
                      +{Object.keys(preset.filters).length - 3} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
