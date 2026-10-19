package com.dm.travel_planner.domain.ledger.planning.repository;

import com.dm.travel_planner.domain.ledger.planning.entity.MonthlyFinancialPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MonthlyFinancialPlanRepository extends JpaRepository<MonthlyFinancialPlan, String> {
    Optional<MonthlyFinancialPlan> findByUserIdAndTargetMonthAndCurrency(String userId, String targetMonth, String currency);
}
