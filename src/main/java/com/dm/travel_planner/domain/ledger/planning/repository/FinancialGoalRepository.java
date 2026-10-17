package com.dm.travel_planner.domain.ledger.planning.repository;

import com.dm.travel_planner.domain.ledger.planning.entity.FinancialGoal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FinancialGoalRepository extends JpaRepository<FinancialGoal, String> {
    List<FinancialGoal> findByUserIdAndStatusNotOrderByPriorityAscCreatedAtDesc(String userId, String status);
    Optional<FinancialGoal> findByGoalIdAndUserId(String goalId, String userId);
}
