/**
 * Portfolio Stats Widget - Volume, Fees, and account stats
 * Uses BaseWidget for consistent widget chrome
 */
import { ChevronDown, BarChart2 } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';

const ACCOUNT_TYPES = [
  { id: 'all', label: 'All Accounts' },
  { id: 'stock', label: 'Stock Account' },
  { id: 'futures', label: 'Futures Account' },
  { id: 'earn', label: 'Earn Account' },
];

const PERIOD_OPTIONS = [
  { id: '1D', label: '1D' },
  { id: '7D', label: '7D' },
  { id: '30D', label: '30D' },
  { id: '90D', label: '90D' },
  { id: '1Y', label: '1Y' },
  { id: 'ALL', label: 'ALL' },
];

function StatRow({ label, value, positive, negative }) {
  let valueClass = 'text-white';
  if (positive) valueClass = 'text-green-400';
  if (negative) valueClass = 'text-red-400';

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-400">{label}</span>
      <span className={`text-sm font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}

export default function PortfolioStatsWidget({
  stats,
  selectedAccountType,
  setSelectedAccountType,
  selectedPeriod,
  setSelectedPeriod,
  formatCurrency,
  formatPercent,
  onRemove,
}) {
  return (
    <BaseWidget
      title="Portfolio Stats"
      icon={BarChart2}
      iconColor="text-cyan-400"
      showViewToggle={false}
      showPeriodSelector={false}
      onRemove={onRemove}
    >
      <div className="p-4 space-y-3">
        {/* Volume Card */}
        <div className="bg-[#0a0a0f] rounded-lg p-3 border border-gray-800">
          <div className="text-sm text-gray-400 mb-1">14 Day Volume</div>
          <div className="text-xl font-bold">{formatCurrency(stats.volume)}</div>
          <button className="text-cyan-400 text-sm mt-1 hover:underline">
            View Volume
          </button>
        </div>

        {/* Fees Card */}
        <div className="bg-[#0a0a0f] rounded-lg p-3 border border-gray-800">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-400">Fees (Taker / Maker)</span>
            <ChevronDown size={16} className="text-gray-400" />
          </div>
          <div className="text-lg font-bold">0.10% / 0.05%</div>
          <button className="text-cyan-400 text-sm mt-1 hover:underline">
            View Fee Schedule
          </button>
        </div>

        {/* Stats Section */}
        <div className="bg-[#0a0a0f] rounded-lg p-3 border border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <select
              value={selectedAccountType}
              onChange={(e) => setSelectedAccountType(e.target.value)}
              className="bg-transparent text-white text-sm border border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-cyan-500"
            >
              {ACCOUNT_TYPES.map(type => (
                <option key={type.id} value={type.id} className="bg-[#0d0d12]">
                  {type.label}
                </option>
              ))}
            </select>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-transparent text-white text-sm border border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-cyan-500"
            >
              {PERIOD_OPTIONS.map(period => (
                <option key={period.id} value={period.id} className="bg-[#0d0d12]">
                  {period.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <StatRow label="PNL" value={formatCurrency(stats.pnl)} positive={stats.pnl >= 0} />
            <StatRow label="Volume" value={formatCurrency(stats.volume)} />
            <StatRow label="Max Drawdown" value={formatPercent(stats.maxDrawdown)} negative={stats.maxDrawdown < 0} />
            <StatRow label="Total Equity" value={formatCurrency(stats.totalEquity)} />
            <StatRow label="Stock Equity" value={formatCurrency(stats.stockEquity)} />
            <StatRow label="Futures Equity" value={formatCurrency(stats.futuresEquity)} />
            <StatRow label="Earn Balance" value={formatCurrency(stats.earnBalance)} />
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
