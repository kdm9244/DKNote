package com.dm.travel_planner.domain.ledger.investment.repository;

import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentAssetClass;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTargetAllocation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InvestmentTargetAllocationRepository extends JpaRepository<InvestmentTargetAllocation, String> {
    List<InvestmentTargetAllocation> findByAccountIdAndUserId(String accountId, String userId);
    Optional<InvestmentTargetAllocation> findByAccountIdAndUserIdAndAssetClass(
            String accountId, String userId, InvestmentAssetClass assetClass);
    void deleteByAccountIdAndUserId(String accountId, String userId);
}
