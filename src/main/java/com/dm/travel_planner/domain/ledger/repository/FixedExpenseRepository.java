package com.dm.travel_planner.domain.ledger.repository;

import com.dm.travel_planner.domain.ledger.entity.FixedExpense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;

public interface FixedExpenseRepository extends JpaRepository<FixedExpense, String> {

    List<FixedExpense> findByUserIdAndIsActiveTrueOrderByNextPaymentDateAsc(String userId);

    Optional<FixedExpense> findByFixedExpenseIdAndUserId(String fixedExpenseId, String userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select f from FixedExpense f where f.fixedExpenseId = :fixedExpenseId and f.userId = :userId")
    Optional<FixedExpense> findForUpdate(
            @Param("fixedExpenseId") String fixedExpenseId,
            @Param("userId") String userId);
}
