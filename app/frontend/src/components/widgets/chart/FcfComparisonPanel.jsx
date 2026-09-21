import { GitCompare } from 'lucide-react';
import { formatCurrency } from '../constants';
import { getRegimeBadge } from '../../../utils/pairAnalysis';

/**
 * 페어 트레이딩용 FCF/CapEx 비교 패널 + 스프레드·지수 요약.
 *
 * ChartWidget.jsx 에서 분리했다. LONG/SHORT 두 칸이 라벨·색·심볼·데이터 출처만 다른
 * 같은 마크업이었고 재무 항목 3줄도 동일해서, 양쪽을 하나의 표현 컴포넌트로 모았다.
 */

// 좌: 롱 포지션, 우: 숏 포지션
const SIDES = [
  { key: 'long',  label: 'LONG',  badgeClass: 'text-green-400 bg-green-400/20', symbolKey: 'longSymbol' },
  { key: 'short', label: 'SHORT', badgeClass: 'text-red-400 bg-red-400/20',     symbolKey: 'shortSymbol' },
];

const FINANCIAL_ROWS = [
  { label: 'Free Cash Flow', field: 'free_cash_flow' },
  { label: 'CapEx',          field: 'capital_expenditures' },
  { label: 'Operating CF',   field: 'operating_cash_flow' },
];

// ^KS11 은 티커 그대로 두면 읽기 어려워 KOSPI 로 표기한다.
const indexLabel = (regimeSymbol) => (regimeSymbol === '^KS11' ? 'KOSPI' : regimeSymbol);

const PositionFinancials = ({ label, badgeClass, symbol, financials }) => (
  <div className="bg-gray-800/30 rounded-lg p-3">
    <div className="flex items-center gap-2 mb-2">
      <span className={`text-xs font-medium ${badgeClass} px-2 py-0.5 rounded`}>{label}</span>
      <span className="text-sm font-semibold text-white">{symbol}</span>
    </div>
    {financials?.data ? (
      <div className="space-y-2">
        {FINANCIAL_ROWS.map(({ label: rowLabel, field }) => (
          <div key={field} className="flex justify-between text-sm">
            <span className="text-gray-400">{rowLabel}</span>
            <span className="text-white font-medium">
              {formatCurrency(financials.data[0]?.[field])}
            </span>
          </div>
        ))}
      </div>
    ) : (
      <div className="text-xs text-gray-500">No financial data available</div>
    )}
  </div>
);

const FcfComparisonPanel = ({
  pairMode, pairConfig, chartTheme, financialData, spreadData, indexData, currentRegime,
}) => {
  if (!(pairMode && pairConfig.showFCF && pairConfig.longSymbol && pairConfig.shortSymbol)) return null;

  const hasSummary = spreadData.length > 0 || indexData.length > 0;

  return (
    <div className="rounded-lg p-4 border border-gray-800" style={{ backgroundColor: chartTheme.background }}>
      <h4 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
        <GitCompare size={14} className="text-amber-400" />
        FCF / CapEx Comparison
      </h4>
      <div className="grid grid-cols-2 gap-4">
        {SIDES.map(({ key, label, badgeClass, symbolKey }) => (
          <PositionFinancials
            key={key}
            label={label}
            badgeClass={badgeClass}
            symbol={pairConfig[symbolKey]}
            financials={financialData[key]}
          />
        ))}
      </div>

      {/* Spread & Index Summary */}
      {hasSummary && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {spreadData.length > 0 && (
              <>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Current Spread</div>
                  <div className="text-lg font-bold text-amber-400">
                    {spreadData[spreadData.length - 1]?.normalizedSpread?.toFixed(3) || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Spread Range</div>
                  <div className="text-sm font-bold">
                    <span className="text-red-400">{Math.min(...spreadData.map(d => d.normalizedSpread))?.toFixed(3)}</span>
                    <span className="text-gray-500 mx-1">~</span>
                    <span className="text-green-400">{Math.max(...spreadData.map(d => d.normalizedSpread))?.toFixed(3)}</span>
                  </div>
                </div>
              </>
            )}
            {indexData.length > 0 && (
              <>
                <div>
                  <div className="text-xs text-gray-400 mb-1">{indexLabel(pairConfig.regimeSymbol)} Change</div>
                  <div className={`text-lg font-bold ${
                    indexData[indexData.length - 1]?.close > indexData[0]?.close ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {(((indexData[indexData.length - 1]?.close / indexData[0]?.close) - 1) * 100).toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Current Regime</div>
                  {(() => {
                    const badge = getRegimeBadge(currentRegime);
                    return (
                      <div className={`${badge.bgColor} ${badge.textColor} px-2 py-1 rounded text-sm font-medium inline-block`}>
                        {badge.label}
                      </div>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
          {/* Legend */}
          <div className="flex justify-center gap-6 mt-3 text-xs text-gray-500">
            {pairConfig.showSpread && <div className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500 inline-block"></span> L/S Spread</div>}
            {pairConfig.showIndex && <div className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block" style={{borderTop: '2px dashed'}}></span> {indexLabel(pairConfig.regimeSymbol)}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default FcfComparisonPanel;
