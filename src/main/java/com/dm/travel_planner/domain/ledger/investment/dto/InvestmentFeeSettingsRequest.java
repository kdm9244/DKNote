package com.dm.travel_planner.domain.ledger.investment.dto;

import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentMarketGroup;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

public record InvestmentFeeSettingsRequest(@NotEmpty List<@Valid MarketSetting> settings) {
    public record MarketSetting(
            @NotNull InvestmentMarketGroup marketGroup,
            @DecimalMin("0.0") @DecimalMax("100.0") BigDecimal buyFeeRate,
            @DecimalMin("0.0") @DecimalMax("100.0") BigDecimal sellFeeRate,
            @DecimalMin("0.0") @DecimalMax("100.0") BigDecimal sellTaxRate,
            @DecimalMin("0.0") @DecimalMax("100.0") BigDecimal dividendTaxRate
    ) {
    }
}
