/**
 * StockSentimentWidget - News sentiment: News / Trend / Summary tabs
 */
import { useState, useEffect, useCallback } from 'react';
import { Newspaper } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import { API_BASE } from './constants';

const SENTIMENT_TEXT = {
  positive: 'text-green-400',
  negative: 'text-red-400',
  neutral:  'text-gray-400',
};

function SentimentBadge({ sentiment }) {
  return (
    <span className={`text-[9px] font-medium capitalize flex-shrink-0 ${SENTIMENT_TEXT[sentiment] || SENTIMENT_TEXT.neutral}`}>
      {sentiment}
    </span>
  );
}


export default function StockSentimentWidget({ symbol, onRemove }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('news');
  const [trendRange, setTrendRange] = useState('30D');

  const load = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stock/sentiment/${symbol}`);
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error('StockSentimentWidget error:', e);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { load(); }, [load]);

  const news = data?.news || [];
  const agg  = data?.aggregate || {};
  const trend = data?.trend || [];

  const filteredTrend = trendRange === '7D'
    ? trend.slice(-7)
    : trend.slice(-30);

  const tabs = [
    { id: 'news', label: 'News' },
    { id: 'trend', label: 'Trend' },
    { id: 'summary', label: 'Summary' },
  ];

  return (
    <BaseWidget
      title="News Sentiment"
      icon={Newspaper}
      iconColor="text-pink-400"
      loading={loading}
      onRefresh={load}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
      source="Polygon.io"
    >
      <div className="flex border-b border-gray-800 px-3 pt-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-[11px] font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-pink-400 text-pink-400' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {tab === 'news' && (
          <div className="divide-y divide-gray-800">
            {news.length > 0 ? news.slice(0, 20).map((item, i) => (
              <div key={i} className="px-3 py-2 hover:bg-gray-800/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-gray-200 hover:text-white line-clamp-2 flex-1"
                  >
                    {item.title}
                  </a>
                  <SentimentBadge sentiment={item.sentiment} />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-gray-600">{item.source}</span>
                  <span className="text-[10px] text-gray-700">·</span>
                  <span className="text-[10px] text-gray-600">
                    {item.published_at ? new Date(item.published_at).toLocaleDateString() : ''}
                  </span>
                </div>
              </div>
            )) : (
              <div className="text-center text-gray-500 text-xs py-8">No news data available</div>
            )}
          </div>
        )}

        {tab === 'trend' && (
          <div className="h-full flex flex-col p-3">
            <div className="flex gap-2 mb-2">
              {['7D', '30D'].map(r => (
                <button
                  key={r}
                  onClick={() => setTrendRange(r)}
                  className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                    trendRange === r ? 'text-pink-400' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            {filteredTrend.length > 0 ? (() => {
              const bars = filteredTrend;
              const maxVal = Math.max(...bars.map(b => b.score ?? 0), 1);
              return (
                <>
                  <div className="flex justify-around mb-1">
                    {bars.map((b, i) => (
                      <span key={i} className="text-[8px] font-medium tabular-nums flex-1 text-center text-pink-400">
                        {b.score ?? 0}
                      </span>
                    ))}
                  </div>
                  <div className="flex-1 flex items-end justify-around gap-0.5 min-h-0">
                    {bars.map((b, i) => {
                      const pct = (b.score ?? 0) / maxVal * 100;
                      return (
                        <div key={i} className="flex-1 flex justify-center items-end h-full">
                          <div
                            className="w-full rounded-t transition-all duration-700"
                            style={{ height: `${pct}%`, backgroundColor: '#ec4899', minHeight: '2px', maxWidth: '16px' }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-around border-t border-gray-800 pt-1.5 mt-1">
                    {bars.map((b, i) => (
                      <span key={i} className="text-[7px] text-gray-600 text-center flex-1 leading-tight truncate">
                        {b.date ? b.date.slice(5) : ''}
                      </span>
                    ))}
                  </div>
                </>
              );
            })() : <div className="text-center text-gray-500 text-xs py-8">No trend data</div>}
          </div>
        )}

        {tab === 'summary' && (
          <div className="h-full flex flex-col p-3">
            <div className="flex items-center justify-between mb-4 text-xs">
              <span className="text-gray-500">Overall Sentiment Score</span>
              <span className={`text-xl font-bold tabular-nums ${
                (agg.overall_score ?? 50) >= 60 ? 'text-green-400'
                : (agg.overall_score ?? 50) >= 40 ? 'text-yellow-400'
                : 'text-red-400'
              }`}>
                {agg.overall_score ?? 50}<span className="text-xs text-gray-600 font-normal">/100</span>
              </span>
            </div>
            {(() => {
              const bars = [
                { label: 'Positive', value: agg.positive ?? 0, color: '#22c55e', textClass: 'text-green-400' },
                { label: 'Neutral',  value: agg.neutral  ?? 0, color: '#6b7280', textClass: 'text-gray-400' },
                { label: 'Negative', value: agg.negative ?? 0, color: '#ef4444', textClass: 'text-red-400' },
              ];
              const maxVal = Math.max(...bars.map(b => b.value), 1);
              return (
                <>
                  <div className="flex justify-around mb-1">
                    {bars.map(b => (
                      <span key={b.label} className={`text-[9px] font-medium tabular-nums flex-1 text-center ${b.textClass}`}>{b.value}</span>
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
                </>
              );
            })()}
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
