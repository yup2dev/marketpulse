/**
 * WidgetCard — 리디자인 시안의 위젯 껍데기 (40px 헤더 + 본문).
 *
 *   [⠿] [탭][탭] ……………… 출처  [actions]  ✕
 *
 * - 제목 자리에 탭이 온다 (탭이 하나면 그게 제목). 탭을 고르는 건 위젯 몫이다.
 * - actions: 정렬·봉 간격 같은 헤더 오른쪽 컨트롤 → <HeaderSeg> 를 넘긴다.
 * - source 는 필수 — 헤더 오른쪽에 작게 붙는다 (tests/test_widget_sources.py 가 확인).
 * - bare: 머리줄 없이 한 줄 —  [⠿] 본문 ……… 출처 ✕  (요약 줄처럼 본문이 한 줄인 패널)
 * - state: 데이터를 못 보여 줄 때 { kind, … } 를 넘기면 본문 대신 WidgetState 를 그린다.
 * - 색은 index.css 의 --mp-* 토큰만 쓴다 → 라이트 테마가 그대로 따라온다.
 *
 * 필터·내보내기·provider 선택이 필요한 위젯은 BaseWidget 을 쓴다.
 */
import { X } from 'lucide-react';
import { WidgetState, sourceLabels } from '../ui';

/** 헤더 오른쪽의 한 줄짜리 선택 (정렬 기준·봉 간격) */
export function HeaderSeg({ value, options, onChange, ariaLabel }) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex gap-0.5 flex-shrink-0">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`h-7 px-2.5 rounded-md text-xs transition-colors ${
              on
                ? 'bg-[var(--mp-chip-on)] text-[var(--mp-text)] font-bold'
                : 'text-[var(--mp-muted)] hover:text-[var(--mp-text)]'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function WidgetCard({
  tabs,                 // [{ id, label }] — 하나면 제목
  activeTab,
  onTabChange,
  title,                // tabs 대신 제목 하나만 줄 때
  source,               // provider id | 라벨 | 배열 (ui/sources.js)
  sourceNote,           // 출처 옆 설명 (예: '시가총액 기준')
  live = false,         // 실시간 표시 점
  actions,
  onRemove,
  loading = false,
  state,                // { kind, message, provider, onRetry }
  onRetry,
  bare = false,
  sourceInActions = false,   // 출처를 actions 의 데이터 소스 선택이 보여 준다 — 글자로 다시 적지 않는다
  children,
}) {
  const items = tabs?.length ? tabs : [{ id: '_', label: title }];
  const current = activeTab ?? items[0].id;
  const caption = [sourceInActions ? null : sourceLabels(source).join(' · '), sourceNote].filter(Boolean).join(' · ');

  let body;
  if (loading) body = <WidgetState kind="loading" />;
  else if (state) body = <WidgetState {...state} onRetry={state.onRetry ?? onRetry} compact />;
  else body = children;

  const captionEl = (caption || live) && (
    <span
      className={`flex items-center gap-1.5 min-w-0 max-w-[320px] text-[11px] ${live ? 'text-[var(--mp-live)]' : 'text-[var(--mp-faint)]'}`}
      title={caption ? `Source: ${caption}` : undefined}
    >
      {live && <span className="w-1.5 h-1.5 rounded-full bg-[var(--mp-live)] flex-shrink-0" aria-hidden="true" />}
      <span className="truncate">{live ? ['실시간', caption].filter(Boolean).join(' · ') : caption}</span>
    </span>
  );
  const closeEl = onRemove && (
    <button
      type="button"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onRemove(); }}
      aria-label="위젯 닫기"
      className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-[var(--mp-muted)] hover:bg-[var(--mp-raised)] hover:text-[var(--mp-text)] transition-colors"
    >
      <X size={14} />
    </button>
  );

  if (bare) {
    return (
      <section
        aria-label={items[0].label}
        className="h-full flex items-center gap-1 px-2 rounded-lg bg-[var(--mp-panel)] text-[var(--mp-text)] text-[13px] tabular-nums"
      >
        <span className="drag-handle-area cursor-move w-5 h-full flex items-center justify-center text-[var(--mp-grip)] select-none flex-shrink-0" aria-hidden="true">⠿</span>
        <div className="flex-1 min-w-0 h-full overflow-hidden relative">{body}</div>
        {captionEl}
        <div className="flex items-center gap-1.5 flex-shrink-0" onMouseDown={(e) => e.stopPropagation()}>{actions}</div>
        {closeEl}
      </section>
    );
  }

  return (
    <section
      aria-label={items.find((t) => t.id === current)?.label}
      className="h-full flex flex-col rounded-lg bg-[var(--mp-panel)] text-[var(--mp-text)] text-[13px] tabular-nums"
    >
      <div className="flex items-center gap-1 h-10 px-2 flex-shrink-0">
        {/* 왼쪽: 끌기 손잡이 + 탭 */}
        <div className="drag-handle-area cursor-move flex items-center gap-1 flex-shrink-0 h-full">
          <span className="w-5 text-center text-[var(--mp-grip)] select-none flex-shrink-0" aria-hidden="true">⠿</span>
          <div role={items.length > 1 ? 'tablist' : undefined} className="flex items-center gap-0.5">
            {items.map((t) => {
              const on = t.id === current;
              const cls = `h-7 px-2.5 rounded-md flex items-center text-xs whitespace-nowrap ${
                on ? 'bg-[var(--mp-raised)] text-[var(--mp-text)] font-bold' : 'text-[var(--mp-muted)] hover:text-[var(--mp-text)]'
              }`;
              if (items.length === 1) return <span key={t.id} className={cls}>{t.label}</span>;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => onTabChange?.(t.id)}
                  className={`${cls} transition-colors`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 가운데: 남는 자리 — 잡고 위젯을 옮긴다. 출처는 여기 오른쪽 끝에 붙고, 자리가 없으면 줄어든다 */}
        <div className="drag-handle-area cursor-move flex-1 min-w-0 h-full flex items-center justify-end">
          {captionEl}
        </div>

        {/* 오른쪽: 컨트롤 · 닫기 */}
        <div className="flex items-center gap-1.5 flex-shrink-0" onMouseDown={(e) => e.stopPropagation()}>
          {actions}
          {closeEl}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden relative">
        {body}
      </div>
    </section>
  );
}
