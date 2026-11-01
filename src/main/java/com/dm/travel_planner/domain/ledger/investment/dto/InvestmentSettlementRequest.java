package com.dm.travel_planner.domain.ledger.investment.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

public record InvestmentSettlementRequest(
        @NotNull @Digits(integer=16, fraction=2) BigDecimal expectedBalance,
        @DecimalMin("0") @Digits(integer=16, fraction=2) BigDecimal finalCashBalance,
        @Digits(integer=16, fraction=2) BigDecimal profitLoss,
        @NotNull LocalDate date,
        @NotNull Boolean cashFlowsRecorded,
        @Size(max=500) String memo,
        @NotBlank @Pattern(regexp="[a-zA-Z0-9-]{1,50}") String requestId,
        Long version,
        Boolean holdingsUnchanged) {}
