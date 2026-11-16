/**
 * articles — 기사 목록. 한 건이 여러 줄이다: 발행처 · 시각 · (감성) / 제목 / 요약 / 관련 종목.
 * 한 줄 목록(list)으로는 모자란, 읽는 화면용 (종목의 뉴스 탭).
 *
 * options: (각 칸은 필드 이름 또는 (row, ctx) => 값)
 *   source     발행처
 *   time       시각 (이미 표기된 글자)
 *   title      제목
 *   summary    요약 (두 줄까지)
 *   href       제목을 누르면 열 주소 (새 탭)
 *   tags       관련 종목 배열 — 누르면 종목 화면 (최대 6개)
 *   sentiment  감성 값 — sentiments 대응표에 있을 때만 꼬리표를 단다
 *   sentiments 'positive:긍정,negative:부정,neutral:중립'   값 → 이름
 *   tones      'positive:up,negative:down'                  값 → 색 (없으면 회색)
 */
import { Link, hrefFor } from '../adapter';
import { read } from '../format';
import { Pill, parseMap } from './parts';

const MAX_TAGS = 6;

export default function ArticlesView({ rows, ctx, options = {} }) {
  const { source, time, title, summary, href, tags, sentiment, sentiments, tones } = options;
  const names = parseMap(sentiments);
  const colors = parseMap(tones);

  return (
    <div className="h-full overflow-auto">
      {rows.map((row, i) => {
        const url = read(row, href, ctx);
        const text = read(row, title, ctx);
        const body = read(row, summary, ctx);
        const tickers = (read(row, tags, ctx) || []).slice(0, MAX_TAGS);
        const mood = String(read(row, sentiment, ctx) ?? '').toLowerCase();
        const meta = [read(row, source, ctx), read(row, time, ctx)].filter(Boolean);
        return (
          <article
            key={row.id ?? i}
            className={`flex flex-col gap-1.5 px-4 py-3 hover:bg-[var(--mp-row-hover)] transition-colors ${i ? 'border-t border-[var(--mpc-grid)]' : ''}`}
          >
            <div className="flex items-center gap-2 text-xs text-[var(--mp-muted)]">
              <span className="min-w-0 truncate">{meta.join(' · ')}</span>
              {names[mood] && <Pill tone={colors[mood]} className="ml-auto flex-shrink-0">{names[mood]}</Pill>}
            </div>
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold leading-snug hover:underline">{text}</a>
            ) : (
              <span className="text-sm font-semibold leading-snug">{text}</span>
            )}
            {body && <p className="m-0 text-xs leading-relaxed text-[var(--mp-text-2)] line-clamp-2">{body}</p>}
            {tickers.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tickers.map((t) => (
                  <Link key={t} to={hrefFor(t)} className="px-1.5 py-0.5 rounded-md bg-[var(--mp-tag)] text-[var(--mp-text-2)] text-[11px] font-bold hover:text-[var(--mp-accent)]">{t}</Link>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
