import { Percent, GitCompare, Settings } from 'lucide-react';
import { CHART_TYPES } from '../constants';
import { DATE_RANGE_PRESETS, presetDateRange } from './chartHelpers';

/**
 * 차트 툴바 오른쪽 컨트롤 — 기간 선택, 차트 타입 퀵셀렉터, 정규화/거래량/페어 토글.
 *
 * ChartWidget.jsx 에서 분리했다. 어떤 컨트롤을 띄울지는 위젯 사용처가 정하므로
 * show.* 플래그로 받는다(플래그가 다섯 개라 개별 prop 대신 하나로 묶었다).
 */

const Divider = () => <div className="w-px h-6 bg-gray-700 mx-1"></div>;

const DATE_INPUT_CLASS =
  'px-2 py-1.5 rounded text-xs font-medium bg-gray-800 text-gray-300 outline-none focus:text-white tabular-nums [color-scheme:dark]';
const TOGGLE_CLASS = (on) =>
  `flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
    on ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
  }`;

const ChartControls = ({
  show, isSeriesMode,
  startDate, endDate, setStartDate, setEndDate,
  chartType, setChartType,
  normalized, setNormalized,
  showVolume, setShowVolume, volumeAvailable,
  pairMode, setPairMode, showPairSettings, setShowPairSettings,
}) => {
  const showRanges = show.timeRanges && !isSeriesMode;
  const showQuickTypes = show.chartTypeSelector && !isSeriesMode;

  return (
    <div className="flex items-center gap-2">
      {/* Date Range Selector (symbol mode; series mode range comes from parent) */}
      {showRanges && (
        <>
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={DATE_INPUT_CLASS}
          />
          <span className="text-gray-600 text-xs">~</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={DATE_INPUT_CLASS}
          />
          {DATE_RANGE_PRESETS.map((preset) => {
            const r = presetDateRange(preset.months);
            const active = startDate === r.start && endDate === r.end;
            return (
              <button
                key={preset.label}
                onClick={() => { setStartDate(r.start); setEndDate(r.end); }}
                className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                  active ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </>
      )}

      {show.timeRanges && showQuickTypes && <Divider />}

      {/* Chart Type Quick Selector (symbol mode only) */}
      {showQuickTypes && (
        <div className="flex items-center bg-gray-800 rounded overflow-hidden">
          {CHART_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setChartType(type.id)}
              className={`px-2 py-1.5 text-xs font-medium transition-colors ${
                chartType === type.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
              title={type.description}
            >
              {type.name}
            </button>
          ))}
        </div>
      )}

      {(show.timeRanges || showQuickTypes) && (show.normalize || show.volumeToggle) && <Divider />}

      {show.normalize && (
        <button
          onClick={() => setNormalized(!normalized)}
          className={TOGGLE_CLASS(normalized)}
          title="Normalize to percentage change"
        >
          <Percent size={14} />
          Normalize
        </button>
      )}

      {show.volumeToggle && volumeAvailable && (
        <button
          onClick={() => setShowVolume(!showVolume)}
          className={TOGGLE_CLASS(showVolume)}
          title="Show volume"
        >
          Volume
        </button>
      )}

      {/* Pair Analysis Mode Toggle (symbol mode only) */}
      {show.pairAnalysis && !isSeriesMode && (
        <>
          <Divider />
          <button
            onClick={() => {
              setPairMode(!pairMode);
              // 페어 모드를 켤 때는 설정 패널을 함께 연다 — 롱/숏을 먼저 골라야 한다.
              if (!pairMode) setShowPairSettings(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              pairMode ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
            title="Pair Analysis Mode"
          >
            <GitCompare size={14} />
            Pair
          </button>

          {pairMode && (
            <button
              onClick={() => setShowPairSettings(!showPairSettings)}
              className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors bg-gray-800 text-gray-400 hover:text-white"
              title="Pair Settings"
            >
              <Settings size={14} />
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default ChartControls;
