package com.dm.travel_planner.domain.ledger.investment.repository;

import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentAccountProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InvestmentAccountProfileRepository extends JpaRepository<InvestmentAccountProfile, String> {
    List<InvestmentAccountProfile> findByAutoSyncEnabledTrue();
}
