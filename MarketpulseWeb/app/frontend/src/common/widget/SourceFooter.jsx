/**
 * SourceFooter — 위젯 하단 출처 한 줄 (`Source: FRED (St. Louis Fed) · Yahoo Finance — note`).
 * BaseWidget 이 그린다. BaseWidget 을 쓰지 않는 위젯(ChartWidget·PortfolioStats)도 이걸 쓴다.
 *
 * source: provider id | 라벨 | 그 배열. note: 원천·가공 설명 (예: 'from SEC 13F filings').
 * 출처를 아직 모르면(첫 응답 전) 'Loading…' 대신 줄 자체를 비워 둔다 — 틀린 출처보다 낫다.
 */
import { sourceLabels } from './sources';

export default function SourceFooter({ source, note }) {
  const labels = sourceLabels(source);
  if (!labels.length && !note) return null;
  return (
    <div className="px-3 py-1 border-t border-gray-800 flex-shrink-0">
      <p className="text-[10px] text-gray-600 truncate" title={[labels.join(' · '), note].filter(Boolean).join(' — ')}>
        Source: {labels.join(' · ')}{note ? `${labels.length ? ' — ' : ''}${note}` : ''}
      </p>
    </div>
  );
}
