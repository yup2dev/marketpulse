/**
 * WidgetParamForm — 위젯 헤더의 파라미터 버튼 + 팝오버 폼.
 *
 * 입력칸은 공통 ParamField(ui/)로 그린다 — select 도 테마를 따르는 공통 Select 다.
 * 파라미터가 4개 이상이면 2열로 배치해 팝오버가 화면 밖으로 길어지지 않게 한다.
 *
 * Param spec (each entry):
 *   { name, label, kind: 'select'|'number'|'date'|'text', default, options?, step?, min?, max?, hint?, upper? }
 *   select 의 optionsFrom: { endpoint, value, label } 은 UniversalWidget 이 API 결과로 options 를 채운다.
 */
import { SlidersHorizontal, ChevronDown } from 'lucide-react';
import { Popover, ParamField, usePopover } from '../ui';

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

  const trigger = (
    <button
      type="button"
      onClick={pop.toggle}
      className="flex items-center gap-1 h-6 px-2 bg-gray-800 hover:bg-gray-700 rounded text-[11px] text-gray-300 transition-colors"
      title={title}
      aria-expanded={pop.open}
    >
      <SlidersHorizontal size={11} className="text-cyan-500/70" />
      <span className="text-[10px] text-gray-500">{spec.length}</span>
      <ChevronDown size={10} />
    </button>
  );

  return (
    <Popover popover={pop} trigger={trigger} className={`p-3 ${twoCol ? 'w-[26rem]' : 'w-60'} max-w-[calc(100vw-2rem)]`}>
      <div className={`grid gap-x-3 gap-y-2.5 ${twoCol ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {spec.map((p) => (
          <ParamField key={p.name} p={p} value={values[p.name]} onChange={onChange} idPrefix={idPrefix} />
        ))}
      </div>
      {onApply && (
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
