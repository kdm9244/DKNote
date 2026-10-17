package com.dm.travel_planner.domain.ledger.planning.repository;

import com.dm.travel_planner.domain.ledger.planning.entity.LedgerCategoryBudget;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LedgerCategoryBudgetRepository extends JpaRepository<LedgerCategoryBudget, String> {
    List<LedgerCategoryBudget> findByUserIdAndTargetMonthOrderByCategoryNameAsc(String userId, String targetMonth);
    void deleteByUserIdAndTargetMonth(String userId, String targetMonth);
}
