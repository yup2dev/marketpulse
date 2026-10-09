import DropdownShell from './DropdownShell';
import { TECHNICAL_INDICATORS } from '../constants';

/**
 * 기술 지표 선택 드롭다운.
 *
 * 원래 시리즈 모드와 심볼 모드가 거의 같은 목록을 각각 렌더했다(그룹 라벨, 중복 판정
 * 필드, 추가 핸들러만 달랐다). 두 모드를 '대상(target)' 목록으로 정규화해 한 갈래로 합쳤다.
 */

const GROUPS = [
  { type: 'overlay',    label: 'Price Overlays' },
  { type: 'oscillator', label: 'Oscillators' },
  { type: 'separate',   label: 'Separate Pane' },
];

const TechnicalIndicatorDropdown = ({
  show, onClose, tokens, isSeriesMode, visibleSeries, tickers,
  technicalIndicators, onAddSeries, onAddSymbol,
}) => {
  if (!show) return null;

  // 시리즈/심볼 두 모드를 같은 모양으로 맞춘다 — 이후 렌더는 한 갈래뿐이다.
  const targets = isSeriesMode
    ? visibleSeries.map(s => ({
        key: s.id,
        label: s.name,
        taken: (ind) => technicalIndicators.some(ti => ti.indicatorId === ind.id && ti.seriesId === s.id),
        add: (ind) => onAddSeries(ind, s.id),
      }))
    : tickers.filter(t => t.type === 'stock').map(stock => ({
        key: stock.symbol,
        label: stock.symbol,
        taken: (ind) => technicalIndicators.some(ti => ti.indicatorId === ind.id && ti.symbol === stock.symbol),
        add: (ind) => onAddSymbol(ind, stock.symbol),
      }));

  return (
    <DropdownShell
      title="Technical Indicators"
      subtitle={isSeriesMode ? 'Select a series' : 'Select a stock first'}
      onClose={onClose}
      tokens={tokens}
      stickyHeader
      className="min-w-[350px] max-h-[500px] overflow-y-auto"
    >
      {GROUPS.map(({ type, label }) => {
        const indicators = TECHNICAL_INDICATORS.filter(ind => ind.type === type);
        if (indicators.length === 0) return null;

        return (
          <div key={type} className="border-b border-gray-800 last:border-0">
            <div className="px-3 py-2 bg-gray-900/50">
              <div className="text-xs font-semibold text-gray-400 uppercase">{label}</div>
            </div>
            {targets.map(target => (
              <div key={target.key}>
                <div className="px-3 py-1 bg-gray-800/30">
                  <div className="text-xs text-blue-400">{target.label}</div>
                </div>
                {indicators.map(indicator => {
                  const exists = target.taken(indicator);
                  return (
                    <button
                      key={`${target.key}-${indicator.id}`}
                      onClick={() => target.add(indicator)}
                      className={`w-full px-4 py-2 hover:bg-gray-800 transition-colors text-left ${
                        exists ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      disabled={exists}
                    >
                      <div className="text-sm font-medium text-white">{indicator.name}</div>
                      <div className="text-xs text-gray-400">{indicator.description}</div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}
    </DropdownShell>
  );
};

export default TechnicalIndicatorDropdown;
