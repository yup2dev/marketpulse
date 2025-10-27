package com.marketpulse.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Entity
@Table(name = "news_articles")
public class NewsArticle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 2000)
    private String url;

    @Column(length = 1000)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "text_preview", columnDefinition = "TEXT")
    private String textPreview;

    @Column(length = 200)
    private String source;

    @Column(name = "published_time", length = 100)
    private String publishedTime;

    @Column(name = "sentiment_score")
    private Double sentimentScore;

    @Column(name = "sentiment_label", length = 20)
    private String sentimentLabel;

    @Column(name = "sentiment_confidence")
    private Double sentimentConfidence;

    @Column(name = "importance_score")
    private Double importanceScore;

    @Column(name = "crawled_at")
    private LocalDateTime crawledAt;

    private Integer depth;

    @OneToMany(mappedBy = "article", fetch = FetchType.LAZY)
    private List<NewsTicker> tickers;
}
