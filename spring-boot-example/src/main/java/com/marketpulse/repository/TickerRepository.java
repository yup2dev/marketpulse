package com.marketpulse.repository;

import com.marketpulse.entity.Ticker;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TickerRepository extends JpaRepository<Ticker, Long> {

    /**
     * 티커 심볼로 조회
     */
    Optional<Ticker> findByTickerSymbol(String tickerSymbol);

    /**
     * 활성화된 티커만 조회
     */
    List<Ticker> findByIsActiveTrue();

    /**
     * 자산 유형별 조회
     */
    List<Ticker> findByAssetTypeAndIsActiveTrue(String assetType);

    /**
     * 섹터별 조회
     */
    List<Ticker> findBySectorAndIsActiveTrue(String sector);
}
