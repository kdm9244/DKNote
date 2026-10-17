package com.dm.travel_planner.domain.ledger.dto;

import com.dm.travel_planner.domain.ledger.entity.Account;
import com.dm.travel_planner.domain.ledger.entity.AccountPurpose;
import com.dm.travel_planner.domain.ledger.entity.AccountType;
import com.dm.travel_planner.domain.ledger.entity.Currency;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
@Builder
public class AccountResponse {

    private String accountId;
    private String userId;
    private String accountName;
    private String bankName;
    private AccountType accountType;
    private AccountPurpose accountPurpose;
    private Currency currency;
    private BigDecimal initialBalance;
    private LocalDate initialBalanceDate;
    private BigDecimal initialExchangeRate;
    private BigDecimal cachedBookBalance;
    private BigDecimal lastActualBalance;
    private LocalDateTime lastReconciledAt;
    private BigDecimal balanceDifference;
    private BigDecimal minimumBalance;
    private BigDecimal targetBalance;
    private String accountNumberMasked;
    private Integer displayOrder;
    private Boolean isActive;
    private LocalDateTime balanceUpdatedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // 저축 계좌 전용 필드
    private BigDecimal interestRate;
    private LocalDate maturityDate;
    private String interestType;
    private BigDecimal monthlyPayment;

    public static AccountResponse from(Account account) {
        if (account == null) {
            return null;
        }

        BigDecimal diff = null;
        if (account.getLastActualBalance() != null && account.getCachedBookBalance() != null) {
            diff = account.getCachedBookBalance().subtract(account.getLastActualBalance());
        }

        return AccountResponse.builder()
                .accountId(account.getAccountId())
                .userId(account.getUserId())
                .accountName(account.getAccountName())
                .bankName(account.getBankName())
                .accountType(account.getAccountType())
                .accountPurpose(account.getAccountPurpose())
                .currency(account.getCurrency())
                .initialBalance(account.getInitialBalance())
                .initialBalanceDate(account.getInitialBalanceDate())
                .initialExchangeRate(account.getInitialExchangeRate())
                .cachedBookBalance(account.getCachedBookBalance())
                .lastActualBalance(account.getLastActualBalance())
                .lastReconciledAt(account.getLastReconciledAt())
                .balanceDifference(diff)
                .minimumBalance(account.getMinimumBalance())
                .targetBalance(account.getTargetBalance())
                .accountNumberMasked(account.getAccountNumberMasked())
                .displayOrder(account.getDisplayOrder())
                .isActive(account.getIsActive())
                .balanceUpdatedAt(account.getBalanceUpdatedAt())
                .createdAt(account.getCreatedAt())
                .updatedAt(account.getUpdatedAt())
                .interestRate(account.getInterestRate())
                .maturityDate(account.getMaturityDate())
                .interestType(account.getInterestType())
                .monthlyPayment(account.getMonthlyPayment())
                .build();
    }
}
