package com.dm.travel_planner.domain.ledger.planning.repository;

import com.dm.travel_planner.domain.ledger.planning.entity.LedgerCategoryBudget;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LedgerCategoryBudgetRepository extends JpaRepository<LedgerCategoryBudget, String> {
    List<LedgerCategoryBudget> findByUserIdAndTargetMonthAndCurrencyOrderByCategoryNameAsc(String userId, String targetMonth, String currency);
    void deleteByUserIdAndTargetMonthAndCurrency(String userId, String targetMonth, String currency);
}
