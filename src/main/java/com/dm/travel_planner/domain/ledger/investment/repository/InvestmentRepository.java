package com.dm.travel_planner.domain.ledger.investment.repository;

import com.dm.travel_planner.domain.ledger.investment.entity.Investment;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentAssetClass;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InvestmentRepository extends JpaRepository<Investment, String> {
    List<Investment> findByAccountIdAndUserIdAndIsActiveTrueOrderBySymbolNameAsc(String accountId, String userId);
    List<Investment> findByAccountIdAndUserId(String accountId, String userId);
    List<Investment> findByUserIdAndIsActiveTrueOrderBySymbolNameAsc(String userId);
    List<Investment> findByUserIdOrderBySymbolNameAsc(String userId);
    Optional<Investment> findByInvestmentIdAndUserId(String investmentId, String userId);
    Optional<Investment> findByAccountIdAndUserIdAndTickerCode(String accountId, String userId, String tickerCode);
    Optional<Investment> findByAccountIdAndUserIdAndAssetClass(String accountId, String userId, InvestmentAssetClass assetClass);
    void deleteByAccountIdAndUserId(String accountId, String userId);
}
