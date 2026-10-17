package com.dm.travel_planner.domain.ledger.investment.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record InvestmentPriceUpdateRequest(
        @NotNull @Positive BigDecimal price,
        @NotNull @Positive BigDecimal exchangeRate
) {
}
