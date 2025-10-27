package com.marketpulse.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "tickers")
public class Ticker {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticker_symbol", unique = true, nullable = false, length = 20)
    private String tickerSymbol;

    @Column(length = 500)
    private String name;

    @Column(name = "asset_type", length = 50)
    private String assetType;

    @Column(length = 200)
    private String sector;

    @Column(length = 200)
    private String industry;

    @Column(length = 10)
    private String currency;

    @Column(length = 100)
    private String country;

    @Column(name = "market_cap")
    private Long marketCap;

    @Column(name = "data_source", length = 100)
    private String dataSource;

    @Column(name = "last_synced_at")
    private LocalDateTime lastSyncedAt;

    @Column(name = "sync_status", length = 50)
    private String syncStatus;

    @Column(name = "is_active")
    private Boolean isActive;
}
