/**
 * 스크리너 페이지
 * 프리셋 및 커스텀 스크리닝 기능 제공
 */
import { useState } from 'react';
import ScreenerPresets from '../components/screener/ScreenerPresets';
import ScreenerResults from '../components/screener/ScreenerResults';

export default function ScreenerPage() {
  const [results, setResults] = useState(null);
  const [currentPreset, setCurrentPreset] = useState(null);

  const handlePresetRun = ({ preset, results }) => {
    setCurrentPreset(preset);
    setResults(results);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Presets Section */}
        <ScreenerPresets onRunPreset={handlePresetRun} />

        {/* Results Section */}
        {results && (
          <ScreenerResults results={results} preset={currentPreset} />
        )}
      </div>
    </div>
  );
}
