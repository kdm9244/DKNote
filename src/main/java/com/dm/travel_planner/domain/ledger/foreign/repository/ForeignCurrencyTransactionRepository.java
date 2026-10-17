package com.dm.travel_planner.domain.ledger.foreign.repository;

import com.dm.travel_planner.domain.ledger.foreign.entity.ForeignCurrencyTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ForeignCurrencyTransactionRepository extends JpaRepository<ForeignCurrencyTransaction, String> {
    List<ForeignCurrencyTransaction> findByAccountIdAndUserIdOrderByTransactionDateAsc(String accountId, String userId);
    Optional<ForeignCurrencyTransaction> findByTransactionIdAndAccountIdAndUserId(
            String transactionId, String accountId, String userId);
    void deleteByAccountId(String accountId);
}
