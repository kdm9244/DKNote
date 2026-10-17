package com.dm.travel_planner.domain.ledger.investment.repository;

import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentAccountSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface InvestmentAccountSnapshotRepository extends JpaRepository<InvestmentAccountSnapshot, String> {
    Optional<InvestmentAccountSnapshot> findByAccountIdAndSnapshotDate(String accountId, LocalDate snapshotDate);
    List<InvestmentAccountSnapshot> findTop7ByAccountIdOrderBySnapshotDateDesc(String accountId);
    void deleteByAccountIdAndUserId(String accountId, String userId);
}
