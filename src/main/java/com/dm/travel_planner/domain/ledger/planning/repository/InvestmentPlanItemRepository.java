package com.dm.travel_planner.domain.ledger.planning.repository;

import com.dm.travel_planner.domain.ledger.planning.entity.InvestmentPlanItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InvestmentPlanItemRepository extends JpaRepository<InvestmentPlanItem, String> {
    List<InvestmentPlanItem> findByInvestmentPlanIdOrderByCreatedAtAsc(String investmentPlanId);
    void deleteByInvestmentPlanId(String investmentPlanId);
}
