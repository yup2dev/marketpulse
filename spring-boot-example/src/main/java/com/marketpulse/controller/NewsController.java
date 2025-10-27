package com.marketpulse.controller;

import com.marketpulse.entity.NewsArticle;
import com.marketpulse.repository.NewsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/news")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class NewsController {

    private final NewsRepository newsRepository;

    /**
     * 최신 뉴스 조회
     * GET /api/news?ticker=AAPL&sentiment=positive&hours=24&limit=50
     */
    @GetMapping
    public ResponseEntity<List<NewsArticle>> getNews(
            @RequestParam(required = false) String ticker,
            @RequestParam(required = false) String sentiment,
            @RequestParam(defaultValue = "24") int hours,
            @RequestParam(defaultValue = "50") int limit
    ) {
        LocalDateTime since = LocalDateTime.now().minusHours(hours);
        Pageable pageable = PageRequest.of(0, limit);

        List<NewsArticle> articles;

        if (ticker != null) {
            // 특정 티커 뉴스
            articles = newsRepository.findByTickerSymbol(
                    ticker.toUpperCase(),
                    since,
                    pageable
            );
        } else if (sentiment != null) {
            // 감성별 뉴스
            articles = newsRepository.findBySentimentLabelAndCrawledAtAfterOrderByCrawledAtDesc(
                    sentiment.toLowerCase(),
                    since,
                    pageable
            );
        } else {
            // 전체 최신 뉴스
            articles = newsRepository.findByCrawledAtAfterOrderByCrawledAtDesc(
                    since,
                    pageable
            );
        }

        return ResponseEntity.ok(articles);
    }

    /**
     * 특정 티커 뉴스
     * GET /api/news/ticker/AAPL
     */
    @GetMapping("/ticker/{symbol}")
    public ResponseEntity<List<NewsArticle>> getNewsByTicker(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "24") int hours,
            @RequestParam(defaultValue = "50") int limit
    ) {
        LocalDateTime since = LocalDateTime.now().minusHours(hours);
        Pageable pageable = PageRequest.of(0, limit);

        List<NewsArticle> articles = newsRepository.findByTickerSymbol(
                symbol.toUpperCase(),
                since,
                pageable
        );

        return ResponseEntity.ok(articles);
    }

    /**
     * 뉴스 통계
     * GET /api/news/stats
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        Map<String, Object> stats = new HashMap<>();

        // 전체 뉴스 개수
        long totalCount = newsRepository.count();
        stats.put("total_articles", totalCount);

        // 최근 24시간 뉴스 개수
        LocalDateTime last24h = LocalDateTime.now().minusHours(24);
        long recent24h = newsRepository.countByCrawledAtAfter(last24h);
        stats.put("articles_last_24h", recent24h);

        // 최근 1주일 뉴스 개수
        LocalDateTime lastWeek = LocalDateTime.now().minusDays(7);
        long recentWeek = newsRepository.countByCrawledAtAfter(lastWeek);
        stats.put("articles_last_week", recentWeek);

        return ResponseEntity.ok(stats);
    }

    /**
     * 특정 뉴스 상세
     * GET /api/news/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<NewsArticle> getNewsById(@PathVariable Long id) {
        return newsRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
