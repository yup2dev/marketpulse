/**
 * WidgetRenderer — routes every widget type to the correct renderer.
 *
 * Only portfolio widgets need explicit cases here (they receive portfolioData
 * state as props). Everything else falls through to UniversalWidget, which
 * looks up the type in UNIVERSAL_WIDGET_CONFIGS (widgetConfigs.jsx).
 *
 * Portfolio widget components are inlined here (no separate files).
 */
import { useState } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Minus, Layers, Wallet, Activity, History, Plus, Pencil, Trash2 } from 'lucide-react';

import UniversalWidget from './UniversalWidget';
import { UNIVERSAL_WIDGET_CONFIGS } from '../../registry/widgetConfigs';
import BaseWidget from '../widgets/common/BaseWidget';
import CommonTable from '../common/CommonTable';
import CommonChart from '../common/CommonChart';
import { formatCurrency, formatPercent, formatKRW as _fmtKRW } from '../../hooks/usePortfolioState';

// ── PortfolioStatsWidget ────────────────────────────────────────────────────

function StatCard({ label, value, subValue, colorClass = 'text-white', isUp, isDown }) {
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const iconColor = isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-gray-500';

  return (
    <div className="bg-[#0d0d12] rounded-lg p-3 border border-gray-800/60">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-gray-500">{label}</span>
        {(isUp != null || isDown != null) && (
          <Icon size={12} className={iconColor} />
        )}
      </div>
      <div className={`text-sm font-bold tabular-nums ${colorClass}`}>{value}</div>
      {subValue && (
        <div className={`text-[11px] tabular-nums mt-0.5 ${colorClass} opacity-70`}>{subValue}</div>
      )}
    </div>
  );
}

