/**
 * TimelineList — Chronological list with timestamps and badges.
 *
 * Reusable across: News feed, Alert history, Activity logs.
 *
 * Props:
 *   items        — array of objects
 *   renderItem   — (item, index) => { title, subtitle, meta, badge, href, onClick }
 *   emptyMessage — string
 *   compact      — boolean
 */

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = (now - date) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const BADGE_STYLES = {
  positive: 'bg-green-500/15 text-green-400 border-green-500/30',
  negative: 'bg-red-500/15 text-red-400 border-red-500/30',
  neutral:  'bg-gray-500/15 text-gray-400 border-gray-500/30',
  info:     'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  warning:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

export function Badge({ type = 'neutral', children }) {
  const style = BADGE_STYLES[type] || BADGE_STYLES.neutral;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${style}`}>
      {children}
    </span>
  );
}

export default function TimelineList({
  items = [],
  renderItem,
  emptyMessage = 'No items',
  compact = false,
}) {
  if (!items.length) {
    return (
      <div className="flex items-center justify-center h-full min-h-[80px] text-gray-500 text-xs">
        {emptyMessage}
      </div>
    );
  }

  const py = compact ? 'py-2' : 'py-3';

  return (
    <div className="w-full divide-y divide-gray-800/50">
      {items.map((item, i) => {
        const { title, subtitle, meta, badge, href, onClick, icon, timestamp } = renderItem(item, i);
        const Wrapper = href ? 'a' : 'div';
        const wrapperProps = href
          ? { href, target: '_blank', rel: 'noopener noreferrer' }
          : onClick ? { onClick, role: 'button', tabIndex: 0 } : {};

        return (
          <Wrapper
            key={item.id || item._key || i}
            className={`flex items-start gap-3 px-3 ${py} hover:bg-gray-800/30 transition-colors cursor-pointer group`}
            {...wrapperProps}
          >
            {icon && (
              <div className="flex-shrink-0 mt-0.5 text-gray-500 group-hover:text-gray-400 transition-colors">
                {icon}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-gray-200 group-hover:text-white transition-colors line-clamp-2">
                  {title}
                </span>
                {timestamp && (
                  <span className="text-[10px] text-gray-600 whitespace-nowrap flex-shrink-0">
                    {formatTimeAgo(timestamp)}
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{subtitle}</p>
              )}
              {(badge || meta) && (
                <div className="flex items-center gap-2 mt-1.5">
                  {badge}
                  {meta && <span className="text-[10px] text-gray-600">{meta}</span>}
                </div>
              )}
            </div>
          </Wrapper>
        );
      })}
    </div>
  );
}

export { formatTimeAgo };
