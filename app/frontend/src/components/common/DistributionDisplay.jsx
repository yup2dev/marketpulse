/**
 * DistributionDisplay — 공통 분포 표시 컴포넌트
 *
 * 세 가지 뷰 전환 가능:
 *  - 'bars'  : 수평 바 차트 (기본)
 *  - 'donut' : 도넛 차트 (CommonChart 재사용)
 *  - 'table' : 테이블 (label · value · % · minibar)
 *
 * Props:
 *  items       [{label, value, color}]   — 분포 항목
 *  total       number                    — 직접 지정 (없으면 sum 자동 계산)
 *  view        'bars'|'donut'|'table'    — 초기 뷰 (default 'bars')
 *  showToggle  bool                      — 뷰 전환 버튼 표시 (default true)
 *  scoreMode   bool                      — value가 0-100 점수일 때 (% 컬럼 숨김, 바 너비 = value)
 *  showTotal   bool                      — 바 뷰 하단 합계 표시 (default true)
 *  compact     bool                      — 글씨/간격 축소
 */
import { useState } from 'react';
import { BarChart2, PieChart, Table2 } from 'lucide-react';
import CommonChart from './CommonChart';

const DONUT_COLORS = [
  '#22d3ee', '#a78bfa', '#4ade80', '#f59e0b',
  '#f87171', '#60a5fa', '#fb923c', '#e879f9',
];

export default function DistributionDisplay({
  items = [],
  total: totalProp,
  view: initialView = 'bars',
  showToggle = true,
  scoreMode = false,
  showTotal = true,
  compact = false,
}) {
  const [view, setView] = useState(initialView);

  const total = totalProp ?? items.reduce((s, i) => s + (i.value ?? 0), 0);

  const enriched = items.map((item, idx) => ({
    ...item,
    color: item.color ?? DONUT_COLORS[idx % DONUT_COLORS.length],
    pct: item.pct ?? (total > 0 ? Math.round((item.value ?? 0) / total * 1000) / 10 : 0),
    // barWidth: scoreMode → value (0-100), 일반 → pct
    barWidth: scoreMode ? Math.min(item.value ?? 0, 100) : (total > 0 ? (item.value ?? 0) / total * 100 : 0),
  }));

  // donut용 CommonChart 포맷
  const donutData = enriched.map(i => ({ name: i.label, value: i.value ?? 0 }));

  const textSm  = compact ? 'text-[10px]' : 'text-[11px]';
  const textXs  = 'text-[10px]';
  const gap     = compact ? 'space-y-1' : 'space-y-1.5';
  const barH    = compact ? 'h-1' : 'h-1.5';

  const VIEWS = [
    { id: 'bars',  Icon: BarChart2, title: '바 차트' },
    { id: 'donut', Icon: PieChart,  title: '도넛'   },
    { id: 'table', Icon: Table2,    title: '테이블' },
  ];

  return (
    <div className="space-y-2">
      {/* ── 뷰 토글 ─────────────────────────────────────── */}
      {showToggle && (
        <div className="flex gap-1 justify-end">
          {VIEWS.map(({ id, Icon, title }) => (
            <button
              key={id}
              title={title}
              onClick={() => setView(id)}
              className={`p-1 rounded transition-colors ${
                view === id ? 'text-cyan-400 bg-gray-800' : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              <Icon size={compact ? 11 : 12} />
            </button>
          ))}
        </div>
      )}

      {/* ── 바 차트 뷰 ──────────────────────────────────── */}
      {view === 'bars' && (
        <div className={gap}>
          {enriched.map((item, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-0.5">
                <span className={`${textSm} text-gray-400`}>{item.label}</span>
                <span className={`${textXs} font-medium`} style={{ color: item.color }}>
                  {scoreMode
                    ? `${item.value ?? 0}`
                    : `${item.value ?? 0}${total > 0 ? ` (${item.pct}%)` : ''}`}
                </span>
              </div>
              <div className={`w-full bg-gray-800 rounded-full ${barH} overflow-hidden`}>
                <div
                  className={`${barH} rounded-full transition-all duration-500`}
                  style={{ width: `${item.barWidth}%`, backgroundColor: item.color }}
                />
              </div>
            </div>
          ))}
          {!scoreMode && showTotal && total > 0 && (
            <div className={`${textXs} text-gray-700 text-right pt-0.5`}>Total: {total}</div>
          )}
        </div>
      )}

      {/* ── 도넛 뷰 ─────────────────────────────────────── */}
      {view === 'donut' && (
        <div className={compact ? 'h-36' : 'h-44'}>
          {donutData.some(d => d.value > 0) ? (
            <CommonChart
              data={donutData}
              series={enriched.map((item, i) => ({
                key: 'value',
                name: item.label,
                color: item.color,
              }))}
              xKey="name"
              type="donut"
              fillContainer
              showTypeSelector={false}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-600 text-xs">
              데이터 없음
            </div>
          )}
        </div>
      )}

      {/* ── 테이블 뷰 ────────────────────────────────────── */}
      {view === 'table' && (
        <table className={`w-full ${textSm} border-collapse`}>
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-1.5 pr-2 text-gray-500 font-medium">항목</th>
              <th className="text-right py-1.5 px-2 text-gray-500 font-medium">값</th>
              {!scoreMode && <th className="text-right py-1.5 px-2 text-gray-500 font-medium">비율</th>}
              <th className="text-left py-1.5 pl-2 text-gray-500 font-medium w-20">분포</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map((item, i) => (
              <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                <td className="py-1.5 pr-2 font-medium" style={{ color: item.color }}>
                  {item.label}
                </td>
                <td className="py-1.5 px-2 text-right text-white">
                  {scoreMode ? `${item.value ?? 0}/100` : (item.value ?? 0)}
                </td>
                {!scoreMode && (
                  <td className="py-1.5 px-2 text-right text-gray-400">
                    {item.pct}%
                  </td>
                )}
                <td className="py-1.5 pl-2">
                  <div className="w-full bg-gray-800 rounded-full h-1 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${item.barWidth}%`, backgroundColor: item.color }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {!scoreMode && total > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4} className={`${textXs} text-right text-gray-700 pt-1`}>
                  Total: {total}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      )}
    </div>
  );
}
