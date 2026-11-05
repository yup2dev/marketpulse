/**
 * WidgetParamForm — 위젯 헤더의 파라미터 버튼 + 팝오버 폼.
 *
 * - 버튼: pin 된 파라미터의 현재 값을 칩으로 보여 준다 (예: `SHARPE · 21`). 나머지는 `+N`.
 *   pin 이 하나도 없으면 아이콘 + 개수.
 * - 입력칸은 공통 ParamField(ui/). 4개 이상이면 2열.
 * - 적용: 보이는 입력칸이 전부 select·date 면 고르는 즉시 적용, 아니면 Apply 버튼
 *   (규칙은 paramSpec.isInstantForm 한 곳 — 위젯마다 정하지 않는다).
 *
 * onApply 는 부모가 '다음 렌더에서' 조회하도록 예약만 한다 (값 반영 순서 문제 방지).
 */
import { SlidersHorizontal, ChevronDown } from 'lucide-react';
import { Popover, ParamField, usePopover } from '../ui';
import { isInstantForm, paramDisplayValue } from './paramSpec';

const TWO_COLUMN_FROM = 4;

export default function WidgetParamForm({
  spec,
  values,
  onChange,
  onApply,
  loading = false,
  title = 'Parameters',
  idPrefix = 'wp',
}) {
  const pop = usePopover();
  if (!spec?.length) return null;
  const twoCol = spec.length >= TWO_COLUMN_FROM;
  const instant = isInstantForm(spec);
  const pinned = spec.filter((p) => p.pin);
  const restCount = spec.length - pinned.length;

  const handleChange = (name, value) => {
    onChange(name, value);
    if (instant) onApply?.();
  };

  const summary = pinned.length ? (
    <>
      <span className="max-w-[180px] truncate text-gray-200">
        {pinned.map((p) => (p.chip ? p.chip(values[p.name]) : paramDisplayValue(p, values[p.name]))).join(' · ')}
      </span>
      {restCount > 0 && <span className="text-[10px] text-gray-500">+{restCount}</span>}
    </>
  ) : (
    <span className="text-[10px] text-gray-500">{spec.length}</span>
  );

  const trigger = (
    <button
      type="button"
      onClick={pop.toggle}
      className="flex items-center gap-1 h-6 px-2 bg-gray-800 hover:bg-gray-700 rounded text-[11px] text-gray-300 transition-colors"
      title={pinned.length ? `${title}: ${spec.map((p) => `${p.label || p.name} ${paramDisplayValue(p, values[p.name])}`).join(', ')}` : title}
      aria-expanded={pop.open}
    >
      <SlidersHorizontal size={11} className="text-cyan-500/70 flex-shrink-0" />
      {summary}
      <ChevronDown size={10} className="flex-shrink-0" />
    </button>
  );

  return (
    <Popover popover={pop} trigger={trigger} className={`p-3 ${twoCol ? 'w-[26rem]' : 'w-60'} max-w-[calc(100vw-2rem)]`}>
      <div className={`grid gap-x-3 gap-y-2.5 ${twoCol ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {spec.map((p) => (
          <ParamField key={p.name} p={p} value={values[p.name]} onChange={handleChange} idPrefix={idPrefix} />
        ))}
      </div>
      {onApply && !instant && (
        <button
          type="button"
          onClick={() => { onApply(); pop.close(); }}
          disabled={loading}
          className="w-full mt-3 h-7 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-[11px] font-semibold rounded transition-colors"
        >
          {loading ? 'Loading…' : 'Apply'}
        </button>
      )}
    </Popover>
  );
}
