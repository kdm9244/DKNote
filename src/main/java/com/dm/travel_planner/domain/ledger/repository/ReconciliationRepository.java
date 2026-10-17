package com.dm.travel_planner.domain.ledger.repository;

import com.dm.travel_planner.domain.ledger.entity.ReconciliationLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReconciliationRepository extends JpaRepository<ReconciliationLog, String> {

    List<ReconciliationLog> findByAccountIdOrderByReconciledAtDesc(String accountId);

    List<ReconciliationLog> findByAccountIdAndUserIdOrderByReconciledAtDesc(String accountId, String userId);

    void deleteByAccountId(String accountId);
}
