package com.dm.travel_planner.domain.ledger.planning.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

public record MonthlyPlanRequest(
        @NotBlank String targetMonth,
        @PositiveOrZero BigDecimal expectedIncome,
        @PositiveOrZero BigDecimal savingsTarget,
        @PositiveOrZero BigDecimal investmentTarget,
        @PositiveOrZero BigDecimal debtRepaymentTarget,
        String memo
) {}
