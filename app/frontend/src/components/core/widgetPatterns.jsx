/**
 * widgetPatterns.jsx — Reusable widget display primitives
 *
 * 반복되는 UI 패턴을 공통 컴포넌트로 제공.
 * widgetConfigs.jsx의 renderBody에서 import해서 사용하면
 * configs 파일에 JSX를 최소화할 수 있다.
 *
 * Exports:
 *   VerticalBarChart    — 세로 막대 차트 (SWOT, Moat, Scorecard, Financials 등)
 *   TabBar              — 탭 네비게이션 바
 *   ProgressBarDisplay  — 수평 진행 막대 목록 + 통계 footer
 *   KVTable             — Key-Value 테이블
 *   TransactionDisplay  — 매수/매도 트랜잭션 요약 + 테이블
 *   StockSentimentBody  — 뉴스 감성 탭 위젯 (news / trend / summary)
 */

import { useState } from 'react';
import { fmtMagnitude, fmtNum } from '../../utils/formatUtils';

// ── VerticalBarChart ───────────────────────────────────────────────────────────
/**
 * bars: [{ label, value, displayValue?, color, textClass? }]
 */
export function VerticalBarChart({ bars, height = 140 }) {
  const maxVal = Math.max(...bars.map(b => Math.abs(b.value ?? 0)), 1);
  return (
    <div className="flex flex-col" style={{ height }}>
      <div className="flex justify-around mb-1">
        {bars.map((b, i) => (
          <span key={i} className={`text-[9px] font-medium tabular-nums flex-1 text-center ${b.textClass || 'text-gray-400'}`}>
            {b.displayValue ?? b.value ?? 0}
          </span>
        ))}
      </div>
      <div className="flex-1 flex items-end justify-around gap-1.5 min-h-0">
        {bars.map((b, i) => {
          const val = Math.max(0, b.value ?? 0);
          return (
            <div key={i} className="flex-1 flex justify-center items-end h-full">
              <div
                className="w-full max-w-[48px] rounded-t transition-all duration-700"
                style={{ height: `${(val / maxVal) * 100}%`, backgroundColor: b.color, minHeight: val > 0 ? '3px' : 0 }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-around border-t border-gray-800 pt-1.5 mt-1">
        {bars.map((b, i) => (
          <span key={i} className="text-[9px] text-gray-500 text-center flex-1 leading-tight">{b.label}</span>
        ))}
      </div>
    </div>
  );
}

// ── TabBar ─────────────────────────────────────────────────────────────────────
/**
 * tabs: [{ id, label }]
 * activeColor: tailwind class string for active tab text+border color, e.g. 'text-cyan-400 border-cyan-400'
 */
export function TabBar({ tabs, activeTab, onSelect, activeColor = 'text-cyan-400 border-cyan-400' }) {
  return (
    <div className="flex border-b border-gray-800 px-3 pt-1 flex-shrink-0">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={`px-3 py-1.5 text-[11px] font-medium border-b-2 transition-colors ${
            activeTab === t.id
              ? activeColor
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── ProgressBarDisplay ─────────────────────────────────────────────────────────
/**
 * items: [{ label, value, maxValue?, color, textClass, formatValue? }]
 *   maxValue: optional — if omitted, uses max of all values
 *   formatValue: optional function (value) => string
 * footerStats: optional [{ label, value }]
 */
export function ProgressBarDisplay({ items, footerStats }) {
  const maxVal = Math.max(...items.map(b => Math.abs(b.value ?? 0)), 1);
  return (
    <div className="overflow-auto h-full p-3 space-y-3">
      {items.map(b => {
        const displayMax = b.maxValue ?? maxVal;
        const pct = Math.min(100, (Math.abs(b.value ?? 0) / displayMax) * 100);
        const display = b.formatValue ? b.formatValue(b.value) : `${(b.value ?? 0).toFixed(1)}%`;
        return (
          <div key={b.label}>
            <div className="flex items-center justify-between mb-0.5 text-xs">
              <span className="text-gray-300">{b.label}</span>
              <span className={`font-medium tabular-nums ml-2 flex-shrink-0 ${b.textClass || 'text-white'}`}>{display}</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: b.color }}
              />
            </div>
          </div>
        );
      })}
      {footerStats?.length > 0 && (
        <div className="border-t border-gray-800 pt-2.5 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
          {footerStats.map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center">
              <span className="text-gray-500">{label}</span>
              <span className="font-medium tabular-nums text-white">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── KVTable ────────────────────────────────────────────────────────────────────
/**
 * rows: [{ label, value, color? }]
 * sections: optional — if label is a section header, use { section: true, label }
 */
export function KVTable({ rows }) {
  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-xs">
        <tbody>
          {rows.map((row, idx) => {
            if (row.section) {
              return (
                <tr key={`s-${idx}`} className="border-t border-gray-800">
                  <td colSpan={2} className="py-2 px-3 text-gray-400 text-[10px] font-medium uppercase tracking-wide">
                    {row.label}
                  </td>
                </tr>
              );
            }
            return (
              <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/20">
                <td className="py-2.5 px-4 text-gray-400">{row.label}</td>
                <td className={`py-2.5 px-4 text-right font-medium tabular-nums ${row.color || 'text-white'}`}>
                  {row.value}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── TransactionDisplay ─────────────────────────────────────────────────────────
/**
 * 내부자 거래 표시: table모드 = 거래 목록, chart모드 = 요약 진행 막대 + 최근 거래
 *
 * rawData: { transactions: [...], summary: { buy_value, sell_value } }
 * viewMode: 'table' | 'chart'
 */
export function TransactionDisplay({ rawData, viewMode }) {
  const transactions = rawData?.transactions || [];
  const summary      = rawData?.summary;

  if (viewMode === 'table') {
    return (
      <div className="h-full overflow-auto p-2">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0d0d12]">
            <tr className="border-b border-gray-800">
              <th className="text-left py-2 px-2 text-gray-400">Date</th>
              <th className="text-left py-2 px-2 text-gray-400">Name</th>
              <th className="text-center py-2 px-2 text-gray-400">Type</th>
              <th className="text-right py-2 px-2 text-gray-400">Shares</th>
              <th className="text-right py-2 px-2 text-gray-400">Value</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, i) => {
              const isBuy = tx.acquisition_or_disposition === 'A';
              return (
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-1.5 px-2 text-gray-300">{tx.transaction_date}</td>
                  <td className="py-1.5 px-2 text-white truncate max-w-[120px]">{tx.insider_name || 'Unknown'}</td>
                  <td className="py-1.5 px-2 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${isBuy ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {isBuy ? 'Buy' : 'Sell'}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-right text-gray-300">{fmtNum(tx.shares_traded)}</td>
                  <td className="py-1.5 px-2 text-right text-white font-medium">
                    {fmtMagnitude(Math.abs(tx.transaction_value || 0))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // chart/default mode: 요약 막대 + 최근 거래
  const buyTotal   = Math.abs(summary?.buy_value  || 0);
  const sellTotal  = Math.abs(summary?.sell_value || 0);
  const maxSummary = Math.max(buyTotal, sellTotal, 1);
  const topTx      = transactions.slice(0, 6);
  const maxTxVal   = Math.max(...topTx.map(t => Math.abs(t.transaction_value || 0)), 1);

  return (
    <div className="overflow-auto h-full p-3 space-y-4">
      {summary && (
        <div className="space-y-2.5">
          <p className="text-[10px] text-gray-600 uppercase tracking-wide">Activity Summary</p>
          {[
            { label: 'Total Buys',  value: buyTotal,  color: '#22c55e', textClass: 'text-green-400' },
            { label: 'Total Sells', value: sellTotal, color: '#ef4444', textClass: 'text-red-400' },
          ].map(b => (
            <div key={b.label}>
              <div className="flex items-center justify-between mb-0.5 text-xs">
                <span className="text-gray-300">{b.label}</span>
                <span className={`font-medium tabular-nums ml-2 flex-shrink-0 ${b.textClass}`}>
                  {fmtMagnitude(b.value)}
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div className="h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${(b.value / maxSummary) * 100}%`, backgroundColor: b.color }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {topTx.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-[10px] text-gray-600 uppercase tracking-wide">Recent Transactions</p>
          {topTx.map((tx, i) => {
            const isBuy = tx.acquisition_or_disposition === 'A';
            const val   = Math.abs(tx.transaction_value || 0);
            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-0.5 text-xs">
                  <span className="text-gray-300 truncate max-w-[70%]">{tx.insider_name || 'Unknown'}</span>
                  <span className={`font-medium tabular-nums ml-2 flex-shrink-0 ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
                    {isBuy ? '+' : '-'}{fmtMagnitude(val)}
                  </span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div className="h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${(val / maxTxVal) * 100}%`, backgroundColor: isBuy ? '#22c55e' : '#ef4444' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── StockSentimentBody ─────────────────────────────────────────────────────────
/**
 * 뉴스 감성 3탭 뷰: news | trend | summary
 * data: { news, aggregate, trend }
 */
export function StockSentimentBody({ data, activeView, setActiveView }) {
  const [trendRange, setTrendRange] = useState('30D');
  const news  = data?.news || [];
  const agg   = data?.aggregate || {};
  const trend = data?.trend || [];
  const filteredTrend = trendRange === '7D' ? trend.slice(-7) : trend.slice(-30);
  const tabs  = ['news', 'trend', 'summary'];
  const view  = activeView ?? 'news';

  return (
    <>
      <div className="flex border-b border-gray-800 px-3 pt-1">
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveView(t)}
            className={`px-3 py-1.5 text-[11px] font-medium border-b-2 transition-colors capitalize ${
              view === t ? 'border-pink-400 text-pink-400' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}>{t}</button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {view === 'news' && (
          <div className="divide-y divide-gray-800">
            {news.length > 0 ? news.slice(0, 20).map((item, i) => (
              <div key={i} className="px-3 py-2 hover:bg-gray-800/30">
                <div className="flex items-start justify-between gap-2">
                  <a href={item.article_url} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] text-gray-200 hover:text-white line-clamp-2 flex-1">{item.title}</a>
                  <span className={`text-[9px] font-medium capitalize flex-shrink-0 ${{ positive: 'text-green-400', negative: 'text-red-400', neutral: 'text-gray-400' }[item.sentiment] || 'text-gray-400'}`}>
                    {item.sentiment}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-gray-600">{item.publisher}</span>
                  <span className="text-[10px] text-gray-700">·</span>
                  <span className="text-[10px] text-gray-600">
                    {item.published_utc ? new Date(item.published_utc).toLocaleDateString() : ''}
                  </span>
                </div>
              </div>
            )) : <div className="text-center text-gray-500 text-xs py-8">No news data</div>}
          </div>
        )}
        {view === 'trend' && (
          <div className="h-full flex flex-col p-3">
            <div className="flex gap-2 mb-2">
              {['7D', '30D'].map(r => (
                <button key={r} onClick={() => setTrendRange(r)}
                  className={`px-2 py-0.5 text-[10px] rounded ${trendRange === r ? 'text-pink-400' : 'text-gray-500 hover:text-gray-300'}`}>{r}</button>
              ))}
            </div>
            {filteredTrend.length > 0
              ? <VerticalBarChart
                  bars={filteredTrend.map(b => ({
                    label: b.date?.slice(5) || '', value: b.score ?? 0,
                    displayValue: b.score ?? 0, color: '#ec4899', textClass: 'text-pink-400',
                  }))}
                  height={180}
                />
              : <div className="text-center text-gray-500 text-xs py-8">No trend data</div>}
          </div>
        )}
        {view === 'summary' && (
          <div className="h-full flex flex-col p-3">
            <div className="flex items-center justify-between mb-4 text-xs">
              <span className="text-gray-500">Overall Sentiment Score</span>
              <span className={`text-xl font-bold tabular-nums ${(agg.overall_score ?? 50) >= 60 ? 'text-green-400' : (agg.overall_score ?? 50) >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                {agg.overall_score ?? 50}
                <span className="text-xs text-gray-600 font-normal">/100</span>
              </span>
            </div>
            <VerticalBarChart bars={[
              { label: 'Positive', value: agg.positive ?? 0, color: '#22c55e', textClass: 'text-green-400' },
              { label: 'Neutral',  value: agg.neutral  ?? 0, color: '#6b7280', textClass: 'text-gray-400' },
              { label: 'Negative', value: agg.negative ?? 0, color: '#ef4444', textClass: 'text-red-400' },
            ]} height={180} />
          </div>
        )}
      </div>
    </>
  );
}
