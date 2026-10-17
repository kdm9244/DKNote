package com.dm.travel_planner.domain.ledger.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@AllArgsConstructor
@Builder
public class AccountStatsResponse {

    private String accountId;
    private BigDecimal monthlyIncomeTotal;
    private BigDecimal monthlyExpenseTotal;
    private long monthlyTransactionCount;
    private long uncheckedCount;
}
