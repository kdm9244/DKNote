package com.dm.travel_planner.domain.ledger.investment.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public record InvestmentQuantityRepairRequest(
        @NotNull @Positive BigDecimal expectedQuantity,
        @NotNull @Positive BigDecimal quantity) {}
