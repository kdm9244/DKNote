package com.dm.travel_planner.domain.ledger.investment.dto;
import java.math.BigDecimal;
import jakarta.validation.constraints.*;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTaxKind;
public record InvestmentCostEditRequest(@NotNull @PositiveOrZero @Digits(integer=16,fraction=2) BigDecimal feeAmount,
        @NotNull @PositiveOrZero @Digits(integer=16,fraction=2) BigDecimal taxAmount,
        @NotNull InvestmentTaxKind taxKind,@Size(max=2000) String memo,@NotNull Long version) {}
