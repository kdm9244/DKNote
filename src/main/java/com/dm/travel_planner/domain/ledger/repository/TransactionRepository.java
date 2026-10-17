package com.dm.travel_planner.domain.ledger.repository;

import com.dm.travel_planner.domain.ledger.entity.Transaction;
import com.dm.travel_planner.domain.ledger.entity.TransactionType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface TransactionRepository extends JpaRepository<Transaction, String> {

    List<Transaction> findByAccountIdOrderByTransactionDateDesc(String accountId);

    List<Transaction> findByAccountIdAndUserIdOrderByTransactionDateDesc(String accountId, String userId);

    List<Transaction> findByUserIdOrderByTransactionDateDesc(String userId);

    List<Transaction> findByUserIdAndTransactionDateGreaterThanEqualAndTransactionDateLessThanOrderByTransactionDateDesc(
            String userId, LocalDateTime from, LocalDateTime to);

    Optional<Transaction> findFirstByAccountIdAndTransactionTypeAndTransactionDateGreaterThanEqualAndTransactionDateLessThanAndTitle(
            String accountId, TransactionType transactionType,
            LocalDateTime from, LocalDateTime to, String title);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t WHERE t.accountId = :accountId AND t.transactionType = :type AND t.transactionDate >= :startDate")
    BigDecimal sumAmountByAccountIdAndTypeAndDateAfter(
            @Param("accountId") String accountId,
            @Param("type") TransactionType type,
            @Param("startDate") LocalDateTime startDate
    );

    @Query("SELECT COUNT(t) FROM Transaction t WHERE t.accountId = :accountId AND t.transactionDate >= :startDate")
    long countByAccountIdAndDateAfter(
            @Param("accountId") String accountId,
            @Param("startDate") LocalDateTime startDate
    );

    void deleteByAccountId(String accountId);
}
