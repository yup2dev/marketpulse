/**
 * list — 한 줄 목록 (시각 · 제목 · 꼬리표 / 값). 속보·일정처럼 '언제 · 무엇'인 데이터.
 *
 * options: (각 칸은 필드 이름 또는 (row, ctx) => 값)
 *   time       앞의 회색 시각
 *   title      제목 (넘치면 …)
 *   sub        제목 뒤 흐린 글자 (예: 국가)
 *   href       제목을 누르면 열 주소 (새 탭)
 *   tag        오른쪽 꼬리표 (예: 티커)      tagSymbol: true → 누르면 종목 화면
 *   value      오른쪽 값                     valueMuted: (row) => 흐리게 그릴지
 *   dot        (row) => true 면 제목 앞에 강조 점
 *   rowHeight  44
 */
import { Link, hrefFor } from '../adapter';
import { read } from '../format';

export default function ListView({ rows, ctx, options = {} }) {
  const { time, title, sub, href, tag, tagSymbol, value, valueMuted, dot, rowHeight = 44 } = options;

  return (
    <div className="h-full overflow-auto pb-1">
      {rows.map((row, i) => {
        const t = read(row, title, ctx);
        const s = read(row, sub, ctx);
        const url = read(row, href, ctx);
        const tg = read(row, tag, ctx);
        const v = read(row, value, ctx);
        return (
          <div
            key={row.id ?? i}
            className="flex items-center gap-3 px-4 hover:bg-[var(--mp-row-hover)] transition-colors"
            style={{ height: rowHeight }}
            title={[t, s].filter(Boolean).join(' · ')}
          >
            {time && <span className="w-9 flex-shrink-0 text-xs text-[var(--mp-muted)]">{read(row, time, ctx) || '—'}</span>}
            {dot?.(row) && <span className="w-1.5 h-1.5 rounded-full bg-[var(--mp-accent)] flex-shrink-0 -mr-1" aria-label="중요" />}
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 truncate hover:underline">{t}</a>
            ) : (
              <span className="flex-1 min-w-0 truncate">
                {t}{s && <span className="text-[var(--mp-faint)]"> · {s}</span>}
              </span>
            )}
            {tg && (tagSymbol ? (
              <Link to={hrefFor(tg)} className="px-1.5 py-0.5 rounded-md bg-[var(--mp-tag)] text-[var(--mp-text-2)] text-[11px] font-bold flex-shrink-0 hover:text-[var(--mp-accent)]">{tg}</Link>
            ) : (
              <span className="px-1.5 py-0.5 rounded-md bg-[var(--mp-tag)] text-[var(--mp-tag-text)] text-[11px] flex-shrink-0">{tg}</span>
            ))}
            {value && (
              <span className={`text-xs flex-shrink-0 ${valueMuted?.(row) ? 'text-[var(--mp-faint)]' : 'font-semibold'}`}>{v ?? '—'}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
