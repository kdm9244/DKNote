package com.dm.travel_planner.domain.ledger.investment.dto;

import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentAssetClass;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

public record InvestmentHoldingCreateRequest(
        @NotBlank String tickerCode,
        @NotBlank String symbolName,
        @NotNull InvestmentAssetClass assetClass,
        String market,
        Currency currency,
        @PositiveOrZero BigDecimal targetQuantity
) {
}
