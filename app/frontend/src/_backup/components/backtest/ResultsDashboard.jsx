import React from 'react';
import { TrendingUp, TrendingDown, Activity, Target, BarChart3, Shield } from 'lucide-react';
import BacktestChartWidget from './BacktestChartWidget';
import PerformanceTable from './PerformanceTable';

/* ── helpers ───────────────────────────────────────────────────────────── */
const fmt = (v, dec = 2) => v == null ? 'N/A' : v.toFixed(dec);
const fmtCur = (v) =>
  v == null ? '$0' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
const fmtPct = (v, plus = true) =>
  v == null ? 'N/A' : `${plus && v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

/* ── single metric tile ─────────────────────────────────────────────────── */
const Tile = ({ label, value, sub, positive }) => (
  <div className="bg-[#0d0d12] border border-gray-800 rounded-xl p-4">
    <div className="text-[11px] text-gray-500 mb-2 font-medium uppercase tracking-wider">{label}</div>
    <div className={`text-xl font-bold ${
      positive === true ? 'text-green-400' :
      positive === false ? 'text-red-400' :
      'text-white'
    }`}>{value}</div>
    {sub && <div className="text-[11px] text-gray-500 mt-1">{sub}</div>}
  </div>
);

/* ── empty / loading state ─────────────────────────────────────────────── */
const EmptyState = ({ loading }) => (
  <div className="flex flex-col items-center justify-center h-full min-h-[480px] text-center">
    {loading ? (
      <>
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-400 text-sm">백테스트를 실행하는 중입니다...</p>
        <p className="text-gray-600 text-xs mt-1">과거 데이터를 분석하고 있습니다</p>
      </>
    ) : (
      <>
        <div className="p-4 bg-gray-800/40 rounded-full mb-4">
          <BarChart3 size={36} className="text-gray-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-400 mb-1">결과가 없습니다</h3>
        <p className="text-gray-600 text-sm max-w-xs">
          왼쪽 패널에서 종목을 구성하고 <br />
          <span className="text-blue-400">"백테스트 실행"</span>을 눌러주세요
        </p>
      </>
    )}
  </div>
);

/* ── main ──────────────────────────────────────────────────────────────── */
const ResultsDashboard = ({ results, config, loading = false }) => {
  if (!results) return <EmptyState loading={loading} />;

  const { statistics: s, yearly_returns, portfolio_values, benchmark_values } = results;
  const firstVal = portfolio_values?.[0]?.value;
  const lastVal = portfolio_values?.[portfolio_values.length - 1]?.value;
  const totalGain = lastVal != null && firstVal != null ? lastVal - firstVal : null;
  const bestYear = yearly_returns?.length > 0
    ? Math.max(...yearly_returns.map(y => parseFloat(y.return || 0)))
    : null;
  const worstYear = yearly_returns?.length > 0
    ? Math.min(...yearly_returns.map(y => parseFloat(y.return || 0)))
    : null;

  return (
    <div className="space-y-5">

      {/* ── 4 key metrics ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile
          label="총 수익률"
          value={fmtPct(s.totalReturn)}
          sub={`연평균 ${fmtPct(s.annualizedReturn)}`}
          positive={s.totalReturn >= 0}
        />
        <Tile
          label="샤프 비율"
          value={fmt(s.sharpeRatio)}
          sub="위험 대비 수익"
          positive={s.sharpeRatio >= 1 ? true : s.sharpeRatio >= 0 ? null : false}
        />
        <Tile
          label="최대 낙폭 (MDD)"
          value={`${fmt(s.maxDrawdown)}%`}
          sub="최악의 하락 구간"
          positive={false}
        />
        <Tile
          label="승률"
          value={`${fmt(s.winRate)}%`}
          sub={`변동성 ${fmt(s.volatility)}%`}
          positive={s.winRate >= 50 ? true : null}
        />
      </div>

      {/* ── Equity Curve ──────────────────────────────────────────────── */}
      <BacktestChartWidget results={results} config={config} />

      {/* ── Secondary stats ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Capital Summary */}
        <div className="bg-[#0d0d12] border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target size={14} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-white">자본금 요약</h3>
          </div>
          <div className="space-y-3">
            {[
              { label: '초기 투자금', value: fmtCur(firstVal) },
              { label: '최종 평가금', value: fmtCur(lastVal) },
              {
                label: '총 손익',
                value: totalGain != null
                  ? `${totalGain >= 0 ? '+' : ''}${fmtCur(totalGain)}`
                  : 'N/A',
                positive: totalGain != null ? totalGain >= 0 : null,
              },
              { label: '최고 연도', value: bestYear != null ? fmtPct(bestYear) : 'N/A', positive: bestYear != null && bestYear >= 0 },
              { label: '최저 연도', value: worstYear != null ? fmtPct(worstYear) : 'N/A', positive: false },
            ].map(({ label, value, positive }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-xs text-gray-400">{label}</span>
                <span className={`text-sm font-semibold ${
                  positive === true ? 'text-green-400' :
                  positive === false ? 'text-red-400' :
                  'text-white'
                }`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Stats */}
        <div className="bg-[#0d0d12] border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={14} className="text-purple-400" />
            <h3 className="text-sm font-semibold text-white">성과 지표</h3>
          </div>
          <div className="space-y-3">
            {[
              { label: '연환산 수익률', value: fmtPct(s.annualizedReturn), positive: s.annualizedReturn >= 0 },
              { label: '연간 변동성', value: `${fmt(s.volatility)}%` },
              { label: '샤프 비율', value: fmt(s.sharpeRatio), positive: s.sharpeRatio >= 1 ? true : s.sharpeRatio >= 0 ? null : false },
              { label: '최대 낙폭', value: `${fmt(s.maxDrawdown)}%`, positive: false },
              { label: '승률 (양수 일)', value: `${fmt(s.winRate)}%`, positive: s.winRate >= 50 ? true : null },
            ].map(({ label, value, positive }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-xs text-gray-400">{label}</span>
                <span className={`text-sm font-semibold ${
                  positive === true ? 'text-green-400' :
                  positive === false ? 'text-red-400' :
                  'text-white'
                }`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Yearly Returns Table ───────────────────────────────────────── */}
      <PerformanceTable yearlyReturns={yearly_returns || []} benchmark={config?.benchmark} />
    </div>
  );
};

export default ResultsDashboard;
