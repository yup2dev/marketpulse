/**
 * BacktestPeriod — 백테스트 머리줄의 기간: 전체 · 5Y · 3Y · 1Y · 직접(시작 월 ~ 끝 월).
 *
 * 화면 변수 bt_start · bt_end (월말 YYYY-MM-DD, 비우면 패널 처음 · 끝)를 바꾼다 — 결과 위젯(bt-run-* · bt-compare)의
 * endpoint 가 이미 이 변수를 쓰므로 서버가 그 기간만으로 다시 계산한다 (성과 요약 · 지표도 그 기간 기준).
 * 위젯 안의 '기간' 선택(months)은 계산된 결과를 잘라 보는 확대일 뿐이라 이것과 다르다.
 * 고를 수 있는 달 = 패널에서 다음 달 수익률이 있는 달 (/api/strategies metadata.panel 의 start ~ end).
 */
import { useMemo } from 'react';
import { HeaderSeg } from '../../../common/widget/WidgetCard';
import { setShared, useShared } from '../../engine/shared';
import { monthEnds } from '../quant/quantShared';

const PRESETS = [{ value: 'all', label: '전체', years: 0 }, { value: '5y', label: '5Y', years: 5 }, { value: '3y', label: '3Y', years: 3 }, { value: '1y', label: '1Y', years: 1 }];
const SELECT = 'h-7 px-1.5 rounded border border-gray-700 bg-transparent text-xs text-gray-200 outline-none hover:border-gray-500 focus:border-cyan-500 tabular-nums [&_option]:bg-gray-900';
const ym = (d) => String(d).slice(0, 7).replace('-', '.');

const set = (start, end) => { setShared('bt_start', start); setShared('bt_end', end); };

export default function BacktestPeriod({ panel }) {
  const shared = useShared();
  const months = useMemo(() => monthEnds(panel?.start, panel?.end), [panel?.start, panel?.end]);   // 최근 달부터
  const start = shared.bt_start || '';
  const end = shared.bt_end || '';

  // 프리셋 N년 = 마지막 달부터 N×12 달 (패널이 그보다 짧으면 고를 수 없다)
  const presetStart = (years) => (years ? months[years * 12 - 1] : '');
  const preset = PRESETS.find((p) => !end && start === presetStart(p.years) && (p.years === 0 || start));
  const mode = preset ? preset.value : 'custom';

  if (months.length < 2) return null;
  const options = [
    ...PRESETS.filter((p) => !p.years || presetStart(p.years)).map(({ value, label }) => ({ value, label })),
    { value: 'custom', label: '직접' },
  ];
  const pick = (v) => {
    if (v === 'custom') {
      // 지금 보이는 기간에서 시작 — 처음 고르면 최근 3년
      set(start || months[Math.min(35, months.length - 1)], end || months[0]);
      return;
    }
    set(presetStart(PRESETS.find((p) => p.value === v).years), '');
  };
  const asc = [...months].reverse();
  const s = start || asc[0];
  const e = end || months[0];

  return (
    <span className="flex items-center gap-1.5" title="이 기간만으로 다시 계산해요 — 성과 지표도 이 기간 기준">
      <span className="hidden xl:inline text-[11px] text-gray-500">기간</span>
      <HeaderSeg value={mode} options={options} onChange={pick} ariaLabel="백테스트 기간" />
      {mode === 'custom' && (
        <>
          <select aria-label="시작 월" value={s} onChange={(ev) => set(ev.target.value, e < ev.target.value ? ev.target.value : e)} className={SELECT}>
            {asc.map((d) => <option key={d} value={d}>{ym(d)}</option>)}
          </select>
          <span className="text-gray-500 text-xs">~</span>
          <select aria-label="끝 월" value={e} onChange={(ev) => set(s, ev.target.value)} className={SELECT}>
            {asc.filter((d) => d >= s).map((d) => <option key={d} value={d}>{ym(d)}</option>)}
          </select>
        </>
      )}
    </span>
  );
}
