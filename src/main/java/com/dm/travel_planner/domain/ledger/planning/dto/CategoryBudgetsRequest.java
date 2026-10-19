package com.dm.travel_planner.domain.ledger.planning.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.util.List;

public record CategoryBudgetsRequest(
        @NotBlank String targetMonth,
        @NotNull List<@Valid CategoryBudgetInput> budgets,
        @Pattern(regexp = "KRW|JPY|USD") String currency
) {
    public record CategoryBudgetInput(
            @NotBlank String categoryName,
            @PositiveOrZero BigDecimal budgetAmount
    ) {}
}
