package com.dm.travel_planner.domain.ledger.repository;

import com.dm.travel_planner.domain.ledger.entity.AccountTransfer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AccountTransferRepository extends JpaRepository<AccountTransfer, String> {
    List<AccountTransfer> findByUserIdOrderByTransferredAtDesc(String userId);
}
