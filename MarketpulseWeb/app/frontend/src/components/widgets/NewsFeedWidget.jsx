/**
 * NewsFeedWidget — News article timeline with sentiment badges.
 *
 * Uses TimelineList for rendering. Supports optional symbol filtering.
 * Reusable on Dashboard (market-wide) and Stock page (ticker-specific).
 */
import { useState, useEffect, useCallback } from 'react';
import { Newspaper, ExternalLink } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import TimelineList, { Badge } from './common/TimelineList';
import { newsAPI } from '../../config/api';

function sentimentBadge(sentiment) {
  if (!sentiment) return null;
  const type = sentiment === 'positive' ? 'positive'
    : sentiment === 'negative' ? 'negative' : 'neutral';
  return <Badge type={type}>{sentiment}</Badge>;
}

function tickerBadges(tickers) {
  if (!tickers?.length) return null;
  return (
    <div className="flex gap-1 flex-wrap">
      {tickers.slice(0, 4).map(t => (
        <span key={t} className="px-1 py-0.5 bg-gray-800 text-[9px] text-gray-400 rounded font-mono">
          {t}
        </span>
      ))}
      {tickers.length > 4 && (
        <span className="text-[9px] text-gray-600">+{tickers.length - 4}</span>
      )}
    </div>
  );
}

export default function NewsFeedWidget({ symbol: symbolProp, onRemove }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [symbol, setSymbol] = useState(symbolProp || '');
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    if (symbolProp) setSymbol(symbolProp);
  }, [symbolProp]);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await newsAPI.get(symbol || null, limit);
      setArticles(res.articles || []);
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [symbol, limit]);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  return (
    <BaseWidget
      title="News Feed"
      icon={Newspaper}
      loading={loading}
      onRemove={onRemove}
      onRefresh={fetchNews}
      symbol={symbol || undefined}
      onSymbolChange={setSymbol}
      showViewToggle={false}
      showPeriodSelector={false}
    >
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-1 overflow-auto min-h-0">
          <TimelineList
            items={articles}
            emptyMessage={symbol ? `No news for ${symbol}` : 'No news available'}
            renderItem={(article) => ({
              title: article.title,
              subtitle: article.description,
              timestamp: article.published_utc,
              href: article.article_url,
              badge: (
                <div className="flex items-center gap-2">
                  {sentimentBadge(article.sentiment)}
                  {tickerBadges(article.tickers)}
                </div>
              ),
              meta: [article.publisher, article.author].filter(Boolean).join(' · '),
              icon: <Newspaper size={12} />,
            })}
          />
        </div>

        {articles.length > 0 && articles.length >= limit && (
          <div className="px-3 py-1.5 border-t border-gray-800 flex-shrink-0 text-center">
            <button
              onClick={() => setLimit(prev => prev + 20)}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
