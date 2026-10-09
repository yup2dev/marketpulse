import { GitCompare, X } from 'lucide-react';
import { getRegimeBadge } from '../../../utils/pairAnalysis';

/**
 * 페어 트레이딩 설정 패널 (롱/숏 종목, 레짐 지수, 표시 토글).
 *
 * ChartWidget.jsx 에서 분리했다. 롱/숏 셀렉터 두 개와 표시 토글 다섯 개가 필드 이름과
 * 라벨만 다른 같은 마크업이어서, 다른 부분만 표로 선언하고 마크업은 한 번만 쓴다.
 */

const SELECT_CLASS =
  'w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500';
const CHECKBOX_CLASS =
  'w-4 h-4 rounded border-gray-600 bg-gray-700 text-amber-500 focus:ring-amber-500';

// exclude: 반대편 포지션에 이미 선택된 종목은 목록에서 뺀다(같은 종목 롱/숏 방지).
const POSITIONS = [
  { field: 'longSymbol',  label: 'Long Position',  placeholder: 'Select Long',  exclude: 'shortSymbol' },
  { field: 'shortSymbol', label: 'Short Position', placeholder: 'Select Short', exclude: 'longSymbol' },
];

const REGIME_INDEXES = [
  { value: '^KS11', label: 'KOSPI (^KS11)' },
  { value: '^GSPC', label: 'S&P 500 (^GSPC)' },
  { value: '^IXIC', label: 'NASDAQ (^IXIC)' },
  { value: '^DJI',  label: 'Dow Jones (^DJI)' },
];

const TOGGLES = [
  { field: 'showSpread',    label: 'Spread Line' },
  { field: 'showIndex',     label: 'Index Line (KOSPI)' },
  { field: 'showHighlight', label: 'Outperform Highlight' },
  { field: 'showRegime',    label: 'Regime Background' },
  { field: 'showFCF',       label: 'FCF/CapEx Panel' },
];

const PairSettingsPanel = ({
  isSeriesMode, pairMode, showPairSettings, setShowPairSettings,
  pairConfig, setPairConfig, tickers, currentRegime,
}) => {
  if (!(!isSeriesMode && pairMode && showPairSettings)) return null;

  const patch = (changes) => setPairConfig({ ...pairConfig, ...changes });
  const badge = getRegimeBadge(currentRegime);

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
          <GitCompare size={16} className="text-amber-400" />
          Pair Analysis Settings
        </h4>
        <button
          onClick={() => setShowPairSettings(false)}
          className="text-gray-400 hover:text-white"
        >
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {POSITIONS.map(({ field, label, placeholder, exclude }) => (
          <div key={field}>
            <label className="block text-xs text-gray-400 mb-1">{label}</label>
            <select
              value={pairConfig[field] || ''}
              onChange={(e) => patch({ [field]: e.target.value || null })}
              className={SELECT_CLASS}
            >
              <option value="">{placeholder}</option>
              {tickers.filter(t => t.type === 'stock' && t.symbol !== pairConfig[exclude]).map(t => (
                <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
              ))}
            </select>
          </div>
        ))}

        <div>
          <label className="block text-xs text-gray-400 mb-1">Regime Index</label>
          <select
            value={pairConfig.regimeSymbol}
            onChange={(e) => patch({ regimeSymbol: e.target.value })}
            className={SELECT_CLASS}
          >
            {REGIME_INDEXES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Current Regime</label>
          <div className={`${badge.bgColor} ${badge.textColor} px-3 py-1.5 rounded text-sm font-medium text-center`}>
            {badge.label}
          </div>
        </div>
      </div>

      {/* Toggle Options */}
      <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-700">
        {TOGGLES.map(({ field, label }) => (
          <label key={field} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={pairConfig[field]}
              onChange={(e) => patch({ [field]: e.target.checked })}
              className={CHECKBOX_CLASS}
            />
            <span className="text-sm text-gray-300">{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default PairSettingsPanel;
