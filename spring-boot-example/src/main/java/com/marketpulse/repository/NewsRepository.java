package com.marketpulse.repository;

import com.marketpulse.entity.NewsArticle;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface NewsRepository extends JpaRepository<NewsArticle, Long> {

    /**
     * 최신 뉴스 조회 (페이징)
     */
    List<NewsArticle> findByOrderByCrawledAtDesc(Pageable pageable);

    /**
     * 특정 기간 이후 뉴스
     */
    List<NewsArticle> findByCrawledAtAfterOrderByCrawledAtDesc(
            LocalDateTime dateTime,
            Pageable pageable
    );

    /**
     * 특정 티커 관련 뉴스
     */
    @Query("SELECT DISTINCT a FROM NewsArticle a " +
           "JOIN FETCH a.tickers t " +
           "WHERE t.tickerSymbol = :symbol " +
           "AND a.crawledAt > :since " +
           "ORDER BY a.crawledAt DESC")
    List<NewsArticle> findByTickerSymbol(
            @Param("symbol") String symbol,
            @Param("since") LocalDateTime since,
            Pageable pageable
    );

    /**
     * 감성별 뉴스
     */
    List<NewsArticle> findBySentimentLabelAndCrawledAtAfterOrderByCrawledAtDesc(
            String sentimentLabel,
            LocalDateTime dateTime,
            Pageable pageable
    );

    /**
     * 전체 뉴스 개수
     */
    long count();

    /**
     * 특정 기간 뉴스 개수
     */
    long countByCrawledAtAfter(LocalDateTime dateTime);
}
