package com.dm.travel_planner.domain.ledger.planning.repository;

import com.dm.travel_planner.domain.ledger.planning.entity.InvestmentPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InvestmentPlanRepository extends JpaRepository<InvestmentPlan, String> {
    List<InvestmentPlan> findByUserIdAndStatusNotOrderByCreatedAtDesc(String userId, String status);
    Optional<InvestmentPlan> findByInvestmentPlanIdAndUserId(String investmentPlanId, String userId);
}
