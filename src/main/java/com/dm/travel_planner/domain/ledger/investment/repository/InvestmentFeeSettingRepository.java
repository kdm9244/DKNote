package com.dm.travel_planner.domain.ledger.investment.repository;

import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentFeeSetting;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentMarketGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InvestmentFeeSettingRepository extends JpaRepository<InvestmentFeeSetting, String> {
    List<InvestmentFeeSetting> findByAccountIdAndUserIdOrderByMarketGroup(String accountId, String userId);
    Optional<InvestmentFeeSetting> findByAccountIdAndUserIdAndMarketGroup(
            String accountId, String userId, InvestmentMarketGroup marketGroup);
    void deleteByAccountIdAndUserId(String accountId, String userId);
}
