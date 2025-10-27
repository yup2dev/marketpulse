package com.marketpulse.entity;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "news_tickers")
public class NewsTicker {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "article_id", nullable = false)
    @JsonBackReference
    private NewsArticle article;

    @Column(name = "ticker_symbol", nullable = false, length = 20)
    private String tickerSymbol;

    private Double confidence;

    @Column(name = "mention_count")
    private Integer mentionCount;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "ticker_symbol", referencedColumnName = "ticker_symbol", insertable = false, updatable = false)
    private Ticker ticker;
}
