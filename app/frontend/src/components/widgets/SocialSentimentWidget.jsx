/**
 * SocialSentimentWidget - Reddit + StockTwits social sentiment
 */
import { useState, useEffect, useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import CommonTable from '../common/CommonTable';
import { API_BASE } from './constants';

const SENTIMENT_TEXT = {
  bullish:  'text-green-400',
  bearish:  'text-red-400',
  positive: 'text-green-400',
  negative: 'text-red-400',
  neutral:  'text-gray-400',
};

const REDDIT_COLS = [
  {
    key: 'subreddit',
    header: 'Subreddit',
    sortable: true,
    renderFn: (value, row) => `r/${row.subreddit}`,
  },
  {
    key: 'title',
    header: 'Title',
    sortable: false,
    renderFn: (value, row) => (
      <a href={row.url} target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 line-clamp-1">{row.title}</a>
    ),
  },
  { key: 'score', header: 'Score', sortable: true, align: 'right' },
  { key: 'num_comments', header: 'Comments', sortable: true, align: 'right' },
  {
    key: 'sentiment',
    header: 'Sentiment',
    align: 'center',
    renderFn: (value, row) => (
      <span className={`text-[9px] font-medium capitalize ${SENTIMENT_TEXT[row.sentiment] || SENTIMENT_TEXT.neutral}`}>
        {row.sentiment}
      </span>
    ),
  },
];

const ST_COLS = [
  { key: 'user', header: 'User', sortable: true },
  {
    key: 'body',
    header: 'Message',
    sortable: false,
    renderFn: (value, row) => <span className="line-clamp-2 text-[10px]">{row.body}</span>,
  },
  {
    key: 'sentiment',
    header: 'Sentiment',
    align: 'center',
    renderFn: (value, row) => (
      <span className={`text-[9px] font-medium capitalize ${SENTIMENT_TEXT[row.sentiment] || SENTIMENT_TEXT.neutral}`}>
        {row.sentiment}
      </span>
    ),
  },
  {
    key: 'created_at',
    header: 'Time',
    renderFn: (value, row) => row.created_at ? new Date(row.created_at).toLocaleDateString() : '',
  },
];

export default function SocialSentimentWidget({ symbol, onRemove }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('overview');

  const load = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/reddit/${symbol}`);
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error('SocialSentimentWidget error:', e);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { load(); }, [load]);

  const reddit = data?.reddit_posts || [];
  const st     = data?.stocktwits_messages || [];
  const agg    = data?.aggregate || {};
  const hasReddit = data?.has_reddit;

  return (
    <BaseWidget
      title="Social Sentiment"
      icon={MessageSquare}
      iconColor="text-indigo-400"
      loading={loading}
      onRefresh={load}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
      source="Reddit · StockTwits"
    >
      <div className="flex border-b border-gray-800 px-3 pt-1">
        {[{ id: 'overview', label: 'Overview' }, { id: 'reddit', label: 'Reddit' }, { id: 'stocktwits', label: 'StockTwits' }].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-[11px] font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-indigo-400 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-3">
        {tab === 'overview' && (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="text-gray-500">Total Messages</span>
              <span className="font-bold tabular-nums text-white">{agg.message_volume ?? 0}</span>
            </div>
            {(() => {
              const bars = [
                { label: 'Bullish',  value: agg.bullish_pct  ?? 0, color: '#22c55e', textClass: 'text-green-400' },
                { label: 'Neutral',  value: agg.neutral_pct  ?? 0, color: '#6b7280', textClass: 'text-gray-400' },
                { label: 'Bearish',  value: agg.bearish_pct  ?? 0, color: '#ef4444', textClass: 'text-red-400' },
              ];
              const maxVal = Math.max(...bars.map(b => b.value), 1);
              return (
                <div className="flex flex-col flex-1 min-h-0">
                  <div className="flex justify-around mb-1">
                    {bars.map(b => (
                      <span key={b.label} className={`text-[9px] font-medium tabular-nums flex-1 text-center ${b.textClass}`}>{b.value.toFixed(1)}%</span>
                    ))}
                  </div>
                  <div className="flex-1 flex items-end justify-around gap-3 min-h-0">
                    {bars.map(b => (
                      <div key={b.label} className="flex-1 flex justify-center items-end h-full">
                        <div
                          className="w-full max-w-[48px] rounded-t transition-all duration-700"
                          style={{ height: `${(b.value / maxVal) * 100}%`, backgroundColor: b.color, minHeight: b.value > 0 ? '3px' : 0 }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-around border-t border-gray-800 pt-1.5 mt-1">
                    {bars.map(b => (
                      <span key={b.label} className="text-[9px] text-gray-500 text-center flex-1 leading-tight">{b.label}</span>
                    ))}
                  </div>
                </div>
              );
            })()}
            {!hasReddit && (
              <p className="text-center text-[10px] text-yellow-600 mt-2">Reddit API key required for full data</p>
            )}
          </div>
        )}

        {tab === 'reddit' && (
          !hasReddit ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-yellow-400 text-sm font-medium">Reddit API Key Required</p>
              <p className="text-gray-500 text-xs">Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in your .env file</p>
            </div>
          ) : reddit.length > 0 ? (
            <CommonTable
              columns={REDDIT_COLS}
              data={reddit.map((r, i) => ({ ...r, _key: i }))}
              compact={true}
              searchable={false}
              exportable={false}
              pageSize={20}
            />
          ) : (
            <div className="text-center text-gray-500 text-xs py-8">No Reddit posts found</div>
          )
        )}

        {tab === 'stocktwits' && (
          st.length > 0
            ? <CommonTable
                columns={ST_COLS}
                data={st.map((r, i) => ({ ...r, _key: i }))}
                compact={true}
                searchable={false}
                exportable={false}
                pageSize={20}
              />
            : <div className="text-center text-gray-500 text-xs py-8">No StockTwits messages found</div>
        )}
      </div>
    </BaseWidget>
  );
}
