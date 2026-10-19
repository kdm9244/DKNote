package com.dm.travel_planner.domain.ledger.planning.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;

public record FinancialGoalRequest(
        @NotBlank @Size(max = 100) String title,
        @Size(max = 1000) String description,
        @NotBlank String goalType,
        @NotNull @Positive BigDecimal targetAmount,
        @PositiveOrZero BigDecimal initialAmount,
        @PositiveOrZero BigDecimal monthlyTargetAmount,
        LocalDate targetDate,
        @Min(1) @Max(5) Integer priority,
        String linkedAccountId,
        String iconColor,
        @Pattern(regexp = "KRW|JPY|USD") String currency
) {}
