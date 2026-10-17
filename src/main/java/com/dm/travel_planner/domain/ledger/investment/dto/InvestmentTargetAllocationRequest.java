package com.dm.travel_planner.domain.ledger.investment.dto;

import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentAssetClass;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

public record InvestmentTargetAllocationRequest(
        @NotEmpty List<@Valid Item> items
) {
    public record Item(
            @NotNull InvestmentAssetClass assetClass,
            @NotNull @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal targetRatio
    ) {
    }
}
