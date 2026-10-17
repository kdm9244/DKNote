package com.dm.travel_planner.domain.ledger.planning.repository;

import com.dm.travel_planner.domain.ledger.planning.entity.GoalContribution;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GoalContributionRepository extends JpaRepository<GoalContribution, String> {
    List<GoalContribution> findByGoalIdOrderByContributedAtDesc(String goalId);
}