function PortfolioStatsWidget({
  stats,
  formatCurrency,
  formatPercent,
  lastRefreshed,
  onRemove,
  displayCurrency = 'USD',
  exchangeRate = null,
  formatKRW,
}) {
  const totalValue = stats.totalEquity || 0;
  const costBasis  = stats.totalCost || 0;
  const totalPnl   = stats.pnl || 0;
  const returnPct  = stats.returnPct || 0;
  const todayPnl   = stats.todayPnl || 0;
  const count      = stats.holdingsCount || 0;

  const isKRW = displayCurrency === 'KRW' && exchangeRate && formatKRW;
  const fmt = isKRW ? (v) => formatKRW(v * exchangeRate) : formatCurrency;

  const todayReturnPct = totalValue > 0 ? (todayPnl / totalValue) * 100 : 0;

  return (
    <BaseWidget
      title="Portfolio Overview"
      icon={BarChart2}
      iconColor="text-cyan-400"
      showViewToggle={false}
      showPeriodSelector={false}
      onRemove={onRemove}
    >
      <div className="p-3 space-y-2 overflow-auto h-[calc(100%-40px)]">

        {/* Total Portfolio Value */}
        <div className="bg-[#0a0a0f] rounded-lg p-3 border border-gray-800">
          <div className="text-[11px] text-gray-500 mb-0.5">Total Portfolio Value</div>
          <div className="text-xl font-bold text-white tabular-nums">{fmt(totalValue)}</div>
          {isKRW && (
            <div className="text-[11px] text-gray-600 mt-0.5 tabular-nums">
              = {formatCurrency(totalValue)}
            </div>
          )}
          <div className="text-[11px] text-gray-600 mt-0.5">
            Cost Basis: <span className="text-gray-400">{fmt(costBasis)}</span>
          </div>
        </div>

        {/* Today's P&L */}
        <StatCard
          label="오늘 손익 (Today's P&L)"
          value={`${todayPnl >= 0 ? '+' : ''}${fmt(todayPnl)}`}
          subValue={todayReturnPct !== 0 ? `${todayReturnPct >= 0 ? '+' : ''}${todayReturnPct.toFixed(2)}%` : null}
          colorClass={todayPnl >= 0 ? 'text-green-400' : 'text-red-400'}
          isUp={todayPnl > 0 ? true : null}
          isDown={todayPnl < 0 ? true : null}
        />

        {/* Total Return */}
        <StatCard
          label="총 수익 (Total Return)"
          value={`${totalPnl >= 0 ? '+' : ''}${fmt(totalPnl)}`}
          subValue={formatPercent(returnPct)}
          colorClass={totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}
          isUp={totalPnl > 0 ? true : null}
          isDown={totalPnl < 0 ? true : null}
        />

        {/* Holdings count */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#0d0d12] rounded-lg border border-gray-800/60">
          <span className="text-[11px] text-gray-500">보유 종목 수</span>
          <span className="text-[13px] font-medium text-white">{count} stocks</span>
        </div>

        {/* Last updated */}
        {lastRefreshed && (
          <div className="text-center text-[10px] text-gray-700 pt-1">
            Price updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        )}
        {!lastRefreshed && (
          <div className="text-center text-[10px] text-yellow-700 pt-1">
            가격이 로드 중입니다...
          </div>
        )}
      </div>
    </BaseWidget>
  );
}

// ── PortfolioPnLChartWidget ─────────────────────────────────────────────────

function PortfolioPnLChartWidget({ pnlHistory, chartTab, setChartTab, onRemove }) {
  return (
    <BaseWidget
      title="Portfolio Performance"
      icon={TrendingUp}
      iconColor="text-green-400"
      showViewToggle={false}
      showPeriodSelector={false}
      onRemove={onRemove}
      headerExtra={
        <div className="flex items-center bg-gray-800 rounded p-0.5">
          <button
            onClick={() => setChartTab('value')}
            className={`px-2 py-0.5 rounded text-xs transition-colors ${
              chartTab === 'value' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Value
          </button>
          <button
            onClick={() => setChartTab('pnl')}
            className={`px-2 py-0.5 rounded text-xs transition-colors ${
              chartTab === 'pnl' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            PNL
          </button>
        </div>
      }
    >
      <div className="p-3 h-full">
        <CommonChart
          data={pnlHistory || []}
          series={[{ key: chartTab === 'value' ? 'value' : 'pnl', name: chartTab === 'value' ? 'Value' : 'P&L', color: '#22c55e' }]}
          xKey="date"
          type="area"
          fillContainer={true}
          showTypeSelector={false}
          xFormatter={(date) => date ? date.slice(5) : date}
          yFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
        />
      </div>
    </BaseWidget>
  );
}

// ── PortfolioHoldingsWidget ─────────────────────────────────────────────────

const _fmtUSDHoldings = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val ?? 0);
const _fmtPctHoldings = (val) => `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;

function _buildHoldingsColumns(displayCurrency, exchangeRate, formatKRW) {
  const isKRW = displayCurrency === 'KRW' && exchangeRate && formatKRW;
  const fmt = isKRW ? (v) => formatKRW((v ?? 0) * exchangeRate) : _fmtUSDHoldings;

  return [
    {
      key: 'symbol',
      header: 'Asset',
      renderFn: (value, row) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-[10px] font-bold flex-shrink-0 border border-gray-700">
            {value.slice(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-white">{value}</div>
            <div className="text-[10px] text-gray-500 truncate max-w-[80px]">{row.quantity} sh</div>
          </div>
        </div>
      ),
    },
    {
      key: 'currentPrice',
      header: '현재가',
      align: 'right',
      sortable: true,
      renderFn: (value, row) => {
        const isUp = row.openPrice != null && value >= row.openPrice;
        const isDown = row.openPrice != null && value < row.openPrice;
        return (
          <div>
            <div className={`tabular-nums text-[11px] font-medium ${isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-white'}`}>
              {_fmtUSDHoldings(value)}
            </div>
            {row.dailyChangePct != null && (
              <div className={`tabular-nums text-[10px] ${row.dailyChangePct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {row.dailyChangePct >= 0 ? '+' : ''}{row.dailyChangePct.toFixed(2)}%
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'value',
      header: `평가금액${isKRW ? ' (₩)' : ''}`,
      align: 'right',
      sortable: true,
      renderFn: (value) => (
        <div>
          <div className="tabular-nums text-[11px] text-white">{fmt(value)}</div>
          {isKRW && <div className="tabular-nums text-[10px] text-gray-500">{_fmtUSDHoldings(value)}</div>}
        </div>
      ),
    },
    {
      key: 'pnl',
      header: `총 손익${isKRW ? ' (₩)' : ''}`,
      align: 'right',
      sortable: true,
      renderFn: (value, row) => (
        <div className={value >= 0 ? 'text-green-400' : 'text-red-400'}>
          <div className="tabular-nums text-[11px]">{fmt(value)}</div>
          <div className="tabular-nums text-[10px] opacity-80">{_fmtPctHoldings(row.pnlPct)}</div>
          {isKRW && <div className="tabular-nums text-[10px] opacity-50">{_fmtUSDHoldings(value)}</div>}
        </div>
      ),
    },
  ];
}

function PortfolioHoldingsWidget({
  holdings,
  onViewAll,
  onRemove,
  displayCurrency = 'USD',
  exchangeRate = null,
  formatKRW,
}) {
  const COLUMNS = _buildHoldingsColumns(displayCurrency, exchangeRate, formatKRW);

  return (
    <BaseWidget
      title="Top Holdings"
      icon={Layers}
      iconColor="text-cyan-400"
      showViewToggle={false}
      showPeriodSelector={false}
      onRemove={onRemove}
      headerExtra={
        onViewAll && (
          <button
            onClick={onViewAll}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 px-2 py-0.5 rounded hover:bg-cyan-900/30 transition-colors"
          >
            View All
          </button>
        )
      }
    >
      <CommonTable
        columns={COLUMNS}
        data={holdings.slice(0, 5)}
        searchable={false}
        exportable={false}
        compact
        pageSize={10}
      />
    </BaseWidget>
  );
}

// ── PortfolioBalancesWidget ─────────────────────────────────────────────────

const _fmtUSDBal = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val ?? 0);
const _fmtUSDCompactBal = (val) => {
  if (val == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
};

function _buildBalancesColumns(displayCurrency, exchangeRate, formatKRW) {
  const isKRW = displayCurrency === 'KRW' && exchangeRate && formatKRW;
  const fmt = isKRW ? (v) => formatKRW((v ?? 0) * exchangeRate) : _fmtUSDBal;

  function DayChangeCell({ row }) {
    if (row.dailyChange == null || row.openPrice == null) {
      return <span className="text-gray-600 text-[11px]">—</span>;
    }
    const isUp = row.dailyChange >= 0;
    return (
      <div className={isUp ? 'text-green-400' : 'text-red-400'}>
        <div className="tabular-nums text-[11px]">
          {isUp ? '+' : ''}{_fmtUSDBal(row.dailyChange)}
        </div>
        <div className="tabular-nums text-[10px] opacity-80">
          {isUp ? '+' : ''}{row.dailyChangePct?.toFixed(2)}%
        </div>
      </div>
    );
  }

  function TodayPnlCell({ row }) {
    if (row.todayPnl == null) return <span className="text-gray-600 text-[11px]">—</span>;
    const isUp = row.todayPnl >= 0;
    return (
      <div className={isUp ? 'text-green-400' : 'text-red-400'}>
        <div className="tabular-nums text-[11px]">{isUp ? '+' : ''}{fmt(row.todayPnl)}</div>
        {isKRW && (
          <div className="tabular-nums text-[10px] text-gray-500">{isUp ? '+' : ''}{_fmtUSDBal(row.todayPnl)}</div>
        )}
      </div>
    );
  }

  return [
    {
      key: 'symbol',
      header: 'Asset',
      renderFn: (value, row) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-[10px] font-bold flex-shrink-0 border border-gray-700">
            {row.symbol.slice(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-white">{row.symbol}</div>
            <div className="text-[10px] text-gray-500">{row.quantity} shares</div>
          </div>
        </div>
      ),
    },
    {
      key: 'avgCost',
      header: 'Avg Cost',
      align: 'right',
      sortable: true,
      renderFn: (value, row) => <span className="tabular-nums text-[11px] text-gray-400">{_fmtUSDCompactBal(row.avgCost)}</span>,
    },
    {
      key: 'openPrice',
      header: '시가',
      align: 'right',
      sortable: true,
      renderFn: (value, row) => (
        row.openPrice != null
          ? <span className="tabular-nums text-[11px] text-gray-300">{_fmtUSDCompactBal(row.openPrice)}</span>
          : <span className="text-gray-600 text-[11px]">—</span>
      ),
    },
    {
      key: 'currentPrice',
      header: '현재가',
      align: 'right',
      sortable: true,
      renderFn: (value, row) => {
        const isUp = row.openPrice != null && row.currentPrice >= row.openPrice;
        const isDown = row.openPrice != null && row.currentPrice < row.openPrice;
        return (
          <span className={`tabular-nums text-[11px] font-medium ${isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-white'}`}>
            {_fmtUSDCompactBal(row.currentPrice)}
          </span>
        );
      },
    },
    {
      key: 'dayChange',
      header: '당일 변동',
      align: 'right',
      sortable: true,
      accessorFn: (row) => row.dailyChange ?? 0,
      renderFn: (value, row) => <DayChangeCell row={row} />,
    },
    {
      key: 'todayPnl',
      header: '오늘 손익',
      align: 'right',
      sortable: true,
      renderFn: (value, row) => <TodayPnlCell row={row} />,
    },
    {
      key: 'value',
      header: `평가금액${isKRW ? ' (₩)' : ''}`,
      align: 'right',
      sortable: true,
      renderFn: (value, row) => (
        <div>
          <div className="tabular-nums text-[11px] text-white font-medium">{fmt(row.value)}</div>
          {isKRW && <div className="tabular-nums text-[10px] text-gray-500">{_fmtUSDBal(row.value)}</div>}
        </div>
      ),
    },
    {
      key: 'pnl',
      header: `총 손익${isKRW ? ' (₩)' : ''}`,
      align: 'right',
      sortable: true,
      renderFn: (value, row) => {
        if (row._noPrices) return <span className="text-gray-600 text-[11px]">—</span>;
        return (
          <div className={row.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
            <div className="tabular-nums text-[11px]">{row.pnl >= 0 ? '+' : ''}{fmt(row.pnl)}</div>
            <div className="tabular-nums text-[10px] opacity-80">{row.pnlPct >= 0 ? '+' : ''}{row.pnlPct.toFixed(2)}%</div>
            {isKRW && <div className="tabular-nums text-[10px] opacity-50">{row.pnl >= 0 ? '+' : ''}{_fmtUSDBal(row.pnl)}</div>}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      sortable: false,
      renderFn: () => (
        <button className="text-cyan-400 hover:text-cyan-300 text-[11px] px-1.5 py-0.5 rounded hover:bg-cyan-900/20 transition-colors">
          Trade
        </button>
      ),
    },
  ];
}

function PortfolioBalancesWidget({
  holdings,
  hideSmallBalances,
  setHideSmallBalances,
  onRemove,
  displayCurrency = 'USD',
  exchangeRate = null,
  formatKRW,
}) {
  const data = holdings.map((h) => ({ ...h, _key: h.symbol }));
  const hasPriceData = holdings.some(h => h.openPrice != null);
  const COLUMNS = _buildBalancesColumns(displayCurrency, exchangeRate, formatKRW);

  return (
    <BaseWidget
      title="Balances"
      icon={Wallet}
      iconColor="text-cyan-400"
      showViewToggle={false}
      showPeriodSelector={false}
      onRemove={onRemove}
      headerExtra={
        <div className="flex items-center gap-3">
          {!hasPriceData && (
            <span className="text-[10px] text-yellow-600">시가/현재가: 새로고침 필요</span>
          )}
          <label className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideSmallBalances}
              onChange={(e) => setHideSmallBalances(e.target.checked)}
              className="w-3 h-3 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-0 focus:ring-offset-0"
            />
            Hide small
          </label>
        </div>
      }
    >
      <div className="overflow-auto h-full">
        <CommonTable
          columns={COLUMNS}
          data={data}
          compact={true}
          searchable={false}
          exportable={false}
          pageSize={50}
        />
      </div>
    </BaseWidget>
  );
}

// ── PortfolioPositionsWidget ────────────────────────────────────────────────

const _fmtUSDPos = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val ?? 0);
const _fmtUSDCompactPos = (val) => {
  if (val == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
};

function _buildPositionsColumns(displayCurrency, exchangeRate, formatKRW) {
  const isKRW = displayCurrency === 'KRW' && exchangeRate && formatKRW;
  const fmt = isKRW ? (v) => formatKRW((v ?? 0) * exchangeRate) : _fmtUSDPos;

  return [
    {
      key: 'symbol',
      header: 'Symbol',
      renderFn: (value, row) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-[10px] font-bold flex-shrink-0 border border-gray-700">
            {value.slice(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-white">{value}</div>
            <div className="text-[10px] text-gray-600">{row.quantity} shares</div>
          </div>
        </div>
      ),
    },
    {
      key: 'avgCost',
      header: 'Avg Cost',
      align: 'right',
      sortable: true,
      renderFn: (value) => <span className="tabular-nums text-[11px] text-gray-400">{_fmtUSDCompactPos(value)}</span>,
    },
    {
      key: 'openPrice',
      header: '시가',
      align: 'right',
      sortable: true,
      renderFn: (value) =>
        value != null
          ? <span className="tabular-nums text-[11px] text-gray-300">{_fmtUSDCompactPos(value)}</span>
          : <span className="text-gray-600 text-[11px]">—</span>,
    },
    {
      key: 'currentPrice',
      header: '현재가',
      align: 'right',
      sortable: true,
      renderFn: (value, row) => {
        const isUp = row.openPrice != null && value >= row.openPrice;
        const isDown = row.openPrice != null && value < row.openPrice;
        return (
          <div>
            <div className={`tabular-nums text-[11px] font-medium ${isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-white'}`}>
              {_fmtUSDCompactPos(value)}
            </div>
            {row.dailyChangePct != null && (
              <div className={`tabular-nums text-[10px] ${row.dailyChangePct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {row.dailyChangePct >= 0 ? '+' : ''}{row.dailyChangePct.toFixed(2)}%
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'quantity',
      header: 'Qty',
      align: 'right',
      sortable: true,
      renderFn: (value) => <span className="tabular-nums text-[11px]">{value}</span>,
    },
    {
      key: 'todayPnl',
      header: '오늘 손익',
      align: 'right',
      sortable: true,
      renderFn: (value) => {
        if (value == null) return <span className="text-gray-600 text-[11px]">—</span>;
        const isUp = value >= 0;
        return (
          <div className={`tabular-nums text-[11px] font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>
            <div>{isUp ? '+' : ''}{fmt(value)}</div>
            {isKRW && <div className="text-[10px] opacity-60">{isUp ? '+' : ''}{_fmtUSDPos(value)}</div>}
          </div>
        );
      },
    },
    {
      key: 'value',
      header: `평가금액${isKRW ? ' (₩)' : ''}`,
      align: 'right',
      sortable: true,
      renderFn: (value) => (
        <div>
          <div className="tabular-nums text-[11px] text-white">{fmt(value)}</div>
          {isKRW && <div className="tabular-nums text-[10px] text-gray-500">{_fmtUSDPos(value)}</div>}
        </div>
      ),
    },
    {
      key: 'pnl',
      header: `총 손익${isKRW ? ' (₩)' : ''}`,
      align: 'right',
      sortable: true,
      renderFn: (value, row) => {
        if (row._noPrices) return <span className="text-gray-600 text-[11px]" title="No live price">—</span>;
        return (
          <div className={value >= 0 ? 'text-green-400' : 'text-red-400'}>
            <div className="tabular-nums text-[11px]">{value >= 0 ? '+' : ''}{fmt(value)}</div>
            <div className="tabular-nums text-[10px] opacity-80">{row.pnlPct >= 0 ? '+' : ''}{row.pnlPct.toFixed(2)}%</div>
            {isKRW && <div className="tabular-nums text-[10px] opacity-50">{value >= 0 ? '+' : ''}{_fmtUSDPos(value)}</div>}
          </div>
        );
      },
    },
  ];
}

function PortfolioPositionsWidget({
  holdings,
  onRemove,
  displayCurrency = 'USD',
  exchangeRate = null,
  formatKRW,
}) {
  const COLUMNS = _buildPositionsColumns(displayCurrency, exchangeRate, formatKRW);

  return (
    <BaseWidget
      title="Positions"
      icon={Activity}
      iconColor="text-yellow-400"
      showViewToggle={false}
      showPeriodSelector={false}
      onRemove={onRemove}
    >
      <CommonTable
        columns={COLUMNS}
        data={holdings}
        searchable={false}
        exportable={false}
        compact
        pageSize={20}
      />
    </BaseWidget>
  );
}

// ── PortfolioTradeHistoryWidget ─────────────────────────────────────────────

const _fmtTxn = (val, dec = 2) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: dec }).format(val ?? 0);
const _fmtKRWLocal = (val) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(Math.round(val ?? 0));

const TYPE_BADGE = {
  buy:      { label: 'BUY',  cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  sell:     { label: 'SELL', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  dividend: { label: 'DIV',  cls: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
};

function CurrentPnlCell({ row, exchangeRate }) {
  if (row.transaction_type !== 'buy') {
    if (row.transaction_type === 'sell') return <span className="text-[11px] text-gray-600 italic">realized</span>;
    return <span className="text-gray-700 text-[11px]">—</span>;
  }
  if (row.currentPnl == null) return <span className="text-gray-600 text-[11px]">—</span>;
  const isUp = row.currentPnl >= 0;
  return (
    <div className={isUp ? 'text-green-400' : 'text-red-400'}>
      <div className="tabular-nums text-[11px] font-medium">{isUp ? '+' : ''}{_fmtTxn(row.currentPnl)}</div>
      <div className="tabular-nums text-[10px] opacity-75">{row.currentPnlPct >= 0 ? '+' : ''}{row.currentPnlPct?.toFixed(2)}%</div>
      {exchangeRate && (
        <div className="tabular-nums text-[10px] text-gray-500">
          {isUp ? '+' : ''}{_fmtKRWLocal(row.currentPnl * exchangeRate)}
        </div>
      )}
    </div>
  );
}

function ActionCell({ row, onEdit, onDelete, deletingId }) {
  const isDeleting = deletingId === row.transaction_id;
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(row); }}
        className="p-1 text-gray-600 hover:text-yellow-400 hover:bg-yellow-900/20 rounded transition-colors"
        title="수정"
      >
        <Pencil size={11} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(row); }}
        disabled={isDeleting}
        className="p-1 text-gray-600 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors disabled:opacity-40"
        title="삭제"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

const _buildTxnColumns = (hasPriceData, onEdit, onDelete, deletingId, exchangeRate) => [
  {
    key: 'transaction_date',
    header: 'Date',
    sortable: true,
    renderFn: (value, row) => (
      <span className="tabular-nums text-[11px] text-gray-300">
        {row.transaction_date ? row.transaction_date.slice(0, 10) : '-'}
      </span>
    ),
  },
  {
    key: 'ticker_cd',
    header: 'Symbol',
    sortable: true,
    renderFn: (value, row) => (
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-gray-800 flex items-center justify-center text-[10px] font-bold border border-gray-700 flex-shrink-0">
          {(row.ticker_cd || '??').slice(0, 2)}
        </div>
        <span className="text-[11px] font-medium text-white">{row.ticker_cd}</span>
      </div>
    ),
  },
  {
    key: 'transaction_type',
    header: 'Type',
    sortable: true,
    renderFn: (value, row) => {
      const badge = TYPE_BADGE[row.transaction_type] || { label: row.transaction_type?.toUpperCase(), cls: 'bg-gray-700 text-gray-300 border-gray-600' };
      return <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${badge.cls}`}>{badge.label}</span>;
    },
  },
  {
    key: 'quantity',
    header: 'Qty',
    align: 'right',
    sortable: true,
    renderFn: (value, row) => <span className="tabular-nums text-[11px]">{row.quantity?.toLocaleString()}</span>,
  },
  {
    key: 'price',
    header: '거래가',
    align: 'right',
    sortable: true,
    renderFn: (value, row) => (
      <div>
        <div className="tabular-nums text-[11px]">{_fmtTxn(row.price)}</div>
        {exchangeRate && (
          <div className="tabular-nums text-[10px] text-gray-500">{_fmtKRWLocal(row.price * exchangeRate)}</div>
        )}
      </div>
    ),
  },
  ...(hasPriceData ? [{
    key: 'currentPrice',
    header: '현재가',
    align: 'right',
    renderFn: (value, row) => {
      if (row.transaction_type !== 'buy' || row.currentPrice == null) return <span className="text-gray-700 text-[11px]">—</span>;
      const isUp = row.currentPrice >= row.price;
      return (
        <div>
          <div className={`tabular-nums text-[11px] font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>{_fmtTxn(row.currentPrice)}</div>
          {exchangeRate && (
            <div className="tabular-nums text-[10px] text-gray-500">{_fmtKRWLocal(row.currentPrice * exchangeRate)}</div>
          )}
        </div>
      );
    },
  }] : []),
  {
    key: 'currentPnl',
    header: '현재 손익',
    align: 'right',
    sortable: hasPriceData,
    renderFn: (value, row) => <CurrentPnlCell row={row} exchangeRate={exchangeRate} />,
  },
  {
    key: 'total_amount',
    header: '거래금액',
    align: 'right',
    sortable: true,
    renderFn: (value, row) => {
      const isNeg = row.transaction_type === 'buy';
      return (
        <div>
          <div className={`tabular-nums text-[11px] font-medium ${isNeg ? 'text-red-400' : 'text-green-400'}`}>
            {isNeg ? '-' : '+'}{_fmtTxn(row.total_amount)}
          </div>
          {exchangeRate && (
            <div className="tabular-nums text-[10px] text-gray-500">
              {isNeg ? '-' : '+'}{_fmtKRWLocal(row.total_amount * exchangeRate)}
            </div>
          )}
        </div>
      );
    },
  },
  {
    key: 'commission',
    header: 'Fee',
    align: 'right',
    renderFn: (value, row) => (
      <div>
        <div className="tabular-nums text-[11px] text-gray-500">{row.commission ? _fmtTxn(row.commission) : '-'}</div>
        {exchangeRate && row.commission ? (
          <div className="tabular-nums text-[10px] text-gray-600">{_fmtKRWLocal(row.commission * exchangeRate)}</div>
        ) : null}
      </div>
    ),
  },
  {
    key: 'notes',
    header: 'Notes',
    renderFn: (value, row) => <span className="text-[11px] text-gray-500 truncate max-w-[100px] inline-block">{row.notes || '-'}</span>,
  },
  {
    key: '_actions',
    header: '',
    align: 'right',
    sortable: false,
    renderFn: (value, row) => <ActionCell row={row} onEdit={onEdit} onDelete={onDelete} deletingId={deletingId} />,
  },
];

function PortfolioTradeHistoryWidget({
  transactions,
  loading,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  priceQuotes = {},
  onRemove,
  exchangeRate = null,
  formatKRW,
}) {
  const [deletingId, setDeletingId] = useState(null);
  const hasPriceData = Object.keys(priceQuotes).length > 0;

  const handleDeleteClick = async (row) => {
    if (!window.confirm(`${row.ticker_cd} 거래를 삭제하시겠습니까?\n거래가: ${_fmtTxn(row.price)} × ${row.quantity}주`)) return;
    setDeletingId(row.transaction_id);
    try {
      await onDeleteTransaction?.(row);
    } finally {
      setDeletingId(null);
    }
  };

  const data = (transactions || []).map((t, i) => {
    const currentPrice = priceQuotes[t.ticker_cd]?.price ?? null;
    let currentPnl = null, currentPnlPct = null;
    if (t.transaction_type === 'buy' && currentPrice != null && t.price) {
      const diff = currentPrice - t.price;
      currentPnl    = diff * t.quantity;
      currentPnlPct = (diff / t.price) * 100;
    }
    return { ...t, _key: t.transaction_id || `txn-${i}`, currentPrice, currentPnl, currentPnlPct };
  });

  const COLUMNS = _buildTxnColumns(hasPriceData, onEditTransaction, handleDeleteClick, deletingId, exchangeRate);

  return (
    <BaseWidget
      title="Trade History"
      icon={History}
      iconColor="text-purple-400"
      showViewToggle={false}
      showPeriodSelector={false}
      loading={loading}
      onRemove={onRemove}
      headerExtra={
        onAddTransaction && (
          <button
            onClick={onAddTransaction}
            className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 px-2 py-0.5 rounded hover:bg-cyan-900/20 transition-colors"
          >
            <Plus size={12} />
            Add
          </button>
        )
      }
    >
      <div className="overflow-auto h-full">
        <CommonTable
          columns={COLUMNS}
          data={data}
          compact={true}
          searchable={false}
          exportable={true}
          pageSize={50}
        />
      </div>
    </BaseWidget>
  );
}

// ── WidgetRenderer ──────────────────────────────────────────────────────────

export default function WidgetRenderer({ widget, symbol, onSymbolChange, portfolioData, onRemove }) {
  const sym = symbol || 'AAPL';

  switch (widget.type) {

    // ── Portfolio (needs portfolioData props from parent state) ────────────
    case 'portfolio-stats': {
      const p = portfolioData || {};
      const fmtKRW = p.formatKRW || _fmtKRW;
      return (
        <PortfolioStatsWidget
          stats={p.stats || {}}
          selectedAccountType={p.selectedAccountType || 'all'}
          setSelectedAccountType={p.setSelectedAccountType || (() => {})}
          selectedPeriod={p.selectedPeriod || '30D'}
          setSelectedPeriod={p.setSelectedPeriod || (() => {})}
          formatCurrency={formatCurrency}
          formatPercent={formatPercent}
          lastRefreshed={p.lastRefreshed}
          displayCurrency={p.displayCurrency || 'USD'}
          exchangeRate={p.exchangeRate}
          formatKRW={fmtKRW}
          onRemove={onRemove}
        />
      );
    }

    case 'portfolio-chart': {
      const p = portfolioData || {};
      return (
        <PortfolioPnLChartWidget
          pnlHistory={p.pnlHistory || []}
          chartTab={p.chartTab || 'value'}
          setChartTab={p.setChartTab || (() => {})}
          onRemove={onRemove}
        />
      );
    }

    case 'portfolio-holdings': {
      const p = portfolioData || {};
      const fmtKRW = p.formatKRW || _fmtKRW;
      return (
        <PortfolioHoldingsWidget
          holdings={p.filteredHoldings || []}
          onViewAll={() => {}}
          displayCurrency={p.displayCurrency || 'USD'}
          exchangeRate={p.exchangeRate}
          formatKRW={fmtKRW}
          onRemove={onRemove}
        />
      );
    }

    case 'portfolio-balances': {
      const p = portfolioData || {};
      const fmtKRW = p.formatKRW || _fmtKRW;
      return (
        <PortfolioBalancesWidget
          holdings={p.filteredHoldings || []}
          hideSmallBalances={p.hideSmallBalances || false}
          setHideSmallBalances={p.setHideSmallBalances || (() => {})}
          displayCurrency={p.displayCurrency || 'USD'}
          exchangeRate={p.exchangeRate}
          formatKRW={fmtKRW}
          onRemove={onRemove}
        />
      );
    }

    case 'portfolio-positions': {
      const p = portfolioData || {};
      const fmtKRW = p.formatKRW || _fmtKRW;
      return (
        <PortfolioPositionsWidget
          holdings={p.filteredHoldings || []}
          displayCurrency={p.displayCurrency || 'USD'}
          exchangeRate={p.exchangeRate}
          formatKRW={fmtKRW}
          onRemove={onRemove}
        />
      );
    }

    case 'portfolio-trade-history': {
      const p = portfolioData || {};
      return (
        <PortfolioTradeHistoryWidget
          transactions={p.transactions || []}
          loading={p.loadingTransactions || false}
          onAddTransaction={() => p.setShowAddTransaction?.(true)}
          onEditTransaction={(txn) => p.setEditingTransaction?.(txn)}
          onDeleteTransaction={p.handleDeleteTransaction || (() => {})}
          priceQuotes={p.priceQuotes || {}}
          exchangeRate={p.exchangeRate}
          formatKRW={p.formatKRW || _fmtKRW}
          onRemove={onRemove}
        />
      );
    }

    // ── All other widgets → widgetConfigs lookup ───────────────────────────
    default:
      if (UNIVERSAL_WIDGET_CONFIGS[widget.type]) {
        return (
          <UniversalWidget
            widgetId={widget.type}
            symbol={sym}
            portfolioId={portfolioData?.selectedPortfolio?.portfolio_id}
            onRemove={onRemove}
          />
        );
      }
      return (
        <div className="flex items-center justify-center h-full text-gray-500 text-sm">
          Unknown widget: {widget.type}
        </div>
      );
  }
}
