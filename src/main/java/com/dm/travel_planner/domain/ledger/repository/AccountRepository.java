package com.dm.travel_planner.domain.ledger.repository;

import com.dm.travel_planner.domain.ledger.entity.Account;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;

@Repository
public interface AccountRepository extends JpaRepository<Account, String> {

    /**
     * 특정 사용자의 활성화된 계좌 목록을 displayOrder 오름차순으로 조회합니다.
     */
    List<Account> findByUserIdAndIsActiveTrueOrderByDisplayOrderAsc(String userId);

    /**
     * 특정 사용자의 전체 계좌 목록(비활성 포함)을 displayOrder 오름차순으로 조회합니다.
     */
    List<Account> findByUserIdOrderByDisplayOrderAsc(String userId);

    /**
     * accountId와 userId로 계좌를 안전하게 조회합니다.
     */
    Optional<Account> findByAccountIdAndUserId(String accountId, String userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Account a WHERE a.accountId = :accountId AND a.userId = :userId")
    Optional<Account> findForUpdateByAccountIdAndUserId(
            @Param("accountId") String accountId,
            @Param("userId") String userId);

    /**
     * 동일 사용자의 특정 계좌명이 이미 존재하는지 여부를 확인합니다.
     */
    boolean existsByUserIdAndAccountName(String userId, String accountName);

    /**
     * 특정 사용자에게 등록된 계좌가 존재하는지 여부를 확인합니다.
     */
    boolean existsByUserId(String userId);

    /**
     * 특정 사용자에게 특정 목적(용도)의 계좌가 존재하는지 여부를 확인합니다.
     */
    boolean existsByUserIdAndAccountPurpose(String userId, com.dm.travel_planner.domain.ledger.entity.AccountPurpose accountPurpose);
}
