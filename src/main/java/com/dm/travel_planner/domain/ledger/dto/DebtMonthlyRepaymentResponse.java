package com.dm.travel_planner.domain.ledger.dto;

public record DebtMonthlyRepaymentResponse(
        boolean applied,
        String message,
        TransactionResponse transaction,
        AccountResponse account
) {}
