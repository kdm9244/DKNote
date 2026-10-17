package com.dm.travel_planner.domain.budget.repository;

import com.dm.travel_planner.domain.budget.entity.BudgetItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BudgetItemRepository extends JpaRepository<BudgetItem, String> {
    List<BudgetItem> findByTrip_TripIdOrderByExpenseDateDescCreatedAtDesc(String tripId);
}
