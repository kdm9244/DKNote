package com.dm.travel_planner.domain.ledger.investment.repository;

import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentPriceSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InvestmentPriceSnapshotRepository extends JpaRepository<InvestmentPriceSnapshot, String> {
    void deleteByInvestmentIdIn(List<String> investmentIds);
}
